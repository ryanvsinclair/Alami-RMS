/**
 * Shopping session state recomputation service.
 * Recalculates session status and subtotals after item changes.
 */

import type { Prisma } from "@/lib/generated/prisma/client";
import { toNumber, round, getReceiptBalanceCheck } from "./helpers";

export async function recomputeSessionState(
  tx: Prisma.TransactionClient,
  sessionId: string
) {
  const [session, items] = await Promise.all([
    tx.shoppingSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        receipt_id: true,
        receipt_subtotal: true,
        receipt_total: true,
        tax_total: true,
      },
    }),
    tx.shoppingSessionItem.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: "asc" },
    }),
  ]);

  const stagedSubtotal = items
    .filter((item) => item.origin === "staged" && item.resolution !== "skip")
    .reduce((sum, item) => sum + (toNumber(item.staged_line_total) ?? 0), 0);

  const pendingMismatches = items.filter((item) => {
    if (item.resolution === "skip") return false;
    if (item.reconciliation_status === "exact") return false;
    return item.resolution === "pending";
  }).length;

  const receiptBalance = getReceiptBalanceCheck({
    receiptId: session.receipt_id,
    receiptSubtotal: session.receipt_subtotal,
    receiptTotal: session.receipt_total,
    taxTotal: session.tax_total,
    items,
  });

  let nextStatus = session.status;
  if (session.status !== "committed" && session.status !== "cancelled") {
    if (!session.receipt_id) {
      nextStatus = "draft";
    } else if (pendingMismatches === 0 && receiptBalance.isBalanced) {
      nextStatus = "ready";
    } else {
      nextStatus = "reconciling";
    }
  }

  await tx.shoppingSession.update({
    where: { id: sessionId },
    data: {
      status: nextStatus,
      staged_subtotal: round(stagedSubtotal),
    },
  });
}
