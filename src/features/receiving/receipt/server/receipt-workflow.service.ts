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

const RECEIPT_MATCH_METRICS_LOG_EVERY_RECEIPTS = 10;
const RECEIPT_MATCH_METRICS_LOG_INTERVAL_MS = 5 * 60 * 1000;

type ReceiptMatchMetricsSource = "parsed_text" | "tabscanner";

type ReceiptMatchMetricsState = {
  started_at_ms: number;
  last_emitted_at_ms: number;
  receipts_since_last_emit: number;
  receipts_processed: number;
  receipts_with_only_matched_lines: number;
  receipts_with_any_suggested_lines: number;
  receipts_with_any_unresolved_lines: number;
  source_counts: Record<ReceiptMatchMetricsSource, number>;
  line_totals: {
    line_count: number;
    matched_count: number;
    suggested_count: number;
    unresolved_count: number;
  };
};

function createReceiptMatchMetricsState(): ReceiptMatchMetricsState {
  const startedAt = Date.now();
  return {
    started_at_ms: startedAt,
    last_emitted_at_ms: startedAt,
    receipts_since_last_emit: 0,
    receipts_processed: 0,
    receipts_with_only_matched_lines: 0,
    receipts_with_any_suggested_lines: 0,
    receipts_with_any_unresolved_lines: 0,
    source_counts: {
      parsed_text: 0,
      tabscanner: 0,
    },
    line_totals: {
      line_count: 0,
      matched_count: 0,
      suggested_count: 0,
      unresolved_count: 0,
    },
  };
}

const receiptMatchMetrics = createReceiptMatchMetricsState();

function maybeEmitReceiptMatchMetricsSummary(): void {
  if (process.env.NODE_ENV === "test") return;

  const now = Date.now();
  const shouldEmitByCount =
    receiptMatchMetrics.receipts_since_last_emit >= RECEIPT_MATCH_METRICS_LOG_EVERY_RECEIPTS;
  const shouldEmitByTime =
    now - receiptMatchMetrics.last_emitted_at_ms >= RECEIPT_MATCH_METRICS_LOG_INTERVAL_MS;
  if (!shouldEmitByCount && !shouldEmitByTime) return;

  receiptMatchMetrics.last_emitted_at_ms = now;
  receiptMatchMetrics.receipts_since_last_emit = 0;

  const lineTotal = receiptMatchMetrics.line_totals.line_count;
  const matchedTotal = receiptMatchMetrics.line_totals.matched_count;
  const receiptsProcessed = receiptMatchMetrics.receipts_processed;

  console.info("[receipt-match-metrics] summary", {
    uptime_ms: Math.max(0, now - receiptMatchMetrics.started_at_ms),
    receipts_processed: receiptsProcessed,
    source_counts: receiptMatchMetrics.source_counts,
    line_totals: receiptMatchMetrics.line_totals,
    receipts_with_only_matched_lines: receiptMatchMetrics.receipts_with_only_matched_lines,
    receipts_with_any_suggested_lines: receiptMatchMetrics.receipts_with_any_suggested_lines,
    receipts_with_any_unresolved_lines: receiptMatchMetrics.receipts_with_any_unresolved_lines,
    derived_rates: {
      receipt_auto_resolution_rate:
        receiptsProcessed > 0
          ? Number(
              (
                receiptMatchMetrics.receipts_with_only_matched_lines / receiptsProcessed
              ).toFixed(4),
            )
          : null,
      line_auto_resolution_rate:
        lineTotal > 0 ? Number((matchedTotal / lineTotal).toFixed(4)) : null,
      line_unresolved_ratio:
        lineTotal > 0
          ? Number((receiptMatchMetrics.line_totals.unresolved_count / lineTotal).toFixed(4))
          : null,
    },
  });
}

function recordReceiptMatchMetrics(data: {
  source: ReceiptMatchMetricsSource;
  summary: Pick<
    ParsedDataSummary,
    "line_count" | "matched_count" | "suggested_count" | "unresolved_count"
  >;
}): void {
  receiptMatchMetrics.receipts_processed += 1;
  receiptMatchMetrics.receipts_since_last_emit += 1;
  receiptMatchMetrics.source_counts[data.source] += 1;
  receiptMatchMetrics.line_totals.line_count += data.summary.line_count;
  receiptMatchMetrics.line_totals.matched_count += data.summary.matched_count;
  receiptMatchMetrics.line_totals.suggested_count += data.summary.suggested_count;
  receiptMatchMetrics.line_totals.unresolved_count += data.summary.unresolved_count;

  if (
    data.summary.line_count > 0 &&
    data.summary.suggested_count === 0 &&
    data.summary.unresolved_count === 0 &&
    data.summary.matched_count === data.summary.line_count
  ) {
    receiptMatchMetrics.receipts_with_only_matched_lines += 1;
  }
  if (data.summary.suggested_count > 0) {
    receiptMatchMetrics.receipts_with_any_suggested_lines += 1;
  }
  if (data.summary.unresolved_count > 0) {
    receiptMatchMetrics.receipts_with_any_unresolved_lines += 1;
  }

  maybeEmitReceiptMatchMetricsSummary();
}

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
  recordReceiptMatchMetrics({
    source: "parsed_text",
    summary,
  });

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
  recordReceiptMatchMetrics({
    source: "tabscanner",
    summary,
  });

  const result = await findReceiptById(receipt.id, businessId);
  return { success: true as const, receipt: result };
}
