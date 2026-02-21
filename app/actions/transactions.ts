"use server";

import { prisma } from "@/lib/prisma";
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
  const { raw_data, ...rest } = data;
  return prisma.inventoryTransaction.create({
    data: {
      ...rest,
      transaction_type: data.transaction_type ?? "purchase",
      raw_data: raw_data ? (raw_data as never) : undefined,
    },
    include: {
      inventory_item: true,
    },
  });
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
  return prisma.$transaction(async (tx) => {
    // Create all ledger entries
    const transactions = await Promise.all(
      lines.map((line) =>
        tx.inventoryTransaction.create({
          data: {
            inventory_item_id: line.inventory_item_id,
            transaction_type: "purchase",
            quantity: line.quantity,
            unit: line.unit,
            unit_cost: line.unit_cost,
            total_cost: line.total_cost,
            input_method: "receipt",
            source: line.source,
            receipt_id: receiptId,
            receipt_line_item_id: line.receipt_line_item_id,
          },
        })
      )
    );

    // Mark all line items as confirmed
    await Promise.all(
      lines.map((line) =>
        tx.receiptLineItem.update({
          where: { id: line.receipt_line_item_id },
          data: { status: "confirmed" },
        })
      )
    );

    // Mark receipt as committed
    await tx.receipt.update({
      where: { id: receiptId },
      data: { status: "committed" },
    });

    return transactions;
  });
}

// ============================================================
// Queries
// ============================================================

export async function getTransactionsForItem(
  inventoryItemId: string,
  limit = 50
) {
  return prisma.inventoryTransaction.findMany({
    where: { inventory_item_id: inventoryItemId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      receipt: true,
    },
  });
}

export async function getInventoryLevel(inventoryItemId: string) {
  const result = await prisma.inventoryTransaction.aggregate({
    where: { inventory_item_id: inventoryItemId },
    _sum: { quantity: true },
    _count: true,
    _max: { created_at: true },
  });

  return {
    current_quantity: result._sum.quantity?.toNumber() ?? 0,
    transaction_count: result._count,
    last_transaction_at: result._max.created_at,
  };
}

export async function getAllInventoryLevels() {
  const items = await prisma.inventoryItem.findMany({
    where: { is_active: true },
    include: {
      category: true,
      supplier: true,
      transactions: {
        select: { quantity: true, created_at: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return items.map((item) => {
    const totalQty = item.transactions.reduce(
      (sum, t) => sum + t.quantity.toNumber(),
      0
    );
    const lastTx = item.transactions.length
      ? item.transactions.reduce((latest, t) =>
          t.created_at > latest.created_at ? t : latest
        ).created_at
      : null;

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      category: item.category,
      supplier: item.supplier,
      current_quantity: totalQty,
      transaction_count: item.transactions.length,
      last_transaction_at: lastTx,
    };
  });
}

export async function getRecentTransactions(limit = 20) {
  return prisma.inventoryTransaction.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      inventory_item: true,
      receipt: true,
    },
  });
}
