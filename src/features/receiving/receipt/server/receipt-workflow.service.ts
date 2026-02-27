/**
 * Receipt processing workflow service.
 * Handles the core pipeline: create -> parse -> match -> write line items.
 */

import { prisma } from "@/server/db/prisma";
import { parseReceiptText } from "@/domain/parsers/receipt";
import type { ParsedLineItem } from "@/domain/parsers/receipt";
import type {
  ReceiptCorrectionHistoricalPriceHint,
  ReceiptCorrectionProvinceCode,
  ReceiptCorrectionTaxLineInput,
  ReceiptCorrectionTotalsInput,
} from "@/domain/parsers/receipt-correction-core";
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
  findRecentReceiptLinePriceSamples,
  type ReceiptHistoricalLinePriceSample,
} from "./receipt.repository";

const RECEIPT_MATCH_METRICS_LOG_EVERY_RECEIPTS = 10;
const RECEIPT_MATCH_METRICS_LOG_INTERVAL_MS = 5 * 60 * 1000;
const RECEIPT_CORRECTION_METRICS_LOG_EVERY_RECEIPTS = 10;
const RECEIPT_CORRECTION_METRICS_LOG_INTERVAL_MS = 5 * 60 * 1000;
const HISTORICAL_HINT_MIN_SAMPLE_SIZE = 4;
const HISTORICAL_HINT_LOOKBACK_DAYS = 120;
const GOOGLE_PLACE_DETAILS_FIELDS = "address_component,formatted_address";
const SUBTOTAL_LABEL_PATTERN = /^(?:(?:sub|sous)[\s-]*total)\b/i;
const TOTAL_LABEL_PATTERN =
  /^(?:(?:grand[\s-]*)?total(?:\s+(?:due|du|amount|a\s+payer))?|amount\s+due|balance\s+due|montant\s+(?:total|du))\b/i;
const GOOGLE_PLACE_PROVINCE_CACHE = new Map<string, ReceiptCorrectionProvinceCode | null>();

