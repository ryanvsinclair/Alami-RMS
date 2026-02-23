"use server";

import { extractTextFromImage } from "@/lib/ocr/google-vision";
import { extractProductInfo, type ProductInfo } from "@/lib/parsers/product-name";
import {
  scanReceipt,
  type TabScannerResult,
} from "@/lib/ocr/tabscanner";

/**
 * Server action: OCR a base64-encoded image using Google Vision.
 * Returns the raw OCR text and structured product info extracted via Gemini.
 * Used for product labels and shelf labels (NOT receipts).
 */
export async function ocrImage(base64Image: string) {
  const result = await extractTextFromImage(base64Image);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error ?? "OCR failed",
      raw_text: "",
      product_info: null as ProductInfo | null,
    };
  }

  const productInfo = await extractProductInfo(result.raw_text, result.labels, result.logos);

  return {
    success: true as const,
    raw_text: result.raw_text,
    product_info: productInfo,
  };
}

/**
 * Server action: Scan a receipt image using TabScanner API.
 * Returns structured receipt data including line items, totals, and merchant info.
 * This replaces Google Vision for receipt-specific OCR.
 */
export async function scanReceiptImage(
  base64Image: string
): Promise<{
  success: boolean;
  result: TabScannerResult | null;
  error?: string;
}> {
  return scanReceipt(base64Image);
}
