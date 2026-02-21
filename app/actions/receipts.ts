"use server";

import { prisma } from "@/lib/prisma";
import { parseReceiptText } from "@/lib/parsers/receipt";
import { matchText, learnAlias } from "@/lib/matching/engine";

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
  return prisma.receipt.create({
    data: {
      image_url: data.image_url,
      raw_text: data.raw_text,
      supplier_id: data.supplier_id,
      status: data.raw_text ? "parsing" : "pending",
    },
  });
}

/**
 * Step 2: Parse receipt text into line items and run matching.
 * This is the core receipt processing pipeline.
 */
export async function parseAndMatchReceipt(receiptId: string) {
  const receipt = await prisma.receipt.findUniqueOrThrow({
    where: { id: receiptId },
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
      const matches = await matchText(searchText, 1);
      const topMatch = matches[0] ?? null;

      return {
        ...line,
        matched_item_id: topMatch?.inventory_item_id ?? null,
        confidence: topMatch?.confidence ?? "none",
        status: topMatch
          ? topMatch.confidence === "high"
            ? ("matched" as const)
            : ("suggested" as const)
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

  return lineItem;
}

// ============================================================
// Queries
// ============================================================

export async function getReceiptWithLineItems(receiptId: string) {
  return prisma.receipt.findUnique({
    where: { id: receiptId },
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
}

export async function getReceipts(status?: string) {
  return prisma.receipt.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { created_at: "desc" },
    include: {
      supplier: true,
      _count: { select: { line_items: true } },
    },
  });
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
