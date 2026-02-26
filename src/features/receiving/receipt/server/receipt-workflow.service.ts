/**
 * Receipt processing workflow service.
 * Handles the core pipeline: create -> parse -> match -> write line items.
 */

import { prisma } from "@/server/db/prisma";
import { parseReceiptText } from "@/domain/parsers/receipt";
import type { ParsedLineItem } from "@/domain/parsers/receipt";
import type { ReceiptCorrectionTotalsInput } from "@/domain/parsers/receipt-correction-core";
import { resolveReceiptLineMatch } from "@/server/matching/receipt-line";
import { scanReceipt } from "@/server/integrations/receipts/tabscanner";
import { uploadReceiptImage } from "@/server/storage/supabase/receipt-images";
import type { ParsedDataSummary, ResolvedLineItem } from "./contracts";
import { runReceiptPostOcrCorrection } from "./receipt-correction.service";
import type { ReceiptPostOcrCorrectionSummary } from "./receipt-correction.contracts";
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
const RECEIPT_CORRECTION_METRICS_LOG_EVERY_RECEIPTS = 10;
const RECEIPT_CORRECTION_METRICS_LOG_INTERVAL_MS = 5 * 60 * 1000;

type ReceiptMatchMetricsSource = "parsed_text" | "tabscanner";
type ReceiptCorrectionMetricsSource = "parsed_text" | "tabscanner";

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

