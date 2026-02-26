/**
 * Receipt line item update and alias learning service.
 * Handles user corrections to line item matches and learns aliases.
 */

import { prisma } from "@/server/db/prisma";
import { learnAlias } from "@/core/matching/engine";
import { learnReceiptItemAlias } from "@/core/matching/receipt-line";
import { serialize } from "@/core/utils/serialize";
import {
  findLineItemWithReceipt,
  updateLineItem,
} from "./receipt.repository";

/**
 * Update a line item match (confirms, changes, or skips).
 * Also learns the alias if confirmed (FR-6).
 */
export async function updateLineItemMatch(
  lineItemId: string,
  businessId: string,
  data: {
    matched_item_id: string | null;
    status: "confirmed" | "skipped";
    quantity?: number;
    unit?: string;
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

  return serialize(lineItem);
}
