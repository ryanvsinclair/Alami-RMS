"use server";

import { createInventoryItem } from "./inventory";
import { resolveBarcode } from "./barcode-resolver";
import { createTransaction } from "./transactions";
import { processReceiptText } from "../modules/receipts";
import { matchText, learnAlias } from "@/core/matching/engine";
import type { UnitType } from "@/lib/generated/prisma/client";

// ============================================================
// Barcode Scan Flow
// ============================================================

export async function ingestByBarcode(data: {
  barcode: string;
  quantity: number;
  unit?: UnitType;
  unit_cost?: number;
  source?: string;
}) {
  const resolution = await resolveBarcode({ barcode: data.barcode });

  if (resolution.status === "resolved_external") {
    // Product found in external database but not in tenant inventory.
    // Return metadata so the UI can offer to create an inventory item.
    return {
      success: false as const,
      error: "external_match" as const,
      metadata: resolution.metadata,
      source: resolution.source,
      confidence: resolution.confidence,
      normalized_barcode: resolution.normalized_barcode,
    };
  }

  if (resolution.status !== "resolved") {
    return { success: false as const, error: "barcode_not_found" as const };
  }

  const item = resolution.item;

  const transaction = await createTransaction({
    inventory_item_id: item.id,
    quantity: data.quantity,
    unit: data.unit ?? item.unit,
    unit_cost: data.unit_cost,
    total_cost:
      data.unit_cost != null ? data.unit_cost * data.quantity : undefined,
    input_method: "barcode",
    source: data.source,
  });

  return { success: true as const, transaction, item };
}

// ============================================================
// Photo Parsing Flow
// ============================================================

export async function ingestByPhoto(data: {
  parsed_text: string; // OCR output from photo
  quantity: number;
  unit: UnitType;
  unit_cost?: number;
  source?: string;
  confirmed_item_id?: string; // if user already picked the match
}) {
  let itemId = data.confirmed_item_id;

  if (!itemId) {
    // Try matching
    const matches = await matchText(data.parsed_text, 3);
    if (matches.length > 0 && matches[0].confidence === "high") {
      itemId = matches[0].inventory_item_id;
    } else {
      return {
        success: false as const,
        error: "match_needed",
        suggestions: matches,
      };
    }
  }

  // Learn the alias
  await learnAlias(itemId, data.parsed_text, "photo");

  const transaction = await createTransaction({
    inventory_item_id: itemId,
    quantity: data.quantity,
    unit: data.unit,
    unit_cost: data.unit_cost,
    total_cost:
      data.unit_cost != null ? data.unit_cost * data.quantity : undefined,
    input_method: "photo",
    source: data.source,
    raw_data: { ocr_text: data.parsed_text },
  });

  return { success: true as const, transaction };
}

// ============================================================
// Manual Entry Flow
// ============================================================

export async function ingestManual(data: {
  inventory_item_id?: string;
  // If creating a new item:
  new_item?: {
    name: string;
    unit: UnitType;
    category_id?: string;
    supplier_id?: string;
  };
  quantity: number;
  unit: UnitType;
  unit_cost?: number;
  source?: string;
  notes?: string;
}) {
  let itemId = data.inventory_item_id;

  // Create new item if needed
  if (!itemId && data.new_item) {
    const newItem = await createInventoryItem(data.new_item);
    itemId = newItem.id;
  }

  if (!itemId) {
    return { success: false as const, error: "no_item_specified" };
  }

  const transaction = await createTransaction({
    inventory_item_id: itemId,
    quantity: data.quantity,
    unit: data.unit,
    unit_cost: data.unit_cost,
    total_cost:
      data.unit_cost != null ? data.unit_cost * data.quantity : undefined,
    input_method: "manual",
    source: data.source,
    notes: data.notes,
  });

  return { success: true as const, transaction };
}

// ============================================================
// Receipt Flow (delegates to receipt pipeline)
// ============================================================

export async function ingestByReceipt(data: {
  raw_text: string;
  supplier_id?: string;
}) {
  const receipt = await processReceiptText(data.raw_text, data.supplier_id);
  return { success: true as const, receipt };
}