type ReceiptCorrectionMetricsState = {
  started_at_ms: number;
  last_emitted_at_ms: number;
  receipts_since_last_emit: number;
  receipts_processed: number;
  source_counts: Record<ReceiptCorrectionMetricsSource, number>;
  mode_counts: Record<"off" | "shadow" | "enforce", number>;
  totals_check_status_counts: Record<"not_evaluated" | "pass" | "warn", number>;
  parse_confidence_band_counts: Record<"high" | "medium" | "low" | "none", number>;
  parse_flag_counts: Record<string, number>;
  correction_action_type_counts: Record<string, number>;
  line_totals: {
    line_count: number;
    changed_line_count: number;
    correction_actions_applied: number;
    lines_with_parse_flags_count: number;
    lines_with_correction_actions_count: number;
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

function createReceiptCorrectionMetricsState(): ReceiptCorrectionMetricsState {
  const startedAt = Date.now();
  return {
    started_at_ms: startedAt,
    last_emitted_at_ms: startedAt,
    receipts_since_last_emit: 0,
    receipts_processed: 0,
    source_counts: {
      parsed_text: 0,
      tabscanner: 0,
    },
    mode_counts: {
      off: 0,
      shadow: 0,
      enforce: 0,
    },
    totals_check_status_counts: {
      not_evaluated: 0,
      pass: 0,
      warn: 0,
    },
    parse_confidence_band_counts: {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    },
    parse_flag_counts: {},
    correction_action_type_counts: {},
    line_totals: {
      line_count: 0,
      changed_line_count: 0,
      correction_actions_applied: 0,
      lines_with_parse_flags_count: 0,
      lines_with_correction_actions_count: 0,
    },
  };
}

const receiptCorrectionMetrics = createReceiptCorrectionMetricsState();

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

function maybeEmitReceiptCorrectionMetricsSummary(): void {
  if (process.env.NODE_ENV === "test") return;

  const now = Date.now();
  const shouldEmitByCount =
    receiptCorrectionMetrics.receipts_since_last_emit >= RECEIPT_CORRECTION_METRICS_LOG_EVERY_RECEIPTS;
  const shouldEmitByTime =
    now - receiptCorrectionMetrics.last_emitted_at_ms >= RECEIPT_CORRECTION_METRICS_LOG_INTERVAL_MS;
  if (!shouldEmitByCount && !shouldEmitByTime) return;

  receiptCorrectionMetrics.last_emitted_at_ms = now;
  receiptCorrectionMetrics.receipts_since_last_emit = 0;

  const lineCount = receiptCorrectionMetrics.line_totals.line_count;
  console.info("[receipt-correction-metrics] summary", {
    uptime_ms: Math.max(0, now - receiptCorrectionMetrics.started_at_ms),
    receipts_processed: receiptCorrectionMetrics.receipts_processed,
    source_counts: receiptCorrectionMetrics.source_counts,
    mode_counts: receiptCorrectionMetrics.mode_counts,
    totals_check_status_counts: receiptCorrectionMetrics.totals_check_status_counts,
    parse_confidence_band_counts: receiptCorrectionMetrics.parse_confidence_band_counts,
    parse_flag_counts: receiptCorrectionMetrics.parse_flag_counts,
    correction_action_type_counts: receiptCorrectionMetrics.correction_action_type_counts,
    line_totals: receiptCorrectionMetrics.line_totals,
    derived_rates: {
      changed_line_ratio:
        lineCount > 0
          ? Number((receiptCorrectionMetrics.line_totals.changed_line_count / lineCount).toFixed(4))
          : null,
      correction_actions_per_line:
        lineCount > 0
          ? Number((receiptCorrectionMetrics.line_totals.correction_actions_applied / lineCount).toFixed(4))
          : null,
      lines_with_parse_flags_ratio:
        lineCount > 0
          ? Number(
              (
                receiptCorrectionMetrics.line_totals.lines_with_parse_flags_count / lineCount
              ).toFixed(4),
            )
          : null,
      low_parse_confidence_ratio:
        lineCount > 0
          ? Number(
              (
                receiptCorrectionMetrics.parse_confidence_band_counts.low / lineCount
              ).toFixed(4),
            )
          : null,
    },
  });
}

function incrementDynamicCount(map: Record<string, number>, key: string, amount = 1): void {
  map[key] = (map[key] ?? 0) + amount;
}

function recordReceiptCorrectionMetrics(data: {
  source: ReceiptCorrectionMetricsSource;
  summary: ReceiptPostOcrCorrectionSummary;
}): void {
  receiptCorrectionMetrics.receipts_processed += 1;
  receiptCorrectionMetrics.receipts_since_last_emit += 1;
  receiptCorrectionMetrics.source_counts[data.source] += 1;
  receiptCorrectionMetrics.mode_counts[data.summary.mode] += 1;
  receiptCorrectionMetrics.totals_check_status_counts[data.summary.totals_check_status] += 1;
  receiptCorrectionMetrics.parse_confidence_band_counts.high +=
    data.summary.parse_confidence_band_counts.high;
  receiptCorrectionMetrics.parse_confidence_band_counts.medium +=
    data.summary.parse_confidence_band_counts.medium;
  receiptCorrectionMetrics.parse_confidence_band_counts.low +=
    data.summary.parse_confidence_band_counts.low;
  receiptCorrectionMetrics.parse_confidence_band_counts.none +=
    data.summary.parse_confidence_band_counts.none;
  receiptCorrectionMetrics.line_totals.line_count += data.summary.line_count;
  receiptCorrectionMetrics.line_totals.changed_line_count += data.summary.changed_line_count;
  receiptCorrectionMetrics.line_totals.correction_actions_applied += data.summary.correction_actions_applied;
  receiptCorrectionMetrics.line_totals.lines_with_parse_flags_count +=
    data.summary.lines_with_parse_flags_count;
  receiptCorrectionMetrics.line_totals.lines_with_correction_actions_count +=
    data.summary.lines_with_correction_actions_count;

  for (const [flag, count] of Object.entries(data.summary.parse_flag_counts)) {
    incrementDynamicCount(receiptCorrectionMetrics.parse_flag_counts, flag, count);
  }
  for (const [actionType, count] of Object.entries(data.summary.correction_action_type_counts)) {
    incrementDynamicCount(receiptCorrectionMetrics.correction_action_type_counts, actionType, count);
  }

  maybeEmitReceiptCorrectionMetricsSummary();
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

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseTrailingAmountFromText(text: string): number | null {
  const match = text.match(/(-?\d[\d,]*)(?:\.(\d{1,2}))?\s*$/);
  if (!match) return null;

  const whole = match[1]?.replace(/,/g, "");
  const fractional = match[2] ?? "";
  const numeric = Number.parseFloat(
    fractional.length > 0 ? `${whole}.${fractional}` : whole,
  );
  if (!Number.isFinite(numeric)) return null;
  return roundCurrency(numeric);
}

function extractRawReceiptTotals(rawText: string): ReceiptCorrectionTotalsInput | undefined {
  let subtotal: number | null = null;
  let tax: number | null = null;
  let total: number | null = null;

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, " ");

    if (/^sub\s*total\b/i.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) subtotal = amount;
      continue;
    }

    if (/^(?:sales\s+)?tax\b/i.test(normalized) || /^(?:gst|hst|pst|qst)\b/i.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) tax = amount;
      continue;
    }

    if (/^(?:grand\s+)?total\b/i.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) total = amount;
      continue;
    }
  }

  if (subtotal == null && tax == null && total == null) {
    return undefined;
  }

  return {
    subtotal,
    tax,
    total,
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
  const rawTextTotals = extractRawReceiptTotals(receipt.raw_text);
  const correction = await runReceiptPostOcrCorrection({
    businessId,
    receiptId,
    supplierId: receipt.supplier_id,
    googlePlaceId: receipt.supplier?.google_place_id,
    source: "parsed_text",
    lines: parsedLines,
    totals: rawTextTotals,
  });

  // Match each line item against inventory
  const lineItemsWithMatches: ResolvedLineItem[] = await Promise.all(
    correction.lines.map(async (line) => {
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

  const summary: ParsedDataSummary = {
    ...buildMatchSummary(lineItemsWithMatches),
    correction: correction.summary,
  };

  await resolveAndWriteLineItems(receiptId, lineItemsWithMatches, summary);
  recordReceiptCorrectionMetrics({
    source: "parsed_text",
    summary: correction.summary,
  });
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

  // Phase 0: normalize TabScanner structured data into parser-like candidates,
  // then pass through the correction layer (observability + future insertion point).
  const tabScannerParsedLines: ParsedLineItem[] = ts.lineItems.map((tsLine, index) => {
    const qty = tsLine.qty || 1;
    const unitPrice =
      qty > 0
        ? Math.round((tsLine.lineTotal / qty) * 100) / 100
        : tsLine.price;

    return {
      line_number: index + 1,
      raw_text: tsLine.desc,
      parsed_name: tsLine.descClean || tsLine.desc || null,
      quantity: qty,
      unit: "each",
      line_cost: tsLine.lineTotal,
      unit_cost: unitPrice,
    };
  });

  const correction = await runReceiptPostOcrCorrection({
    businessId,
    receiptId: receipt.id,
    supplierId,
    googlePlaceId: supplierGooglePlaceId,
    source: "tabscanner",
    lines: tabScannerParsedLines,
    totals: {
      subtotal: ts.subTotal,
      tax: ts.tax,
      total: ts.total,
      currency: ts.currency,
    },
  });

  // Create line items from corrected candidates and match against inventory
  const lineItemsWithMatches: ResolvedLineItem[] = await Promise.all(
    correction.lines.map(async (line) => {
      const resolved = await resolveReceiptLineMatch({
        rawText: line.raw_text,
        parsedName: line.parsed_name,
        businessId,
        googlePlaceId: supplierGooglePlaceId,
        profile: "receipt",
      });

      return {
        line_number: line.line_number,
        raw_text: line.raw_text,
        parsed_name: line.parsed_name,
        quantity: line.quantity,
        unit: line.unit,
        line_cost: line.line_cost,
        unit_cost: line.unit_cost,
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
    correction: correction.summary,
  };

  await resolveAndWriteLineItems(receipt.id, lineItemsWithMatches, summary);
  recordReceiptCorrectionMetrics({
    source: "tabscanner",
    summary: correction.summary,
  });
  recordReceiptMatchMetrics({
    source: "tabscanner",
    summary,
  });

  const result = await findReceiptById(receipt.id, businessId);
  return { success: true as const, receipt: result };
}
