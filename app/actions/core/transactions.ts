"use server";

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { requireBusinessId } from "@/core/auth/tenant";
import type {
  InputMethod,
  TransactionType,
  UnitType,
} from "@/lib/generated/prisma/client";

const PRODUCE_PARSE_FLAGS = new Set([
  "produce_lookup_plu_match",
  "produce_lookup_name_fuzzy_match",
]);

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function hasProduceSignal(line: { parse_flags: unknown; plu_code: number | null }): boolean {
  if (line.plu_code != null) return true;
  return toStringArray(line.parse_flags).some((flag) => PRODUCE_PARSE_FLAGS.has(flag));
}

// ============================================================
// Single transaction (barcode, photo, manual flows)
// ============================================================

export async function createTransaction(data: {
  inventory_item_id: string;
  transaction_type?: TransactionType;
  quantity: number;
  unit: UnitType;
  unit_cost?: number;
  total_cost?: number;
  input_method: InputMethod;
  source?: string;
  receipt_id?: string;
  receipt_line_item_id?: string;
  notes?: string;
  raw_data?: Record<string, unknown>;
}) {
  const businessId = await requireBusinessId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id: data.inventory_item_id, business_id: businessId },
    select: { id: true },
  });
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const { raw_data, ...rest } = data;
  const tx = await prisma.inventoryTransaction.create({
    data: {
      business_id: businessId,
      ...rest,
      transaction_type: data.transaction_type ?? "purchase",
      raw_data: raw_data ? (raw_data as never) : undefined,
    },
    include: {
      inventory_item: true,
    },
  });
  return serialize(tx);
}

// ============================================================
// Bulk transaction (receipt commit flow)
// Atomic: all-or-nothing via Prisma transaction
// ============================================================

export async function commitReceiptTransactions(
  receiptId: string,
  lines: {
    inventory_item_id: string;
    receipt_line_item_id: string;
    quantity: number;
    unit: UnitType;
    unit_cost?: number;
    total_cost?: number;
    source?: string;
  }[]
) {
  const businessId = await requireBusinessId();
  const requestedLineById = new Map(lines.map((line) => [line.receipt_line_item_id, line]));
  const requestedLineIds = Array.from(
    new Set(lines.map((line) => line.receipt_line_item_id))
  );

  if (requestedLineIds.length === 0) {
    throw new Error("No receipt lines provided");
  }

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({
      where: { id: receiptId, business_id: businessId },
      select: { id: true, status: true },
    });

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    // Idempotency: if every requested line already has a transaction, return them.
    const existingTransactions = await tx.inventoryTransaction.findMany({
      where: {
        business_id: businessId,
        receipt_id: receiptId,
        receipt_line_item_id: { in: requestedLineIds },
      },
    });

    if (receipt.status === "committed") {
      if (existingTransactions.length === requestedLineIds.length) {
        return serialize(existingTransactions);
      }
      throw new Error("Receipt already committed");
    }

    if (existingTransactions.length === requestedLineIds.length) {
      await tx.receipt.update({
        where: { id: receiptId },
        data: { status: "committed" },
      });
      return serialize(existingTransactions);
    }

    if (existingTransactions.length > 0) {
      throw new Error("Partial receipt commit detected; manual reconciliation required");
    }

    const receiptProduceLines = await tx.receiptLineItem.findMany({
      where: {
        receipt_id: receiptId,
        receipt: { business_id: businessId },
      },
      select: {
        id: true,
        parse_flags: true,
        plu_code: true,
        inventory_decision: true,
      },
    });

    const pendingProduceLinesOnReceipt = receiptProduceLines.filter(
      (line) => hasProduceSignal(line) && line.inventory_decision === "pending",
    );
    if (pendingProduceLinesOnReceipt.length > 0) {
      throw new Error("Complete produce checklist decisions before committing this receipt");
    }

    // Validate that requested line ids belong to this receipt and are committable.
    const lineItems = await tx.receiptLineItem.findMany({
      where: {
        id: { in: requestedLineIds },
        receipt_id: receiptId,
        receipt: { business_id: businessId },
      },
      select: {
        id: true,
        matched_item_id: true,
        quantity: true,
        unit: true,
        unit_cost: true,
        line_cost: true,
        status: true,
        parse_flags: true,
        plu_code: true,
        inventory_decision: true,
      },
    });

    if (lineItems.length !== requestedLineIds.length) {
      throw new Error("One or more receipt lines do not belong to this receipt");
    }

    const pendingProduceLines = lineItems.filter(
      (line) => hasProduceSignal(line) && line.inventory_decision === "pending",
    );
    if (pendingProduceLines.length > 0) {
      throw new Error("Complete produce checklist decisions before committing this receipt");
    }

    const ineligibleProduceLines = lineItems.filter(
      (line) =>
        hasProduceSignal(line) &&
        line.inventory_decision !== "add_to_inventory",
    );
    if (ineligibleProduceLines.length > 0) {
      throw new Error("Only produce lines marked yes can be committed to inventory");
    }

    const uncommittable = lineItems.filter(
      (line) =>
        !line.matched_item_id ||
        (line.status !== "confirmed" && line.status !== "matched")
    );
    if (uncommittable.length > 0) {
      throw new Error("Only matched or confirmed receipt lines can be committed");
    }

    const lineById = new Map(lineItems.map((line) => [line.id, line]));
    const orderedLineItems = requestedLineIds.map((id) => {
      const line = lineById.get(id);
      if (!line) {
        throw new Error("Invalid receipt line mapping");
      }
      return line;
    });

    const invalidInventoryMappings = orderedLineItems.filter((line) => {
      const requested = requestedLineById.get(line.id);
      return !requested || requested.inventory_item_id !== line.matched_item_id;
    });
    if (invalidInventoryMappings.length > 0) {
      throw new Error("Receipt line mapping no longer matches eligible inventory item");
    }

    const transactions = await Promise.all(
      orderedLineItems.map((line) =>
        tx.inventoryTransaction.create({
          data: {
            business_id: businessId,
            inventory_item_id: line.matched_item_id!,
            transaction_type: "purchase",
            quantity: line.quantity ?? 1,
            unit: line.unit ?? "each",
            unit_cost: line.unit_cost ?? undefined,
            total_cost: line.line_cost ?? undefined,
            input_method: "receipt",
            receipt_id: receiptId,
            receipt_line_item_id: line.id,
          },
        })
      )
    );

    await tx.receiptLineItem.updateMany({
      where: { id: { in: requestedLineIds } },
      data: { status: "confirmed" },
    });

    await tx.receipt.update({
      where: { id: receiptId },
      data: { status: "committed" },
    });

    return serialize(transactions);
  });
}