interface GooglePlaceAddressComponent {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

interface GooglePlaceDetailsApiResponse {
  status?: string;
  result?: {
    formatted_address?: string;
    address_components?: GooglePlaceAddressComponent[];
  };
}

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
  historical_hint_totals: {
    hinted_line_count: number;
    hinted_line_applied_count: number;
    sample_size_total: number;
    max_sample_size_seen: number;
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
    historical_hint_totals: {
      hinted_line_count: 0,
      hinted_line_applied_count: 0,
      sample_size_total: 0,
      max_sample_size_seen: 0,
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
    historical_hint_totals: receiptCorrectionMetrics.historical_hint_totals,
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
      historical_hint_line_ratio:
        lineCount > 0
          ? Number(
              (
                receiptCorrectionMetrics.historical_hint_totals.hinted_line_applied_count / lineCount
              ).toFixed(4),
            )
          : null,
      avg_historical_hint_sample_size:
        receiptCorrectionMetrics.historical_hint_totals.hinted_line_count > 0
          ? Number(
              (
                receiptCorrectionMetrics.historical_hint_totals.sample_size_total /
                receiptCorrectionMetrics.historical_hint_totals.hinted_line_count
              ).toFixed(2),
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
  receiptCorrectionMetrics.historical_hint_totals.hinted_line_count +=
    data.summary.historical_hint_lines_count;
  receiptCorrectionMetrics.historical_hint_totals.hinted_line_applied_count +=
    data.summary.historical_hint_lines_applied_count;
  receiptCorrectionMetrics.historical_hint_totals.sample_size_total +=
    data.summary.historical_hint_sample_size_total;
  receiptCorrectionMetrics.historical_hint_totals.max_sample_size_seen = Math.max(
    receiptCorrectionMetrics.historical_hint_totals.max_sample_size_seen,
    data.summary.historical_hint_max_sample_size,
  );

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

function normalizePriceSignalKey(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function medianCurrency(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return roundCurrency(sorted[mid]);
  }
  return roundCurrency((sorted[mid - 1] + sorted[mid]) / 2);
}

function buildHistoricalPriceHintsFromSamples(data: {
  lines: ParsedLineItem[];
  samples: ReceiptHistoricalLinePriceSample[];
}): ReceiptCorrectionHistoricalPriceHint[] {
  const sampleMap = new Map<
    string,
    {
      lineCosts: number[];
      unitCosts: number[];
    }
  >();

  for (const sample of data.samples) {
    const key = normalizePriceSignalKey(sample.parsed_name);
    if (!key) continue;

    const bucket = sampleMap.get(key) ?? { lineCosts: [], unitCosts: [] };
    bucket.lineCosts.push(sample.line_cost);
    if (sample.unit_cost != null) {
      bucket.unitCosts.push(sample.unit_cost);
    }
    sampleMap.set(key, bucket);
  }

  const hints: ReceiptCorrectionHistoricalPriceHint[] = [];

  for (const line of data.lines) {
    const key = normalizePriceSignalKey(line.parsed_name);
    if (!key) continue;

    const bucket = sampleMap.get(key);
    if (!bucket || bucket.lineCosts.length < HISTORICAL_HINT_MIN_SAMPLE_SIZE) continue;

    const referenceLineCost = medianCurrency(bucket.lineCosts);
    if (referenceLineCost == null || referenceLineCost <= 0) continue;

    const referenceUnitCost =
      bucket.unitCosts.length >= 2 ? medianCurrency(bucket.unitCosts) : null;

    hints.push({
      line_number: line.line_number,
      reference_line_cost: referenceLineCost,
      reference_unit_cost: referenceUnitCost,
      sample_size: bucket.lineCosts.length,
      source: "receipt_line_history",
    });
  }

  return hints;
}

async function resolveHistoricalPriceHintsForCorrection(params: {
  businessId: string;
  receiptId?: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
  lines: ParsedLineItem[];
}): Promise<ReceiptCorrectionHistoricalPriceHint[] | undefined> {
  const parsedNames = Array.from(
    new Set(
      params.lines
        .map((line) => line.parsed_name?.trim())
        .filter((name): name is string => !!name && name.length > 0),
    ),
  );

  if (parsedNames.length === 0) {
    return undefined;
  }

  const samples = await findRecentReceiptLinePriceSamples({
    businessId: params.businessId,
    parsedNames,
    excludeReceiptId: params.receiptId,
    supplierId: params.supplierId ?? null,
    googlePlaceId: params.googlePlaceId ?? null,
    take: Math.min(Math.max(parsedNames.length * 50, 120), 900),
    lookbackDays: HISTORICAL_HINT_LOOKBACK_DAYS,
  });

  const hints = buildHistoricalPriceHintsFromSamples({
    lines: params.lines,
    samples,
  });

  return hints.length > 0 ? hints : undefined;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractProvinceCodeFromText(text: string | null | undefined): ReceiptCorrectionProvinceCode | null {
  if (!text) return null;

  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (/\b(ON|ONTARIO)\b/.test(normalized)) return "ON";
  if (/\b(QC|QUEBEC)\b/.test(normalized)) return "QC";
  return null;
}

function extractProvinceCodeFromAddressComponents(
  addressComponents: GooglePlaceAddressComponent[] | undefined,
): ReceiptCorrectionProvinceCode | null {
  if (!addressComponents || addressComponents.length === 0) return null;

  for (const component of addressComponents) {
    if (!Array.isArray(component.types)) continue;
    if (!component.types.includes("administrative_area_level_1")) continue;

    const fromShortName = extractProvinceCodeFromText(component.short_name);
    if (fromShortName) return fromShortName;

    const fromLongName = extractProvinceCodeFromText(component.long_name);
    if (fromLongName) return fromLongName;
  }

  return null;
}

function normalizeTrailingNumericToken(rawToken: string): string | null {
  if (!rawToken) return null;

  const compactSpaces = rawToken
    .replace(/[$€£]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!compactSpaces) return null;

  // OCR often splits decimal values as `9 98`; normalize these first.
  if (/^-?\d+\s+\d{2}$/.test(compactSpaces)) {
    return compactSpaces.replace(/\s+/, ".");
  }

  let compact = compactSpaces.replace(/\s+/g, "");

  // Support both Canadian/US (`1,234.56`) and EU-like (`1.234,56`) shapes.
  if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(compact)) {
    compact = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(compact)) {
    compact = compact.replace(/,/g, "");
  } else if (/^-?\d+,\d{1,2}$/.test(compact)) {
    compact = compact.replace(",", ".");
  } else {
    compact = compact.replace(/,(?=\d{3}(?:\D|$))/g, "");
  }

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(compact)) {
    return null;
  }

  return compact;
}

function parseTrailingAmountFromText(text: string): number | null {
  const match = text.match(/(-?\d(?:[\d,\s]*\d)?(?:[.,]\d{1,2})?)\s*$/);
  if (!match) return null;

  const normalizedToken = normalizeTrailingNumericToken(match[1] ?? "");
  if (!normalizedToken) return null;

  const numeric = Number.parseFloat(normalizedToken);
  if (!Number.isFinite(numeric)) return null;
  return roundCurrency(numeric);
}

function detectTaxLabelFromLine(text: string): string | null {
  if (/\bH\.?\s*S\.?\s*T\b/i.test(text)) return "HST";
  if (/\bQ\.?\s*S\.?\s*T\b/i.test(text)) return "QST";
  if (/\bT\.?\s*V\.?\s*Q\b/i.test(text)) return "TVQ";
  if (/\bG\.?\s*S\.?\s*T\b/i.test(text)) return "GST";
  if (/\bT\.?\s*P\.?\s*S\b/i.test(text)) return "TPS";
  if (/^(?:sales\s+)?tax(?:e)?\b/i.test(text)) return "Tax";
  return null;
}

function resolveGoogleMapsPlacesApiKey(): string | null {
  const candidate = (
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ""
  ).trim();

  return candidate.length > 0 ? candidate : null;
}

async function fetchProvinceCodeFromGooglePlaceDetails(
  googlePlaceId: string,
): Promise<ReceiptCorrectionProvinceCode | null> {
  const apiKey = resolveGoogleMapsPlacesApiKey();
  if (!apiKey) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", googlePlaceId);
    url.searchParams.set("fields", GOOGLE_PLACE_DETAILS_FIELDS);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as GooglePlaceDetailsApiResponse;
    if (!payload || payload.status !== "OK" || !payload.result) return null;

    const fromAddressComponents = extractProvinceCodeFromAddressComponents(
      payload.result.address_components,
    );
    if (fromAddressComponents) return fromAddressComponents;

    return extractProvinceCodeFromText(payload.result.formatted_address);
  } catch {
    return null;
  }
}

async function resolveProvinceHintFromGooglePlaceContext(data: {
  googlePlaceId?: string | null;
  formattedAddress?: string | null;
}): Promise<ReceiptCorrectionProvinceCode | null> {
  const placeId = data.googlePlaceId?.trim();
  if (!placeId) return null;

  if (GOOGLE_PLACE_PROVINCE_CACHE.has(placeId)) {
    return GOOGLE_PLACE_PROVINCE_CACHE.get(placeId) ?? null;
  }

  const province =
    (await fetchProvinceCodeFromGooglePlaceDetails(placeId)) ??
    extractProvinceCodeFromText(data.formattedAddress);

  GOOGLE_PLACE_PROVINCE_CACHE.set(placeId, province);
  return province;
}

function sumTaxLineAmounts(taxLines: ReceiptCorrectionTaxLineInput[]): number | null {
  const amounts = taxLines
    .map((line) => (line.amount == null ? null : Number(line.amount)))
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (amounts.length === 0) return null;
  return roundCurrency(amounts.reduce((sum, amount) => sum + amount, 0));
}

function extractRawReceiptTotals(rawText: string): ReceiptCorrectionTotalsInput | undefined {
  let subtotal: number | null = null;
  let total: number | null = null;
  const taxLines: ReceiptCorrectionTaxLineInput[] = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, " ");

    if (SUBTOTAL_LABEL_PATTERN.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) subtotal = amount;
      continue;
    }

