/**
 * OCR service for product labels and shelf labels (NOT receipts).
 * Uses Google Vision for text extraction and Gemini for product info parsing.
 */

import { extractTextFromImage } from "@/modules/receipts/ocr/google-vision";
import { extractProductInfo, type ProductInfo } from "@/domain/parsers/product-name";

/**
 * OCR a base64-encoded image using Google Vision.
 * Returns the raw OCR text and structured product info extracted via Gemini.
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

  const productInfo = await extractProductInfo(
    result.raw_text,
    result.labels,
    result.logos,
  );

  return {
    success: true as const,
    raw_text: result.raw_text,
    product_info: productInfo,
  };
}

/**
 * Scan a receipt image using TabScanner API.
 * Returns structured receipt data including line items, totals, and merchant info.
 */
export async function scanReceiptImage(base64Image: string) {
  const { scanReceipt } = await import("@/modules/receipts/ocr/tabscanner");
  return scanReceipt(base64Image);
}

export type { ProductInfo };
