"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import { parseReceiptText } from "@/lib/parsers/receipt";
import { matchText, learnAlias } from "@/lib/matching/engine";
import { requireRestaurantId } from "@/lib/auth/tenant";

// ============================================================
// Receipt lifecycle actions
// ============================================================

/**
 * Step 1: Create a receipt record from uploaded image.
 * In a real system, this would trigger OCR (Google Vision, etc).
 * For now, accepts raw text directly for the MVP.
 */
export async function createReceipt(data: {
  image_url?: string;
  raw_text?: string;
  supplier_id?: string;
}) {
  const restaurantId = await requireRestaurantId();
  const receipt = await prisma.receipt.create({
    data: {
      restaurant_id: restaurantId,
      image_url: data.image_url,
      raw_text: data.raw_text,
      supplier_id: data.supplier_id,
      status: data.raw_text ? "parsing" : "pending",
    },
  });
  return serialize(receipt);
}

/**
 * Step 2: Parse receipt text into line items and run matching.
 * This is the core receipt processing pipeline.
 */
export async function parseAndMatchReceipt(receiptId: string) {
  const restaurantId = await requireRestaurantId();
  const receipt = await prisma.receipt.findFirstOrThrow({
    where: { id: receiptId, restaurant_id: restaurantId },
  });

  if (!receipt.raw_text) {
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { status: "failed" },
    });
    throw new Error("No raw text available for parsing");
  }

  // Parse raw OCR text into structured line items
  const parsedLines = parseReceiptText(receipt.raw_text);

  // Match each line item against inventory
  const lineItemsWithMatches = await Promise.all(
    parsedLines.map(async (line) => {
      const searchText = line.parsed_name ?? line.raw_text;
      const matches = await matchText(searchText, 1, restaurantId);
      const topMatch = matches[0] ?? null;

      return {
        ...line,
        matched_item_id: topMatch?.inventory_item_id ?? null,
        confidence: topMatch?.confidence ?? "none",
        status: topMatch
          ? topMatch.confidence === "high"
            ? ("matched" as const)
            : topMatch.confidence === "medium"
              ? ("suggested" as const)
              : ("unresolved" as const)
          : ("unresolved" as const),
      };
    })
  );

  // Write line items to database in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing line items (in case of re-parse)
    await tx.receiptLineItem.deleteMany({
      where: { receipt_id: receiptId },
    });

    // Create new line items
    await Promise.all(
      lineItemsWithMatches.map((line) =>
        tx.receiptLineItem.create({
          data: {
            receipt_id: receiptId,
            line_number: line.line_number,
            raw_text: line.raw_text,
            parsed_name: line.parsed_name,
            quantity: line.quantity,
            unit: line.unit,
            line_cost: line.line_cost,
            unit_cost: line.unit_cost,
            matched_item_id: line.matched_item_id,
            confidence: line.confidence,
            status: line.status,
          },
        })
      )
    );

    // Store parsed data trace on receipt
    await tx.receipt.update({
      where: { id: receiptId },
      data: {
        status: "review",
        parsed_data: {
          line_count: lineItemsWithMatches.length,
          matched_count: lineItemsWithMatches.filter(
            (l) => l.status === "matched"
          ).length,
          suggested_count: lineItemsWithMatches.filter(
            (l) => l.status === "suggested"
          ).length,
          unresolved_count: lineItemsWithMatches.filter(
            (l) => l.status === "unresolved"
          ).length,
        },
      },
    });
  });

  return getReceiptWithLineItems(receiptId);
}

/**
 * Step 3: User updates a line item match (confirms, changes, or skips).
 * Also learns the alias if confirmed.
 */
export async function updateLineItemMatch(
  lineItemId: string,
  data: {
    matched_item_id: string | null;
    status: "confirmed" | "skipped";
    quantity?: number;
    unit?: string;
  }
) {
  const restaurantId = await requireRestaurantId();
  const lineExists = await prisma.receiptLineItem.findFirst({
    where: { id: lineItemId, receipt: { restaurant_id: restaurantId } },
    select: { id: true },
  });
  if (!lineExists) {
    throw new Error("Line item not found");
  }
  if (data.matched_item_id) {
    const matchItem = await prisma.inventoryItem.findFirst({
      where: { id: data.matched_item_id, restaurant_id: restaurantId },
      select: { id: true },
    });
    if (!matchItem) {
      throw new Error("Invalid inventory item");
    }
  }

  const lineItem = await prisma.receiptLineItem.update({
    where: { id: lineItemId },
    data: {
      matched_item_id: data.matched_item_id,
      status: data.status,
      quantity: data.quantity,
      unit: data.unit as never,
      confidence: data.matched_item_id ? "high" : "none",
    },
  });

  // Learn alias from user correction (FR-6)
  if (data.status === "confirmed" && data.matched_item_id && lineItem.raw_text) {
    await learnAlias(data.matched_item_id, lineItem.raw_text, "receipt");
    if (lineItem.parsed_name) {
      await learnAlias(data.matched_item_id, lineItem.parsed_name, "receipt");
    }
  }

  return serialize(lineItem);
}

// ============================================================
// Queries
// ============================================================

export async function getReceiptWithLineItems(receiptId: string) {
  const restaurantId = await requireRestaurantId();
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, restaurant_id: restaurantId },
    include: {
      supplier: true,
      line_items: {
        orderBy: { line_number: "asc" },
        include: {
          matched_item: true,
        },
      },
    },
  });
  return receipt ? serialize(receipt) : null;
}

export async function getReceipts(status?: string) {
  const restaurantId = await requireRestaurantId();
  const receipts = await prisma.receipt.findMany({
    where: status
      ? { restaurant_id: restaurantId, status: status as never }
      : { restaurant_id: restaurantId },
    orderBy: { created_at: "desc" },
    include: {
      supplier: true,
      _count: { select: { line_items: true } },
    },
  });
  return serialize(receipts);
}

/**
 * Full pipeline: create receipt from text, parse, and match.
 * Convenience function for the scan receipt flow.
 */
export async function processReceiptText(
  rawText: string,
  supplierId?: string
) {
  const receipt = await createReceipt({
    raw_text: rawText,
    supplier_id: supplierId,
  });

  return parseAndMatchReceipt(receipt.id);
}
