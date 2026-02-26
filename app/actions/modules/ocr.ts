// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/receiving/photo/server/*

"use server";

import { requireModule } from "@/core/modules/guard";
import {
  ocrImage as _ocrImage,
  scanReceiptImage as _scanReceiptImage,
} from "@/features/receiving/photo/server/ocr.service";
import type { TabScannerResult } from "@/modules/receipts/ocr/tabscanner";

/**
 * Server action: OCR a base64-encoded image using Google Vision.
 * Returns the raw OCR text and structured product info extracted via Gemini.
 * Used for product labels and shelf labels (NOT receipts).
 */
export async function ocrImage(base64Image: string) {
  await requireModule("receipts");
  return _ocrImage(base64Image);
}

/**
 * Server action: Scan a receipt image using TabScanner API.
 * Returns structured receipt data including line items, totals, and merchant info.
 * This replaces Google Vision for receipt-specific OCR.
 */
export async function scanReceiptImage(
  base64Image: string,
): Promise<{
  success: boolean;
  result: TabScannerResult | null;
  error?: string;
}> {
  await requireModule("receipts");
  return _scanReceiptImage(base64Image);
}
