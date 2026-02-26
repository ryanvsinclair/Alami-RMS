// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/receiving/receipt/server/*

"use server";

import { requireModule } from "@/core/modules/guard";
import { requireBusinessId } from "@/core/auth/tenant";
import { serialize } from "@/core/utils/serialize";
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
    status: "confirmed" | "skipped";
    quantity?: number;
    unit?: string;
  },
) {
  await requireModule("receipts");
  const businessId = await requireBusinessId();
  return _updateLineItemMatch(lineItemId, businessId, data);
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
