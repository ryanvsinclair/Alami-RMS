"use server";

import { extractTextFromImage } from "@/lib/ocr/google-vision";
import { extractProductInfo, type ProductInfo } from "@/lib/parsers/product-name";

/**
 * Server action: OCR a base64-encoded image.
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

  const productInfo = await extractProductInfo(result.raw_text, result.labels, result.logos);

  return {
    success: true as const,
    raw_text: result.raw_text,
    product_info: productInfo,
  };
}
