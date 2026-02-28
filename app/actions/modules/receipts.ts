// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/receiving/receipt/server/*

"use server";

import { requireModule } from "@/core/modules/guard";
import { requireBusinessId } from "@/core/auth/tenant";
import { serialize } from "@/core/utils/serialize";
import { prisma } from "@/core/prisma";
import { commitReceiptTransactions as _commitReceiptTransactions } from "@/app/actions/core/transactions";
import {
  createReceipt as _createReceipt,
  parseAndMatchReceipt as _parseAndMatch,
  processReceiptText as _processText,
  processReceiptImage as _processImage,
} from "@/features/receiving/receipt/server/receipt-workflow.service";
import { updateLineItemMatch as _updateLineItemMatch } from "@/features/receiving/receipt/server/line-item.service";
import {
  getReceiptWithLineItems as _getWithLineItems,
  getReceiptDetail as _getDetail,
  getReceipts as _getReceipts,
} from "@/features/receiving/receipt/server/receipt-query.service";
import type { ReceiptInventoryDecision } from "@/lib/generated/prisma/client";

const PRODUCE_PARSE_FLAGS = new Set([
  "produce_lookup_plu_match",
  "produce_lookup_name_fuzzy_match",
]);

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function hasProduceSignal(line: {
  parse_flags: unknown;
  plu_code: number | null;
}): boolean {
  if (line.plu_code != null) return true;
  return toStringArray(line.parse_flags).some((flag) => PRODUCE_PARSE_FLAGS.has(flag));
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
    const toNumberFn = (value as { toNumber?: () => number }).toNumber;
    if (typeof toNumberFn === "function") {
      const parsed = toNumberFn();
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function mapDecisionToStatus(decision: ReceiptInventoryDecision) {
  switch (decision) {
    case "add_to_inventory":
      return "confirmed" as const;
    case "expense_only":
      return "skipped" as const;
    case "resolve_later":
      return "unresolved" as const;
    default:
      return null;
  }
}

// ============================================================
// Receipt lifecycle actions
// ============================================================

export async function createReceipt(data: {
  image_url?: string;
  raw_text?: string;
  supplier_id?: string;
}) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  const receipt = await _createReceipt({
    businessId,
    imageUrl: data.image_url,
    rawText: data.raw_text,
    supplierId: data.supplier_id,
  });
  return serialize(receipt);
}

export async function parseAndMatchReceipt(receiptId: string) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _parseAndMatch(receiptId, businessId);
}

export async function updateLineItemMatch(
  lineItemId: string,
  data: {
    matched_item_id: string | null;
    status: "confirmed" | "skipped" | "unresolved";
    quantity?: number;
    unit?: string;
    inventory_decision?: ReceiptInventoryDecision;
  },
) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _updateLineItemMatch(lineItemId, businessId, data);
}

export async function setReceiptProduceDecision(
  lineItemId: string,
  decision: Exclude<ReceiptInventoryDecision, "pending">,
) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();

  const line = await prisma.receiptLineItem.findFirst({
    where: {
      id: lineItemId,
      receipt: { business_id: businessId },
    },
    select: {
      id: true,
      matched_item_id: true,
      parse_flags: true,
      plu_code: true,
    },
  });

  if (!line) {
    throw new Error("Receipt line item not found");
  }
  if (!hasProduceSignal(line)) {
    throw new Error("Line item is not eligible for produce checklist decisions");
  }

  const mappedStatus = mapDecisionToStatus(decision);
  if (!mappedStatus) {
    throw new Error("Invalid produce decision");
  }
  if (decision === "add_to_inventory" && !line.matched_item_id) {
    throw new Error("Link this produce line to an inventory item before adding to inventory");
  }

  return _updateLineItemMatch(line.id, businessId, {
    matched_item_id: line.matched_item_id,
    status: mappedStatus,
    inventory_decision: decision,
  });
}

export async function finalizeReceiptReview(receiptId: string) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();

  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, business_id: businessId },
    select: {
      id: true,
      line_items: {
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
      },
    },
  });

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  const pendingProduceLines = receipt.line_items.filter((line) =>
    hasProduceSignal(line) && line.inventory_decision === "pending",
  );
  if (pendingProduceLines.length > 0) {
    throw new Error("Complete produce checklist decisions before committing this receipt");
  }

  const linesToCommit = receipt.line_items
    .filter((line) => {
      const hasMatchedItem = Boolean(line.matched_item_id);
      const committableStatus = line.status === "confirmed" || line.status === "matched";
      if (!hasMatchedItem || !committableStatus) return false;
      if (!hasProduceSignal(line)) return true;
      return line.inventory_decision === "add_to_inventory";
    })
    .map((line) => ({
      inventory_item_id: line.matched_item_id as string,
      receipt_line_item_id: line.id,
      quantity: toNumber(line.quantity) ?? 1,
      unit: (line.unit ?? "each") as never,
      unit_cost: toNumber(line.unit_cost) ?? undefined,
      total_cost: toNumber(line.line_cost) ?? undefined,
    }));

  if (linesToCommit.length === 0) {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { status: "committed" },
    });
    return serialize({
      committed: [],
      committed_count: 0,
      expense_only_count: receipt.line_items.filter(
        (line) => line.inventory_decision === "expense_only",
      ).length,
      resolve_later_count: receipt.line_items.filter(
        (line) => line.inventory_decision === "resolve_later",
      ).length,
    });
  }

  const committed = await _commitReceiptTransactions(receipt.id, linesToCommit);
  return serialize({
    committed,
    committed_count: linesToCommit.length,
    expense_only_count: receipt.line_items.filter(
      (line) => line.inventory_decision === "expense_only",
    ).length,
    resolve_later_count: receipt.line_items.filter(
      (line) => line.inventory_decision === "resolve_later",
    ).length,
  });
}

// ============================================================
// Queries
// ============================================================

export async function getReceiptWithLineItems(receiptId: string) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _getWithLineItems(receiptId, businessId);
}

export async function getReceipts(status?: string) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _getReceipts(businessId, status);
}

export async function getReceiptDetail(receiptId: string) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _getDetail(receiptId, businessId);
}

export async function processReceiptText(
  rawText: string,
  supplierId?: string,
) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _processText(rawText, businessId, supplierId);
}

export async function processReceiptImage(
  base64Image: string,
  supplierId?: string,
) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _processImage(base64Image, businessId, supplierId);
}
