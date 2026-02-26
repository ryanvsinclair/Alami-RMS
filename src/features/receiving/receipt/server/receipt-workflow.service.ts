/**
 * Receipt processing workflow service.
 * Handles the core pipeline: create -> parse -> match -> write line items.
 */

import { prisma } from "@/core/prisma";
import { parseReceiptText } from "@/core/parsers/receipt";
import { resolveReceiptLineMatch } from "@/core/matching/receipt-line";
import { scanReceipt } from "@/modules/receipts/ocr/tabscanner";
import { uploadReceiptImage } from "@/lib/supabase/storage";
import type { ParsedDataSummary, ResolvedLineItem } from "./contracts";
import {
  createReceiptRecord,
  updateReceiptStatus,
  deleteLineItems,
  createLineItem,
  findReceiptWithSupplier,
  findReceiptById,
} from "./receipt.repository";

// ---- Helpers ----------------------------------------------------------

function buildMatchSummary(lines: ResolvedLineItem[]): Pick<
  ParsedDataSummary,
  "line_count" | "matched_count" | "suggested_count" | "unresolved_count"
> {
  return {
    line_count: lines.length,
    matched_count: lines.filter((l) => l.status === "matched").length,
    suggested_count: lines.filter((l) => l.status === "suggested").length,
    unresolved_count: lines.filter((l) => l.status === "unresolved").length,
  };
}

async function resolveAndWriteLineItems(
  receiptId: string,
  lines: ResolvedLineItem[],
  parsedData: ParsedDataSummary,
) {
  await prisma.$transaction(async (tx) => {
    // Delete existing line items (in case of re-parse)
    await deleteLineItems(tx, receiptId);

    // Create new line items
    await Promise.all(
      lines.map((line) => createLineItem(tx, receiptId, line)),
    );

    // Update receipt status and parsed data
    await updateReceiptStatus(tx, receiptId, "review", parsedData as never);
  });
}

// ---- Public API -------------------------------------------------------

/**
 * Create a receipt record from raw data (no OCR).
 */
export async function createReceipt(data: {
  businessId: string;
  imageUrl?: string;
  rawText?: string;
  supplierId?: string;
}) {
  return createReceiptRecord({
    businessId: data.businessId,
    imageUrl: data.imageUrl,
    rawText: data.rawText,
    supplierId: data.supplierId,
    status: data.rawText ? "parsing" : "pending",
  });
}

/**
 * Parse raw OCR text into structured line items and match against inventory.
 * Core receipt processing pipeline (Step 2).
 */
export async function parseAndMatchReceipt(
  receiptId: string,
  businessId: string,
) {
  const receipt = await findReceiptWithSupplier(receiptId, businessId);

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
  const lineItemsWithMatches: ResolvedLineItem[] = await Promise.all(
    parsedLines.map(async (line) => {
      const resolved = await resolveReceiptLineMatch({
        rawText: line.raw_text,
        parsedName: line.parsed_name,
        businessId,
        googlePlaceId: receipt.supplier?.google_place_id,
        profile: "receipt",
      });

      return {
        ...line,
        matched_item_id: resolved.matched_item_id,
        confidence: resolved.confidence,
        status: resolved.status,
      };
    }),
  );

  const summary = buildMatchSummary(lineItemsWithMatches);

  await resolveAndWriteLineItems(receiptId, lineItemsWithMatches, summary);

  return findReceiptById(receiptId, businessId);
}

/**
 * Full pipeline: create receipt from text, parse, and match.
 * Convenience function for the scan receipt flow.
 */
export async function processReceiptText(
  rawText: string,
  businessId: string,
  supplierId?: string,
) {
  const receipt = await createReceipt({
    businessId,
    rawText,
    supplierId,
  });

  return parseAndMatchReceipt(receipt.id, businessId);
}

/**
 * Full pipeline: scan receipt image with TabScanner, create receipt, and match line items.
 * Replaces the ocrImage + processReceiptText two-step flow.
 */
export async function processReceiptImage(
  base64Image: string,
  businessId: string,
  supplierId?: string,
) {
  const supplierGooglePlaceId = supplierId
    ? (
        await prisma.supplier.findFirst({
          where: { id: supplierId, business_id: businessId },
          select: { google_place_id: true },
        })
      )?.google_place_id
    : null;

  // Start OCR and image upload in parallel
  const imagePath = `receipts/${businessId}/${Date.now()}.jpg`;
  const [scanResult, storedPath] = await Promise.all([
    scanReceipt(base64Image),
    uploadReceiptImage(base64Image, imagePath).catch(() => null),
  ]);

  if (!scanResult.success || !scanResult.result) {
    return {
      success: false as const,
      error: scanResult.error ?? "Receipt scan failed",
    };
  }

  const ts = scanResult.result;

  // Build raw text from TabScanner for storage
  const rawTextLines = ts.lineItems.map(
    (li) =>
      `${li.descClean || li.desc}${li.qty > 1 ? ` x${li.qty}` : ""} $${li.lineTotal.toFixed(2)}`,
  );
  if (ts.establishment) rawTextLines.unshift(ts.establishment);
  if (ts.subTotal != null)
    rawTextLines.push(`Subtotal $${ts.subTotal.toFixed(2)}`);
  if (ts.tax != null) rawTextLines.push(`Tax $${ts.tax.toFixed(2)}`);
  if (ts.total != null) rawTextLines.push(`Total $${ts.total.toFixed(2)}`);
  const rawText = rawTextLines.join("\n");

  // Create receipt record with image path
  const receipt = await createReceiptRecord({
    businessId,
    imagePath: storedPath,
    rawText,
    supplierId,
    status: "review",
    parsedData: {
      source: "tabscanner",
      establishment: ts.establishment,
      date: ts.date,
      currency: ts.currency,
      paymentMethod: ts.paymentMethod,
    },
  });

  // Create line items from TabScanner structured data and match against inventory
  const lineItemsWithMatches: ResolvedLineItem[] = await Promise.all(
    ts.lineItems.map(async (tsLine, index) => {
      const resolved = await resolveReceiptLineMatch({
        rawText: tsLine.desc,
        parsedName: tsLine.descClean || tsLine.desc,
        businessId,
        googlePlaceId: supplierGooglePlaceId,
        profile: "receipt",
      });

      const unitPrice =
        tsLine.qty > 0
          ? Math.round((tsLine.lineTotal / tsLine.qty) * 100) / 100
          : tsLine.price;

      return {
        line_number: index + 1,
        raw_text: tsLine.desc,
        parsed_name: tsLine.descClean || tsLine.desc,
        quantity: tsLine.qty || 1,
        unit: "each",
        line_cost: tsLine.lineTotal,
        unit_cost: unitPrice,
        matched_item_id: resolved.matched_item_id,
        confidence: resolved.confidence,
        status: resolved.status,
      };
    }),
  );

  const summary: ParsedDataSummary = {
    source: "tabscanner",
    establishment: ts.establishment,
    ...buildMatchSummary(lineItemsWithMatches),
  };

  await resolveAndWriteLineItems(receipt.id, lineItemsWithMatches, summary);

  const result = await findReceiptById(receipt.id, businessId);
  return { success: true as const, receipt: result };
}