// ============================================================
// Queries
// ============================================================

export async function getTransactionsForItem(
  inventoryItemId: string,
  limit = 50
) {
  const businessId = await requireBusinessId();
  const rows = await prisma.inventoryTransaction.findMany({
    where: { inventory_item_id: inventoryItemId, business_id: businessId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      receipt: true,
    },
  });
  return serialize(rows);
}

export async function getInventoryLevel(inventoryItemId: string) {
  const businessId = await requireBusinessId();
  const result = await prisma.inventoryTransaction.aggregate({
    where: { inventory_item_id: inventoryItemId, business_id: businessId },
    _sum: { quantity: true },
    _count: true,
    _max: { created_at: true },
  });

  return serialize({
    current_quantity: result._sum.quantity?.toNumber() ?? 0,
    transaction_count: result._count,
    last_transaction_at: result._max.created_at,
  });
}

export async function getAllInventoryLevels() {
  const businessId = await requireBusinessId();
  const [items, stats] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { is_active: true, business_id: businessId },
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryTransaction.groupBy({
      where: { business_id: businessId },
      by: ["inventory_item_id"],
      _sum: { quantity: true },
      _count: { _all: true },
      _max: { created_at: true },
    }),
  ]);

  const statsByItemId = new Map(
    stats.map((row) => [
      row.inventory_item_id,
      {
        current_quantity: row._sum.quantity?.toNumber() ?? 0,
        transaction_count: row._count._all,
        last_transaction_at: row._max.created_at ?? null,
      },
    ])
  );

  return serialize(items.map((item) => {
    const itemStats = statsByItemId.get(item.id);
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      category: item.category,
      supplier: item.supplier,
      current_quantity: itemStats?.current_quantity ?? 0,
      transaction_count: itemStats?.transaction_count ?? 0,
      last_transaction_at: itemStats?.last_transaction_at ?? null,
    };
  }));
}

export async function getRecentTransactions(limit = 20) {
  const businessId = await requireBusinessId();
  const rows = await prisma.inventoryTransaction.findMany({
    where: { business_id: businessId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      inventory_item: true,
      receipt: true,
    },
  });
  return serialize(rows);
}