    const taxLabel = detectTaxLabelFromLine(normalized);
    if (taxLabel) {
      const amount = parseTrailingAmountFromText(normalized);
      taxLines.push({ label: taxLabel, amount });
      continue;
    }

    if (TOTAL_LABEL_PATTERN.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) total = amount;
      continue;
    }
  }

  const tax = sumTaxLineAmounts(taxLines);

  if (subtotal == null && tax == null && total == null && taxLines.length === 0) {
    return undefined;
  }

  return {
    subtotal,
    tax,
    total,
    tax_lines: taxLines.length > 0 ? taxLines : undefined,
    address_text: rawText,
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
  const supplierProvinceHint = await resolveProvinceHintFromGooglePlaceContext({
    googlePlaceId: receipt.supplier?.google_place_id ?? null,
    formattedAddress: receipt.supplier?.formatted_address ?? null,
  });
  const historicalPriceHints = await resolveHistoricalPriceHintsForCorrection({
    businessId,
    receiptId,
    supplierId: receipt.supplier_id,
    googlePlaceId: receipt.supplier?.google_place_id ?? null,
    lines: parsedLines,
  });
  const correction = await runReceiptPostOcrCorrection({
    businessId,
    receiptId,
    supplierId: receipt.supplier_id,
    googlePlaceId: receipt.supplier?.google_place_id,
    source: "parsed_text",
    lines: parsedLines,
    historical_price_hints: historicalPriceHints,
    totals:
      rawTextTotals || supplierProvinceHint
        ? {
            ...(rawTextTotals ?? {}),
            ...(supplierProvinceHint
              ? {
                  province_hint: supplierProvinceHint,
                  province_hint_source: "google_places" as const,
                }
              : {}),
          }
        : undefined,
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
  const supplierPlaceContext = supplierId
    ? (
        await prisma.supplier.findFirst({
          where: { id: supplierId, business_id: businessId },
          select: { google_place_id: true, formatted_address: true },
        })
      )
    : null;
  const supplierGooglePlaceId = supplierPlaceContext?.google_place_id ?? null;
  const supplierProvinceHint = await resolveProvinceHintFromGooglePlaceContext({
    googlePlaceId: supplierGooglePlaceId,
    formattedAddress: supplierPlaceContext?.formatted_address ?? null,
  });

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

  const historicalPriceHints = await resolveHistoricalPriceHintsForCorrection({
    businessId,
    receiptId: receipt.id,
    supplierId: supplierId ?? null,
    googlePlaceId: supplierGooglePlaceId,
    lines: tabScannerParsedLines,
  });

  const correction = await runReceiptPostOcrCorrection({
    businessId,
    receiptId: receipt.id,
    supplierId,
    googlePlaceId: supplierGooglePlaceId,
    source: "tabscanner",
    lines: tabScannerParsedLines,
    historical_price_hints: historicalPriceHints,
    totals: {
      subtotal: ts.subTotal,
      tax: ts.tax,
      total: ts.total,
      currency: ts.currency,
      tax_lines: ts.tax != null ? [{ label: "Tax", amount: ts.tax }] : undefined,
      ...(supplierProvinceHint
        ? {
            province_hint: supplierProvinceHint,
            province_hint_source: "google_places" as const,
          }
        : {}),
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
        plu_code: line.plu_code ?? null,
        produce_match: line.produce_match ?? null,
        organic_flag: line.organic_flag ?? null,
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
