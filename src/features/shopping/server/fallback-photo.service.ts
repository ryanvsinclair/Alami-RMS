/**
 * Shopping photo analysis fallback service.
 * OCR-based product identification for barcode-scanned items.
 */

import { prisma } from "@/core/prisma";
import { extractTextFromImage } from "@/modules/receipts/ocr/google-vision";
import { extractProductInfo } from "@/core/parsers/product-name";
import type { ShoppingFallbackPhotoAnalysis } from "./contracts";
import { normalizeSpace, mergeResolutionAudit } from "./helpers";

export async function analyzeShoppingSessionBarcodeItemPhoto(data: {
  staged_item_id: string;
  base64_image: string;
  businessId: string;
}) {
  const stagedItem = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: {
      id: data.staged_item_id,
      session: { business_id: data.businessId },
    },
    select: {
      id: true,
      origin: true,
      scanned_barcode: true,
      resolution_audit: true,
      session: { select: { receipt_id: true } },
    },
  });

  if (stagedItem.origin !== "staged") {
    throw new Error("Photo fallback can only be used for staged shopping items");
  }

  if (!stagedItem.scanned_barcode) {
    throw new Error("This item does not have a saved scanned barcode");
  }

  if (!stagedItem.session.receipt_id) {
    throw new Error("Receipt must be scanned before photo-assisted fallback");
  }

  const ocr = await extractTextFromImage(data.base64_image);
  if (!ocr.success) {
    return {
      success: false as const,
      error: ocr.error ?? "OCR failed",
      analysis: null as ShoppingFallbackPhotoAnalysis | null,
    };
  }

  let productInfo: Awaited<ReturnType<typeof extractProductInfo>> | null = null;
  try {
    productInfo = await extractProductInfo(ocr.raw_text, ocr.labels, ocr.logos);
  } catch {
    productInfo = null;
  }

  await prisma.shoppingSessionItem.update({
    where: { id: stagedItem.id },
    data: {
      resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
        photo_fallback: {
          analyzed_at: new Date().toISOString(),
          barcode: stagedItem.scanned_barcode,
          ocr_text_excerpt: normalizeSpace(ocr.raw_text).slice(0, 600),
          product_info: productInfo
            ? {
                product_name: productInfo.product_name,
                brand: productInfo.brand,
                category: productInfo.category,
                quantity_description: productInfo.quantity_description,
                weight: productInfo.weight,
              }
            : null,
        },
      }),
    },
  });

  return {
    success: true as const,
    analysis: {
      raw_text: ocr.raw_text,
      product_info: productInfo,
    } satisfies ShoppingFallbackPhotoAnalysis,
  };
}
