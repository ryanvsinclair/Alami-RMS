/**
 * Shopping web fallback pairing service.
 * Uses web search to identify barcode items and suggest receipt line pairings.
 */

import { prisma } from "@/server/db/prisma";
import { runConstrainedShoppingProductWebFallback } from "@/modules/shopping/web-fallback";
import type { ShoppingFallbackPhotoAnalysis } from "./contracts";
import {
  toNumber,
  round,
  normalizeSpace,
  mergeResolutionAudit,
  scoreReceiptItemAgainstWebFallback,
} from "./helpers";

export async function suggestShoppingSessionBarcodeReceiptPairWithWebFallback(data: {
  staged_item_id: string;
  photo_analysis?: ShoppingFallbackPhotoAnalysis | null;
  businessId: string;
}) {
  const stagedItem = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: {
      id: data.staged_item_id,
      session: { business_id: data.businessId },
    },
    select: {
      id: true,
      session_id: true,
      origin: true,
      raw_name: true,
      quantity: true,
      staged_line_total: true,
      scanned_barcode: true,
      inventory_item_id: true,
      resolution_audit: true,
      session: {
        select: {
          receipt_id: true,
          store_name: true,
          status: true,
        },
      },
    },
  });

  if (stagedItem.origin !== "staged") {
    throw new Error("Web fallback applies to staged shopping items only");
  }

  if (!stagedItem.scanned_barcode) {
    throw new Error("Staged item does not have a saved scanned barcode");
  }

  if (!stagedItem.session.receipt_id) {
    throw new Error("Receipt must be scanned before web fallback");
  }

  const unmatchedReceiptItems = await prisma.shoppingSessionItem.findMany({
    where: {
      session_id: stagedItem.session_id,
      origin: "receipt",
      resolution: "pending",
      receipt_line_item_id: { not: null },
    },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      raw_name: true,
      quantity: true,
      receipt_quantity: true,
      receipt_line_total: true,
      receipt_unit_price: true,
      inventory_item_id: true,
      receipt_line_item_id: true,
    },
  });

  if (unmatchedReceiptItems.length === 0) {
    return {
      success: true as const,
      fallback: {
        status: "no_unmatched_receipt_items" as const,
        query: "",
        rationale: "No unmatched receipt items remain for suggestion.",
        web_result: null,
        pair_suggestions: [],
      },
    };
  }

  const photoInfo = data.photo_analysis?.product_info ?? null;
  const photoRawText = data.photo_analysis?.raw_text ?? "";
  const photoProductName =
    photoInfo?.product_name && photoInfo.product_name !== "Unknown Product"
      ? photoInfo.product_name
      : "";
  const photoPackHint =
    [photoInfo?.quantity_description, photoInfo?.weight]
      .map((value) => normalizeSpace(value))
      .filter(Boolean)
      .join(" ")
      .trim() || null;

  const fallback = await runConstrainedShoppingProductWebFallback({
    parsed_item_text: photoProductName || photoRawText || stagedItem.raw_name,
    store_name: stagedItem.session.store_name,
    barcode: stagedItem.scanned_barcode,
    brand_hint: photoInfo?.brand || null,
    pack_size_hint: photoPackHint,
    max_results: 5,
  });

  if (fallback.status !== "ok") {
    await prisma.shoppingSessionItem.update({
      where: { id: stagedItem.id },
      data: {
        resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
          web_fallback: {
            attempted_at: new Date().toISOString(),
            status: fallback.status,
            query: fallback.query,
            rationale: fallback.rationale,
            provider_meta: fallback.provider_meta ?? null,
            from_photo_hints: Boolean(photoInfo || photoRawText),
            unmatched_receipt_item_count: unmatchedReceiptItems.length,
          },
        }),
      },
    });

    return {
      success: true as const,
      fallback: {
        status: fallback.status,
        query: fallback.query,
        rationale: fallback.rationale,
        web_result: fallback,
        pair_suggestions: [] as Array<unknown>,
        auto_apply_eligible: false,
        auto_apply_reason: "No structured web fallback result available.",
      },
    };
  }

  const pairSuggestions = unmatchedReceiptItems
    .map((receiptItem) => {
      const score = scoreReceiptItemAgainstWebFallback({
        receiptItemName: receiptItem.raw_name,
        receiptLineTotal: receiptItem.receipt_line_total,
        receiptQuantity: receiptItem.receipt_quantity ?? receiptItem.quantity,
        stagedLineTotal: stagedItem.staged_line_total,
        stagedQuantity: stagedItem.quantity,
        canonicalName: fallback.structured.canonical_name,
        brand: fallback.structured.brand,
        size: fallback.structured.size,
        webConfidenceScore: fallback.confidence_score,
      });

      let confidence: "low" | "medium" | "high" = "low";
      if (score >= 0.82 && fallback.confidence_score >= 0.62) {
        confidence = "high";
      } else if (score >= 0.62) {
        confidence = "medium";
      }

      return {
        receipt_item_id: receiptItem.id,
        receipt_line_item_id: receiptItem.receipt_line_item_id,
        receipt_name: receiptItem.raw_name,
        receipt_line_total: toNumber(receiptItem.receipt_line_total),
        score: round(score, 3),
        confidence,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const best = pairSuggestions[0] ?? null;
  const second = pairSuggestions[1] ?? null;
  const ambiguous =
    best != null && second != null && best.score - second.score < 0.08;
  const webHighEnough =
    fallback.confidence_label === "high" && fallback.confidence_score >= 0.78;
  const pairHighEnough =
    best != null &&
    best.confidence === "high" &&
    best.score >= 0.9;
  const autoApplyEligible = Boolean(best) && webHighEnough && pairHighEnough && !ambiguous;

  let autoApplyReason = "Requires manual confirmation.";
  if (!best) {
    autoApplyReason = "No receipt pair suggestion available.";
  } else if (ambiguous) {
    autoApplyReason = "Top pair suggestion is too close to the next candidate.";
  } else if (!webHighEnough) {
    autoApplyReason = "Web/AI confidence is below the auto-apply threshold.";
  } else if (!pairHighEnough) {
    autoApplyReason = "Receipt pairing confidence is below the auto-apply threshold.";
  } else {
    autoApplyReason = "Eligible for auto-apply (high web confidence + high receipt pairing confidence).";
  }

  await prisma.shoppingSessionItem.update({
    where: { id: stagedItem.id },
    data: {
      resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
          web_fallback: {
            attempted_at: new Date().toISOString(),
            status: "ok",
            query: fallback.query,
            rationale: fallback.rationale,
            provider_meta: fallback.provider_meta ?? null,
            from_photo_hints: Boolean(photoInfo || photoRawText),
            photo_hint_summary: photoInfo
            ? {
                product_name:
                  photoInfo.product_name && photoInfo.product_name !== "Unknown Product"
                    ? photoInfo.product_name
                    : null,
                brand: photoInfo.brand || null,
                quantity_description: photoInfo.quantity_description || null,
                weight: photoInfo.weight || null,
              }
            : null,
          web_result: {
            confidence_label: fallback.confidence_label,
            confidence_score: fallback.confidence_score,
            structured: fallback.structured,
            candidates: fallback.candidates.slice(0, 3).map((candidate) => ({
              title: candidate.title,
              link: candidate.link,
              snippet: candidate.snippet.slice(0, 220),
            })),
          },
          pair_suggestions: pairSuggestions.slice(0, 5),
          suggested_receipt_item_id:
            best && best.confidence !== "low" && !ambiguous ? best.receipt_item_id : null,
          suggested_confidence: best && !ambiguous ? best.confidence : "low",
          ambiguous,
          auto_apply_eligible: autoApplyEligible,
          auto_apply_reason: autoApplyReason,
        },
      }),
    },
  });

  return {
    success: true as const,
    fallback: {
      status: "ok" as const,
      query: fallback.query,
      rationale: fallback.rationale,
      web_result: {
        confidence_label: fallback.confidence_label,
        confidence_score: fallback.confidence_score,
        structured: fallback.structured,
        candidates: fallback.candidates.slice(0, 3),
      },
      pair_suggestions: pairSuggestions,
      suggested_receipt_item_id:
        best && best.confidence !== "low" && !ambiguous ? best.receipt_item_id : null,
      suggested_confidence: best && !ambiguous ? best.confidence : "low",
      ambiguous,
      auto_apply_eligible: autoApplyEligible,
      auto_apply_reason: autoApplyReason,
    },
  };
}
