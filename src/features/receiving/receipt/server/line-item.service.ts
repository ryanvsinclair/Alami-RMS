/**
 * Receipt line item update and alias learning service.
 * Handles user corrections to line item matches and learns aliases.
 */

import { prisma } from "@/server/db/prisma";
import { learnAlias } from "@/domain/matching/engine";
import { learnReceiptItemAlias } from "@/server/matching/receipt-line";
import { serialize } from "@/domain/shared/serialize";
import { recordReceiptParseProfileLineReviewFeedback } from "./receipt-parse-profile.service";
import {
  findLineItemWithReceipt,
  updateLineItem,
} from "./receipt.repository";
import type { ReceiptInventoryDecision } from "@/lib/generated/prisma/client";

/**
 * Update a line item match (confirms, changes, or skips).
 * Also learns the alias if confirmed (FR-6).
 */
export async function updateLineItemMatch(
  lineItemId: string,
  businessId: string,
  data: {
    matched_item_id: string | null;
    status: "confirmed" | "skipped" | "unresolved";
    quantity?: number;
    unit?: string;
    inventory_decision?: ReceiptInventoryDecision;
  },
) {
  const lineExists = await findLineItemWithReceipt(lineItemId, businessId);
  if (!lineExists) {
    throw new Error("Line item not found");
  }

  if (data.matched_item_id) {
    const matchItem = await prisma.inventoryItem.findFirst({
      where: { id: data.matched_item_id, business_id: businessId },
      select: { id: true },
    });
    if (!matchItem) {
      throw new Error("Invalid inventory item");
    }
  }

  const lineItem = await updateLineItem(lineItemId, {
    matched_item_id: data.matched_item_id,
    status: data.status,
    quantity: data.quantity,
    unit: data.unit,
    confidence: data.matched_item_id ? "high" : "none",
    inventory_decision: data.inventory_decision,
    inventory_decided_at: data.inventory_decision ? new Date() : undefined,
  });

  // Learn alias from user correction (FR-6)
  if (data.status === "confirmed" && data.matched_item_id && lineItem.raw_text) {
    await learnAlias(data.matched_item_id, lineItem.raw_text, "receipt");
    if (lineItem.parsed_name) {
      await learnAlias(data.matched_item_id, lineItem.parsed_name, "receipt");
    }

    const googlePlaceId = lineExists.receipt?.supplier?.google_place_id;
    if (googlePlaceId) {
      await learnReceiptItemAlias({
        businessId,
        googlePlaceId,
        inventoryItemId: data.matched_item_id,
        rawText: lineItem.raw_text,
        confidence: "high",
      });
      if (lineItem.parsed_name) {
        await learnReceiptItemAlias({
          businessId,
          googlePlaceId,
          inventoryItemId: data.matched_item_id,
          rawText: lineItem.parsed_name,
          confidence: "high",
        });
      }
    }
  }

  if (data.status === "confirmed" || data.status === "skipped") {
    await recordReceiptParseProfileLineReviewFeedback({
      businessId,
      supplierId: lineExists.receipt?.supplier_id ?? null,
      googlePlaceId: lineExists.receipt?.supplier?.google_place_id ?? null,
      status: data.status,
    }).catch((error) => {
      console.warn("[receipt-parse-profile] failed to record line review feedback", {
        business_id: businessId,
        line_item_id: lineItemId,
        status: data.status,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    });
  }

  return serialize(lineItem);
}
