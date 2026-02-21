"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import { requireRestaurantId } from "@/lib/auth/tenant";
import type {
  InputMethod,
  TransactionType,
  UnitType,
} from "@/lib/generated/prisma/client";

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
  const restaurantId = await requireRestaurantId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id: data.inventory_item_id, restaurant_id: restaurantId },
    select: { id: true },
  });
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const { raw_data, ...rest } = data;
  const tx = await prisma.inventoryTransaction.create({
    data: {
      restaurant_id: restaurantId,
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
  const restaurantId = await requireRestaurantId();
  const requestedLineIds = Array.from(
    new Set(lines.map((line) => line.receipt_line_item_id))
  );

  if (requestedLineIds.length === 0) {
    throw new Error("No receipt lines provided");
  }

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({
      where: { id: receiptId, restaurant_id: restaurantId },
      select: { id: true, status: true },
    });

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    // Idempotency: if every requested line already has a transaction, return them.
    const existingTransactions = await tx.inventoryTransaction.findMany({
      where: {
        restaurant_id: restaurantId,
        receipt_id: receiptId,
        receipt_line_item_id: { in: requestedLineIds },
      },
    });

    if (existingTransactions.length === requestedLineIds.length) {
      if (receipt.status !== "committed") {
        await tx.receipt.update({
          where: { id: receiptId },
          data: { status: "committed" },
        });
      }
      return serialize(existingTransactions);
    }

    if (existingTransactions.length > 0) {
      throw new Error("Partial receipt commit detected; manual reconciliation required");
    }

    // Validate that requested line ids belong to this receipt and are committable.
    const lineItems = await tx.receiptLineItem.findMany({
      where: {
        id: { in: requestedLineIds },
        receipt_id: receiptId,
        receipt: { restaurant_id: restaurantId },
      },
      select: {
        id: true,
        matched_item_id: true,
        quantity: true,
        unit: true,
        unit_cost: true,
        line_cost: true,
        status: true,
      },
    });

    if (lineItems.length !== requestedLineIds.length) {
      throw new Error("One or more receipt lines do not belong to this receipt");
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

    const transactions = await Promise.all(
      orderedLineItems.map((line) =>
        tx.inventoryTransaction.create({
          data: {
            restaurant_id: restaurantId,
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
  const restaurantId = await requireRestaurantId();
  const rows = await prisma.inventoryTransaction.findMany({
    where: { inventory_item_id: inventoryItemId, restaurant_id: restaurantId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      receipt: true,
    },
  });
  return serialize(rows);
}

export async function getInventoryLevel(inventoryItemId: string) {
  const restaurantId = await requireRestaurantId();
  const result = await prisma.inventoryTransaction.aggregate({
    where: { inventory_item_id: inventoryItemId, restaurant_id: restaurantId },
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
  const restaurantId = await requireRestaurantId();
  const [items, stats] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { is_active: true, restaurant_id: restaurantId },
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryTransaction.groupBy({
      where: { restaurant_id: restaurantId },
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
  const restaurantId = await requireRestaurantId();
  const rows = await prisma.inventoryTransaction.findMany({
    where: { restaurant_id: restaurantId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      inventory_item: true,
      receipt: true,
    },
  });
  return serialize(rows);
}
