"use server";

import { extractTextFromImage } from "@/lib/ocr/google-vision";

/**
 * Server action: OCR a base64-encoded image.
 * Returns the extracted text or an error message.
 */
export async function ocrImage(base64Image: string) {
  const result = await extractTextFromImage(base64Image);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error ?? "OCR failed",
      raw_text: "",
    };
  }

  return {
    success: true as const,
    raw_text: result.raw_text,
  };
}
