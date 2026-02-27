import type { ParsedLineItem } from "./receipt";
import { normalizeReceiptProduceLine } from "./receipt-produce-normalization.js";

export type ReceiptCorrectionSource = "parsed_text" | "tabscanner";

export type ReceiptCorrectionConfidenceBand = "high" | "medium" | "low" | "none";
export type ReceiptCorrectionProvinceCode = "ON" | "QC";
export type ReceiptCorrectionProvinceSource =
  | "google_places"
  | "tax_labels"
  | "address_fallback"
  | "none";
export type ReceiptCorrectionTaxStructure =
  | "on_hst"
  | "qc_gst_qst"
  | "gst_only"
  | "qst_only"
  | "generic_tax"
  | "no_tax_line"
  | "unknown";
export type ReceiptCorrectionTaxValidationStatus = "not_evaluated" | "pass" | "warn";

export interface ReceiptCorrectionTaxLineInput {
  label: string;
  amount?: number | null;
  rate_percent?: number | null;
}

export interface ReceiptCorrectionTotalsInput {
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  tax_lines?: ReceiptCorrectionTaxLineInput[] | null;
  province_hint?: ReceiptCorrectionProvinceCode | null;
  province_hint_source?: "google_places" | "manual" | null;
  address_text?: string | null;
}

export interface ReceiptCorrectionHistoricalPriceHint {
  line_number: number;
  reference_line_cost: number;
  reference_unit_cost?: number | null;
  sample_size: number;
  source?: "receipt_line_history" | "item_price_history" | "manual";
}

export interface ReceiptCorrectionAction {
  type: string;
  before: string | number | null;
  after: string | number | null;
  confidence: number;
  reason: string;
}

export interface CorrectedReceiptParsedLine {
  line: ParsedLineItem;
  parse_confidence_score: number | null;
  parse_confidence_band: ReceiptCorrectionConfidenceBand;
  parse_flags: string[];
  correction_actions: ReceiptCorrectionAction[];
}

export interface ReceiptCorrectionTotalsCheck {
  subtotal_printed: number | null;
  tax_printed: number | null;
  total_printed: number | null;
  lines_sum: number | null;
  delta_to_total: number | null;
  status: "not_evaluated" | "pass" | "warn";
  tolerance: number;
  outlier_line_numbers: number[];
}

export interface ReceiptCorrectionTaxInterpretation {
  province: ReceiptCorrectionProvinceCode | null;
  province_source: ReceiptCorrectionProvinceSource;
  structure: ReceiptCorrectionTaxStructure;
  status: ReceiptCorrectionTaxValidationStatus;
  zero_tax_grocery_candidate: boolean;
  detected_tax_labels: string[];
  detected_tax_label_counts: Record<string, number>;
  flags: string[];
  amounts: {
    tax_total_printed: number | null;
    tax_total_from_lines: number | null;
    hst: number | null;
    gst: number | null;
    qst: number | null;
    tps: number | null;
    tvq: number | null;
  };
  expected: {
    on_hst: number | null;
    qc_gst: number | null;
    qc_qst: number | null;
    qc_total: number | null;
  };
  deltas: {
    on_hst: number | null;
    qc_gst: number | null;
    qc_qst: number | null;
    qc_total: number | null;
  };
}

export interface ReceiptCorrectionCoreResult {
  lines: CorrectedReceiptParsedLine[];
  totals_check: ReceiptCorrectionTotalsCheck;
  tax_interpretation: ReceiptCorrectionTaxInterpretation;
  stats: {
    line_count: number;
    changed_line_count: number;
    correction_actions_applied: number;
  };
}

export interface ReceiptCorrectionCoreInput {
  source: ReceiptCorrectionSource;
  lines: ParsedLineItem[];
  totals?: ReceiptCorrectionTotalsInput;
  historical_price_hints?: ReceiptCorrectionHistoricalPriceHint[];
}

const TOTAL_TOLERANCE = 0.05;
const TAX_TOLERANCE = 0.05;
const HIGH_CONFIDENCE_THRESHOLD = 0.92;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.75;
const LOCAL_SELECTION_MARGIN = 0.12;
const MISSING_VALUE_INFERENCE_THRESHOLD = 0.82;
const TOTALS_RECHECK_MIN_SCORE = 0.6;
const TOTALS_RECHECK_MIN_IMPROVEMENT = 0.1;
const MAX_TOTALS_RECHECK_PASSES = 2;
const NON_PURCHASE_LINE_PATTERN =
  /\b(sub\s*total|subtotal|total|tax|hst|gst|pst|qst|change|tender|cash|visa|mastercard|amex|debit|credit|balance|coupon|discount|savings|payment)\b/i;
const ON_HST_RATE = 0.13;
const QC_GST_RATE = 0.05;
const QC_QST_RATE = 0.09975;

type NumericCandidateOrigin =
  | "raw_decimal"
  | "raw_split_decimal"
  | "raw_integer"
  | "inferred_decimal_shift_1"
  | "inferred_decimal_shift_2"
  | "inferred_decimal_shift_3"
  | "inferred_decimal_shift_4";

interface RawNumericHint {
  kind: "decimal" | "split_decimal" | "integer";
  raw_token: string;
  normalized_token: string;
  value: number;
  concatenated_integer_value?: number;
  flags: string[];
}

interface NumericCandidateProposal {
  value: number;
  origin: NumericCandidateOrigin;
  raw_token?: string;
  flags: string[];
  aggressive: boolean;
}

interface LineVariant {
  line: ParsedLineItem;
  local_score: number | null;
  parse_flags: string[];
  correction_actions: ReceiptCorrectionAction[];
  changed: boolean;
  line_cost_origin: NumericCandidateOrigin | "baseline" | null;
  aggressive: boolean;
}

interface LineVariantSet {
  original: ParsedLineItem;
  variants: LineVariant[];
  selected_index: number;
  had_multiple_numeric_candidates: boolean;
}

function normalizeHistoricalPriceHint(
  hint: ReceiptCorrectionHistoricalPriceHint,
): ReceiptCorrectionHistoricalPriceHint | null {
  const lineNumber = Number(hint.line_number);
  const referenceLineCost = Number(hint.reference_line_cost);
  const sampleSize = Number(hint.sample_size);
  const referenceUnitCost =
    hint.reference_unit_cost == null ? null : Number(hint.reference_unit_cost);

  if (
    !Number.isFinite(lineNumber) ||
    !Number.isInteger(lineNumber) ||
    lineNumber <= 0 ||
    !Number.isFinite(referenceLineCost) ||
    referenceLineCost <= 0 ||
    !Number.isFinite(sampleSize) ||
    sampleSize < 1
  ) {
    return null;
  }

  return {
    line_number: lineNumber,
    reference_line_cost: roundCurrency(referenceLineCost),
    reference_unit_cost:
      referenceUnitCost == null || !Number.isFinite(referenceUnitCost) || referenceUnitCost <= 0
        ? null
        : roundCurrency(referenceUnitCost),
    sample_size: Math.max(1, Math.round(sampleSize)),
    source: hint.source,
  };
}

function buildHistoricalPriceHintMap(
  hints: ReceiptCorrectionHistoricalPriceHint[] | undefined,
): Map<number, ReceiptCorrectionHistoricalPriceHint> {
  const map = new Map<number, ReceiptCorrectionHistoricalPriceHint>();
  if (!hints || hints.length === 0) return map;

  for (const rawHint of hints) {
    const hint = normalizeHistoricalPriceHint(rawHint);
    if (!hint) continue;

    const existing = map.get(hint.line_number);
    if (!existing || hint.sample_size > existing.sample_size) {
      map.set(hint.line_number, hint);
    }
  }

  return map;
}

interface TotalsRecheckDecision {
  selected_indices: number[];
  outlier_line_numbers: number[];
  totals_selected_line_numbers: number[];
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(3));
}

function toConfidenceBand(score: number | null): ReceiptCorrectionConfidenceBand {
  if (score == null) return "none";
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

function sameMoney(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(roundCurrency(a) - roundCurrency(b)) < 0.005;
}

function sameProduceMatch(
  a: ParsedLineItem["produce_match"] | null | undefined,
  b: ParsedLineItem["produce_match"] | null | undefined,
): boolean {
  const left = a ?? null;
  const right = b ?? null;
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return (
    left.display_name === right.display_name &&
    left.commodity === right.commodity &&
    left.variety === right.variety &&
    left.language_code === right.language_code &&
    left.match_method === right.match_method
  );
}

function incrementCountMap(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function normalizeTaxLabelKey(label: string): string {
  const compact = label.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (compact.includes("hst")) return "hst";
  if (compact.includes("gst")) return "gst";
  if (compact.includes("qst")) return "qst";
  if (compact.includes("tps")) return "tps";
  if (compact.includes("tvq")) return "tvq";
  if (compact.includes("tax")) return "tax";
  return "other";
}

function sumMoney(values: Array<number | null | undefined>): number | null {
  const normalized = values
    .map((value) => (value == null ? null : Number(value)))
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (normalized.length === 0) return null;
  return roundCurrency(normalized.reduce((sum, value) => sum + value, 0));
}

function deriveProvinceFromAddressText(
  addressText: string | null | undefined,
): ReceiptCorrectionProvinceCode | null {
  if (!addressText) return null;

  const normalized = addressText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (/\b(ON|ONTARIO)\b/.test(normalized)) return "ON";
  if (/\b(QC|QUEBEC)\b/.test(normalized)) return "QC";
  return null;
}

function deriveProvinceFromTaxLabels(
  labelCounts: Record<string, number>,
): ReceiptCorrectionProvinceCode | null {
  const hstCount = labelCounts.hst ?? 0;
  const qstLikeCount = (labelCounts.qst ?? 0) + (labelCounts.tvq ?? 0);
  const gstLikeCount = (labelCounts.gst ?? 0) + (labelCounts.tps ?? 0);

  if (qstLikeCount > 0) return "QC";
  if (hstCount > 0 && qstLikeCount === 0) return "ON";
  if (gstLikeCount > 0 && qstLikeCount > 0) return "QC";
  return null;
}

function classifyTaxStructure(input: {
  labelCounts: Record<string, number>;
  taxTotalPrinted: number | null;
  taxLinesCount: number;
}): ReceiptCorrectionTaxStructure {
  const hstCount = input.labelCounts.hst ?? 0;
  const gstLikeCount = (input.labelCounts.gst ?? 0) + (input.labelCounts.tps ?? 0);
  const qstLikeCount = (input.labelCounts.qst ?? 0) + (input.labelCounts.tvq ?? 0);
  const genericTaxCount = input.labelCounts.tax ?? 0;

  if (hstCount > 0) return "on_hst";
  if (gstLikeCount > 0 && qstLikeCount > 0) return "qc_gst_qst";
  if (qstLikeCount > 0) return "qst_only";
  if (gstLikeCount > 0) return "gst_only";
  if (genericTaxCount > 0) return "generic_tax";

  if (input.taxLinesCount === 0 && (input.taxTotalPrinted == null || sameMoney(input.taxTotalPrinted, 0))) {
    return "no_tax_line";
  }

  if (input.taxLinesCount === 0 && input.taxTotalPrinted != null && !sameMoney(input.taxTotalPrinted, 0)) {
    return "generic_tax";
  }

  return "unknown";
}

function isLikelyNonPurchaseLine(line: ParsedLineItem): boolean {
  const text = `${line.raw_text} ${line.parsed_name ?? ""}`;
  return NON_PURCHASE_LINE_PATTERN.test(text);
}

function normalizeTrailingNumericText(rawText: string): { text: string; normalizedOcrChars: boolean } {
  const normalized = rawText.replace(/[Oo](?=(?:[0-9Oo.$%/\-\s]*$))/g, "0");
  return {
    text: normalized,
    normalizedOcrChars: normalized !== rawText,
  };
}

function extractRawNumericHints(rawText: string): RawNumericHint[] {
  const normalized = normalizeTrailingNumericText(rawText.trim());
  const text = normalized.text;
  const hints: RawNumericHint[] = [];

  const sharedFlags = normalized.normalizedOcrChars ? ["ocr_o_to_zero_normalized"] : [];

  const splitMatch = text.match(/(?:^|[^\d])(\d{1,3})\s+(\d{2})\s*$/);
  if (splitMatch) {
    const left = splitMatch[1];
    const right = splitMatch[2];
    const rawToken = `${left} ${right}`;
    const normalizedToken = rawToken;
    const value = roundCurrency(Number.parseFloat(`${left}.${right}`));
    const concatenated = Number.parseInt(`${left}${right}`, 10);
    if (Number.isFinite(value)) {
      hints.push({
        kind: "split_decimal",
        raw_token: rawToken,
        normalized_token: normalizedToken,
        value,
        concatenated_integer_value: Number.isFinite(concatenated) ? concatenated : undefined,
        flags: ["split_numeric_token_detected", ...sharedFlags],
      });
    }
  }

  const decimalMatch = text.match(/(?:^|[^\d])(\d+\.\d{1,2})\s*$/);
  if (decimalMatch) {
    const token = decimalMatch[1];
    const value = roundCurrency(Number.parseFloat(token));
    if (Number.isFinite(value)) {
      hints.push({
        kind: "decimal",
        raw_token: token,
        normalized_token: token,
        value,
        flags: sharedFlags,
      });
    }
  }

  const integerMatch = text.match(/(?:^|[^\d])(\d{2,6})\s*$/);
  if (integerMatch) {
    const token = integerMatch[1];
    const value = Number.parseInt(token, 10);
    if (Number.isFinite(value)) {
      hints.push({
        kind: "integer",
        raw_token: token,
        normalized_token: token,
        value,
        flags: sharedFlags,
      });
    }
  }

  return hints;
}

function pushUniqueNumericProposal(
  proposals: NumericCandidateProposal[],
  proposal: NumericCandidateProposal,
): void {
  const valueKey = proposal.value.toFixed(2);
  const existingIndex = proposals.findIndex((entry) => entry.value.toFixed(2) === valueKey);
  if (existingIndex < 0) {
    proposals.push(proposal);
    return;
  }

  const existing = proposals[existingIndex];
  const rank = (origin: NumericCandidateOrigin) => {
    if (origin === "raw_split_decimal") return 7;
    if (origin === "raw_decimal") return 6;
    if (origin === "inferred_decimal_shift_2") return 5;
    if (origin === "raw_integer") return 4;
    if (origin === "inferred_decimal_shift_1") return 3;
    if (origin === "inferred_decimal_shift_3") return 2;
    return 1;
  };

  if (rank(proposal.origin) > rank(existing.origin)) {
    proposals[existingIndex] = {
      ...proposal,
      flags: Array.from(new Set([...existing.flags, ...proposal.flags])),
    };
    return;
  }

  proposals[existingIndex] = {
    ...existing,
    flags: Array.from(new Set([...existing.flags, ...proposal.flags])),
  };
}

function buildIntegerShiftProposals(
  integerValue: number,
  rawToken: string | undefined,
  inheritedFlags: string[],
): NumericCandidateProposal[] {
  if (!Number.isFinite(integerValue) || !Number.isInteger(integerValue) || integerValue <= 0) {
    return [];
  }

  const digits = String(Math.trunc(integerValue));
  if (digits.length < 2) return [];

  const shifts: Array<{ places: number; origin: NumericCandidateOrigin; aggressive: boolean }> = [
    { places: 2, origin: "inferred_decimal_shift_2", aggressive: false },
    { places: 1, origin: "inferred_decimal_shift_1", aggressive: false },
    { places: 3, origin: "inferred_decimal_shift_3", aggressive: true },
    { places: 4, origin: "inferred_decimal_shift_4", aggressive: true },
  ];

  return shifts
    .filter(({ places }) => digits.length > places)
    .map(({ places, origin, aggressive }) => ({
      value: roundCurrency(integerValue / 10 ** places),
      origin,
      raw_token: rawToken,
      flags: [
        "decimal_inferred",
        "dual_numeric_candidate",
        ...(aggressive ? ["aggressive_decimal_inference"] : []),
        ...inheritedFlags,
      ],
      aggressive,
    }));
}

function buildNumericCandidateProposals(line: ParsedLineItem): NumericCandidateProposal[] {
  const proposals: NumericCandidateProposal[] = [];
  const hints = extractRawNumericHints(line.raw_text);

  for (const hint of hints) {
    if (hint.kind === "decimal") {
      pushUniqueNumericProposal(proposals, {
        value: hint.value,
        origin: "raw_decimal",
        raw_token: hint.raw_token,
        flags: ["raw_numeric_token_detected", ...hint.flags],
        aggressive: false,
      });
      continue;
    }

    if (hint.kind === "split_decimal") {
      pushUniqueNumericProposal(proposals, {
        value: hint.value,
        origin: "raw_split_decimal",
        raw_token: hint.raw_token,
        flags: ["raw_numeric_token_detected", "split_numeric_token_detected", ...hint.flags],
        aggressive: false,
      });

      if (hint.concatenated_integer_value != null) {
        for (const proposal of buildIntegerShiftProposals(
          hint.concatenated_integer_value,
          hint.raw_token,
          hint.flags,
        )) {
          pushUniqueNumericProposal(proposals, proposal);
        }
      }

      continue;
    }

    if (hint.kind === "integer") {
      pushUniqueNumericProposal(proposals, {
        value: roundCurrency(hint.value),
        origin: "raw_integer",
        raw_token: hint.raw_token,
        flags: ["raw_numeric_token_detected", "dual_numeric_candidate", ...hint.flags],
        aggressive: false,
      });
      for (const proposal of buildIntegerShiftProposals(hint.value, hint.raw_token, hint.flags)) {
        pushUniqueNumericProposal(proposals, proposal);
      }
    }
  }

  const existingLineCost = line.line_cost;
  if (
    existingLineCost != null &&
    Number.isFinite(existingLineCost) &&
    Number.isInteger(existingLineCost) &&
    existingLineCost > 0
  ) {
    for (const proposal of buildIntegerShiftProposals(existingLineCost, undefined, [])) {
      pushUniqueNumericProposal(proposals, proposal);
    }
  }

  return proposals.filter((proposal) => Number.isFinite(proposal.value) && proposal.value >= 0);
}

function historicalPlausibilityAdjustment(data: {
  line: ParsedLineItem;
  candidate_line_cost: number;
  hint?: ReceiptCorrectionHistoricalPriceHint | null;
}): number {
  const hint = data.hint;
  if (!hint || hint.sample_size < 2) {
    return 0;
  }

  let adjustment = 0;
  const lineCost = data.candidate_line_cost;
  const lineRef = hint.reference_line_cost;
  const lineDeviation = Math.abs(lineCost - lineRef) / Math.max(lineRef, 0.01);

  if (lineDeviation <= 0.12) adjustment += 0.13;
  else if (lineDeviation <= 0.25) adjustment += 0.08;
  else if (lineDeviation <= 0.45) adjustment += 0.03;
  else if (lineDeviation >= 2.0) adjustment -= 0.28;
  else if (lineDeviation >= 1.0) adjustment -= 0.18;
  else if (lineDeviation >= 0.75) adjustment -= 0.1;

  const qty = data.line.quantity;
  if (hint.reference_unit_cost != null && qty != null && Number.isFinite(qty) && qty > 0) {
    const unitCost = lineCost / qty;
    const unitRef = hint.reference_unit_cost;
    const unitDeviation = Math.abs(unitCost - unitRef) / Math.max(unitRef, 0.01);

    if (unitDeviation <= 0.15) adjustment += 0.06;
    else if (unitDeviation <= 0.3) adjustment += 0.03;
    else if (unitDeviation >= 1.5) adjustment -= 0.08;
    else if (unitDeviation >= 0.9) adjustment -= 0.05;
  }

  const sampleWeight = Math.min(1.15, 0.65 + hint.sample_size * 0.06);
  const weighted = adjustment * sampleWeight;
  return Math.max(-0.35, Math.min(0.22, weighted));
}

function scoreBaselineLine(
  line: ParsedLineItem,
  historicalHint?: ReceiptCorrectionHistoricalPriceHint | null,
): number | null {
  if (line.line_cost == null || !Number.isFinite(line.line_cost)) {
    return null;
  }

  const nonPurchase = isLikelyNonPurchaseLine(line);
  let score = 0.88;
  const value = line.line_cost;

  if (Number.isInteger(value)) {
    if (value > 2000) score = 0.08;
    else if (value > 500) score = 0.28;
    else if (value > 200) score = 0.55;
    else score = 0.82;
  }

  if (value > 1000) score -= 0.2;
  else if (value > 500) score -= 0.1;
  else if (value >= 0.5 && value <= 200) score += 0.05;

  const qty = line.quantity ?? null;
  if (qty != null && Number.isFinite(qty) && qty > 0) {
    const unitPrice = value / qty;
    if (unitPrice >= 0.05 && unitPrice <= 200) score += 0.05;
    else if (unitPrice > 500) score -= 0.15;
  }

  if (line.parsed_name) score += 0.02;
  if (nonPurchase) score = Math.max(score - 0.2, 0.05);

  score += historicalPlausibilityAdjustment({
    line,
    candidate_line_cost: value,
    hint: historicalHint,
  });

  return clamp01(score);
}

function scoreNumericCandidate(
  line: ParsedLineItem,
  proposal: NumericCandidateProposal,
  historicalHint?: ReceiptCorrectionHistoricalPriceHint | null,
): number {
  const nonPurchase = isLikelyNonPurchaseLine(line);
  let score = 0.4;

  switch (proposal.origin) {
    case "raw_decimal":
      score = 0.88;
      break;
    case "raw_split_decimal":
      score = 0.91;
      break;
    case "raw_integer":
      score = 0.4;
      break;
    case "inferred_decimal_shift_2":
      score = 0.68;
      break;
    case "inferred_decimal_shift_1":
      score = 0.56;
      break;
    case "inferred_decimal_shift_3":
      score = 0.49;
      break;
    case "inferred_decimal_shift_4":
      score = 0.42;
      break;
  }

  const value = proposal.value;
  if (value <= 0) score -= 0.3;
  else if (value < 0.25) score -= 0.08;
  else if (value <= 50) score += 0.12;
  else if (value <= 200) score += 0.06;
  else if (value <= 500) score -= 0.06;
  else if (value <= 1000) score -= 0.2;
  else score -= 0.45;

  const qty = line.quantity ?? null;
  if (qty != null && Number.isFinite(qty) && qty > 0) {
    const unitPrice = value / qty;
    if (unitPrice >= 0.05 && unitPrice <= 200) score += 0.05;
    else if (unitPrice > 500) score -= 0.15;
  }

  const original = line.line_cost;
  if (original != null && Number.isFinite(original)) {
    if (Number.isInteger(original) && original > 500 && value <= 200) score += 0.18;
    if (Number.isInteger(original) && original > 2000 && value <= 300) score += 0.12;
    if (proposal.origin === "inferred_decimal_shift_2" && Number.isInteger(original) && original > 500) {
      score += 0.08;
    }
  } else if (proposal.origin === "raw_split_decimal") {
    score += 0.04;
  }

  if (proposal.flags.includes("ocr_o_to_zero_normalized")) score += 0.03;
  if (line.parsed_name) score += 0.02;

  if (nonPurchase && proposal.origin !== "raw_decimal") {
    score -= 0.35;
  }
  if (nonPurchase && proposal.origin === "raw_decimal") {
    score -= 0.1;
  }

  score += historicalPlausibilityAdjustment({
    line,
    candidate_line_cost: value,
    hint: historicalHint,
  });

  return clamp01(score);
}

function recalculateUnitCost(line: ParsedLineItem, lineCost: number | null): number | null {
  if (lineCost == null) return line.unit_cost;
  const qty = line.quantity;
  if (qty == null || !Number.isFinite(qty) || qty <= 0) return line.unit_cost;
  return roundCurrency(lineCost / qty);
}

function buildCorrectionAction(
  line: ParsedLineItem,
  proposal: NumericCandidateProposal,
  score: number,
): ReceiptCorrectionAction {
  let type = "line_cost_correction";
  let reason = "Selected alternate numeric interpretation for line cost.";

  if (proposal.origin === "raw_split_decimal") {
    type = "split_numeric_joined";
    reason = "Joined split trailing numeric token into a decimal currency value.";
  } else if (proposal.origin === "raw_decimal" && line.line_cost == null) {
    type = "line_cost_inferred_from_raw_text";
    reason = "Recovered line cost from trailing decimal token in raw OCR text.";
  } else if (proposal.origin === "raw_integer" && line.line_cost == null) {
    type = "line_cost_inferred_from_raw_text";
    reason = "Recovered trailing integer token as a candidate line cost from raw OCR text.";
  } else if (proposal.origin.startsWith("inferred_decimal_shift_")) {
    type = "decimal_inferred";
    reason = "Inferred decimal placement from integer-like OCR price token.";
  }

  return {
    type,
    before: line.line_cost ?? proposal.raw_token ?? null,
    after: proposal.value,
    confidence: score,
    reason,
  };
}

function buildLineVariantSet(
  line: ParsedLineItem,
  historicalHint?: ReceiptCorrectionHistoricalPriceHint | null,
): LineVariantSet {
  const baselineScore = scoreBaselineLine(line, historicalHint);
  const variants: LineVariant[] = [
    {
      line,
      local_score: baselineScore,
      parse_flags: historicalHint ? ["historical_price_signal_available"] : [],
      correction_actions: [],
      changed: false,
      line_cost_origin: "baseline",
      aggressive: false,
    },
  ];

  const proposals = buildNumericCandidateProposals(line);
  const dedupedProposals = proposals.filter(
    (proposal, index) =>
      !proposals
        .slice(0, index)
        .some((previous) => sameMoney(previous.value, proposal.value)),
  );

  const hadMultipleNumericCandidates = dedupedProposals.length > 1;

  for (const proposal of dedupedProposals) {
    if (sameMoney(line.line_cost, proposal.value)) {
      continue;
    }

    const score = scoreNumericCandidate(line, proposal, historicalHint);
    const nextLineCost = roundCurrency(proposal.value);
    const nextLine: ParsedLineItem = {
      ...line,
      line_cost: nextLineCost,
      unit_cost: recalculateUnitCost(line, nextLineCost),
    };

    const parseFlags = Array.from(
      new Set([
        ...proposal.flags,
        ...(line.line_cost == null ? ["line_cost_inferred"] : []),
        ...(hadMultipleNumericCandidates ? ["dual_numeric_interpretation_considered"] : []),
        ...(historicalHint ? ["historical_price_signal_available"] : []),
      ]),
    );

    variants.push({
      line: nextLine,
      local_score: score,
      parse_flags: parseFlags,
      correction_actions: [buildCorrectionAction(line, proposal, score)],
      changed: true,
      line_cost_origin: proposal.origin,
      aggressive: proposal.aggressive,
    });
  }

  let selectedIndex = 0;
  for (let i = 1; i < variants.length; i += 1) {
    const current = variants[i];
    const selected = variants[selectedIndex];
    const currentScore = current.local_score ?? -1;
    const selectedScore = selected.local_score ?? -1;

    if (currentScore > selectedScore) {
      selectedIndex = i;
      continue;
    }

    if (currentScore === selectedScore && selected.changed && !current.changed) {
      selectedIndex = i;
    }
  }

  if (selectedIndex !== 0) {
    const top = variants[selectedIndex];
    const baseline = variants[0];
    const topScore = top.local_score ?? 0;
    const baselineScoreValue = baseline.local_score ?? 0;
    const margin = topScore - baselineScoreValue;
    const originalMissingLineCost = line.line_cost == null;
    const isAggressive = top.aggressive;

    const canInferMissingValue =
      originalMissingLineCost &&
      topScore >= MISSING_VALUE_INFERENCE_THRESHOLD &&
      margin >= 0.05;

    const canSafelyReplaceExistingValue =
      !originalMissingLineCost &&
      !isAggressive &&
      topScore >= HIGH_CONFIDENCE_THRESHOLD &&
      margin >= LOCAL_SELECTION_MARGIN;

    const aggressiveHistoricalBoost =
      historicalHint && top.line.line_cost != null
        ? historicalPlausibilityAdjustment({
            line,
            candidate_line_cost: top.line.line_cost,
            hint: historicalHint,
          })
        : 0;

    const canAggressiveReplaceExistingValueWithHistory =
      !originalMissingLineCost &&
      isAggressive &&
      topScore >= HIGH_CONFIDENCE_THRESHOLD &&
      margin >= LOCAL_SELECTION_MARGIN + 0.06 &&
      aggressiveHistoricalBoost >= 0.1;

    if (
      !canInferMissingValue &&
      !canSafelyReplaceExistingValue &&
      !canAggressiveReplaceExistingValueWithHistory
    ) {
      selectedIndex = 0;
    }
  }

  return {
    original: line,
    variants,
    selected_index: selectedIndex,
    had_multiple_numeric_candidates: hadMultipleNumericCandidates,
  };
}

function buildTotalsCheck(data: {
  lines: ParsedLineItem[];
  totals?: ReceiptCorrectionTotalsInput;
  outlier_line_numbers?: number[];
}): ReceiptCorrectionTotalsCheck {
  const subtotal = data.totals?.subtotal ?? null;
  const tax = data.totals?.tax ?? null;
  const total = data.totals?.total ?? null;

  const lineCosts = data.lines
    .map((line) => (line.line_cost == null ? null : Number(line.line_cost)))
    .filter((value): value is number => value != null && Number.isFinite(value));

  const linesSum = lineCosts.length > 0 ? roundCurrency(lineCosts.reduce((sum, value) => sum + value, 0)) : null;

  if (total == null || linesSum == null) {
    return {
      subtotal_printed: subtotal,
      tax_printed: tax,
      total_printed: total,
      lines_sum: linesSum,
      delta_to_total: null,
      status: "not_evaluated",
      tolerance: TOTAL_TOLERANCE,
      outlier_line_numbers: data.outlier_line_numbers ?? [],
    };
  }

  const expectedTotal = roundCurrency(linesSum + (tax ?? 0));
  const delta = roundCurrency(expectedTotal - total);

  return {
    subtotal_printed: subtotal,
    tax_printed: tax,
    total_printed: total,
    lines_sum: linesSum,
    delta_to_total: delta,
    status: Math.abs(delta) <= TOTAL_TOLERANCE ? "pass" : "warn",
    tolerance: TOTAL_TOLERANCE,
    outlier_line_numbers: data.outlier_line_numbers ?? [],
  };
}

function buildTaxInterpretation(data: {
  lines: ParsedLineItem[];
  totals?: ReceiptCorrectionTotalsInput;
}): ReceiptCorrectionTaxInterpretation {
  const subtotal = data.totals?.subtotal ?? null;
  const taxTotalPrinted = data.totals?.tax ?? null;
  const total = data.totals?.total ?? null;
  const taxLines = (data.totals?.tax_lines ?? []).filter(
    (line): line is ReceiptCorrectionTaxLineInput => !!line && typeof line.label === "string",
  );

  const labelCounts: Record<string, number> = {};
  const detectedTaxLabels: string[] = [];
  const lineAmountsByKey: Record<string, number[]> = {};

  for (const taxLine of taxLines) {
    const key = normalizeTaxLabelKey(taxLine.label);
    detectedTaxLabels.push(key);
    incrementCountMap(labelCounts, key);

    const amount = taxLine.amount == null ? null : Number(taxLine.amount);
    if (amount != null && Number.isFinite(amount)) {
      if (!lineAmountsByKey[key]) lineAmountsByKey[key] = [];
      lineAmountsByKey[key].push(roundCurrency(amount));
    }
  }

  const hstAmount = sumMoney(lineAmountsByKey.hst ?? []);
  const gstAmount = sumMoney(lineAmountsByKey.gst ?? []);
  const qstAmount = sumMoney(lineAmountsByKey.qst ?? []);
  const tpsAmount = sumMoney(lineAmountsByKey.tps ?? []);
  const tvqAmount = sumMoney(lineAmountsByKey.tvq ?? []);
  const taxTotalFromLines = sumMoney(
    taxLines.map((line) => (line.amount == null ? null : Number(line.amount))),
  );

  let province: ReceiptCorrectionProvinceCode | null = data.totals?.province_hint ?? null;
  let provinceSource: ReceiptCorrectionProvinceSource =
    province != null && data.totals?.province_hint_source === "google_places"
      ? "google_places"
      : "none";

  const labelProvince = deriveProvinceFromTaxLabels(labelCounts);
  const addressProvince = deriveProvinceFromAddressText(data.totals?.address_text ?? null);

  const flags: string[] = [];

  if (province == null && labelProvince != null) {
    province = labelProvince;
    provinceSource = "tax_labels";
  }
  if (province == null && addressProvince != null) {
    province = addressProvince;
    provinceSource = "address_fallback";
  }

  if (province != null && labelProvince != null && province !== labelProvince) {
    flags.push("province_signal_conflict_tax_labels");
  }
  if (province != null && addressProvince != null && province !== addressProvince) {
    flags.push("province_signal_conflict_address_fallback");
  }

  const structure = classifyTaxStructure({
    labelCounts,
    taxTotalPrinted,
    taxLinesCount: taxLines.length,
  });

  const qstCombined = sumMoney([qstAmount, tvqAmount]);
  const gstCombined = sumMoney([gstAmount, tpsAmount]);
  const onExpected = subtotal == null ? null : roundCurrency(subtotal * ON_HST_RATE);
  const qcGstExpected = subtotal == null ? null : roundCurrency(subtotal * QC_GST_RATE);
  const qcQstExpected = subtotal == null ? null : roundCurrency(subtotal * QC_QST_RATE);
  const qcTotalExpected =
    qcGstExpected == null || qcQstExpected == null
      ? null
      : roundCurrency(qcGstExpected + qcQstExpected);

  const effectiveTaxTotal = taxTotalPrinted ?? taxTotalFromLines;

  const zeroTaxGroceryCandidate =
    subtotal != null &&
    total != null &&
    sameMoney(subtotal, total) &&
    (effectiveTaxTotal == null || sameMoney(effectiveTaxTotal, 0)) &&
    taxLines.length === 0 &&
    data.lines.length > 0;

  if (zeroTaxGroceryCandidate) {
    flags.push("zero_tax_subtotal_equals_total_candidate");
  }

  let status: ReceiptCorrectionTaxValidationStatus = "not_evaluated";

  const onDelta =
    onExpected == null || effectiveTaxTotal == null
      ? null
      : roundCurrency(effectiveTaxTotal - onExpected);
  const qcGstDelta =
    qcGstExpected == null || gstCombined == null ? null : roundCurrency(gstCombined - qcGstExpected);
  const qcQstDelta =
    qcQstExpected == null || qstCombined == null ? null : roundCurrency(qstCombined - qcQstExpected);
  const qcTotalDelta =
    qcTotalExpected == null || effectiveTaxTotal == null
      ? null
      : roundCurrency(effectiveTaxTotal - qcTotalExpected);

  if (province === "ON") {
    const qstLikeCount = (labelCounts.qst ?? 0) + (labelCounts.tvq ?? 0);
    const gstLikeCount = (labelCounts.gst ?? 0) + (labelCounts.tps ?? 0);
    const hstCount = labelCounts.hst ?? 0;

    if (qstLikeCount > 0) {
      flags.push("tax_structure_unexpected_for_on");
    }
    if (gstLikeCount > 0 && hstCount === 0) {
      flags.push("gst_only_unexpected_for_on");
    }
    if (taxLines.length > 1 && qstLikeCount === 0 && gstLikeCount === 0 && hstCount > 0) {
      flags.push("multiple_tax_lines_unexpected_for_on");
    }

    if (zeroTaxGroceryCandidate) {
      status = "pass";
    } else if (subtotal != null && effectiveTaxTotal != null) {
      status =
        onDelta != null &&
        Math.abs(onDelta) <= TAX_TOLERANCE &&
        !flags.includes("tax_structure_unexpected_for_on") &&
        !flags.includes("gst_only_unexpected_for_on")
          ? "pass"
          : "warn";
    } else if (subtotal != null && total != null && !zeroTaxGroceryCandidate) {
      status = "warn";
      flags.push("tax_missing_for_on");
    }
  } else if (province === "QC") {
    const hstCount = labelCounts.hst ?? 0;
    const hasGstComponent = gstCombined != null;
    const hasQstComponent = qstCombined != null;

    if (hstCount > 0) {
      flags.push("hst_unexpected_for_qc");
    }
    if (!hasGstComponent || !hasQstComponent) {
      if (!zeroTaxGroceryCandidate) {
        flags.push("missing_qc_tax_components");
      }
    }

    if (zeroTaxGroceryCandidate) {
      status = "pass";
    } else if (subtotal != null && hasGstComponent && hasQstComponent) {
      const gstPass = qcGstDelta != null && Math.abs(qcGstDelta) <= TAX_TOLERANCE;
      const qstPass = qcQstDelta != null && Math.abs(qcQstDelta) <= TAX_TOLERANCE;
      status = gstPass && qstPass && !flags.includes("hst_unexpected_for_qc") ? "pass" : "warn";
    } else if (subtotal != null && effectiveTaxTotal != null) {
      status = "warn";
    }
  } else if (zeroTaxGroceryCandidate) {
    status = "pass";
  }

  if (province == null && taxLines.length > 0) {
    flags.push("province_undetermined");
  }

  return {
    province,
    province_source: provinceSource,
    structure,
    status,
    zero_tax_grocery_candidate: zeroTaxGroceryCandidate,
    detected_tax_labels: detectedTaxLabels,
    detected_tax_label_counts: labelCounts,
    flags: Array.from(new Set(flags)),
    amounts: {
      tax_total_printed: taxTotalPrinted,
      tax_total_from_lines: taxTotalFromLines,
      hst: hstAmount,
      gst: gstAmount,
      qst: qstAmount,
      tps: tpsAmount,
      tvq: tvqAmount,
    },
    expected: {
      on_hst: onExpected,
      qc_gst: qcGstExpected,
      qc_qst: qcQstExpected,
      qc_total: qcTotalExpected,
    },
    deltas: {
      on_hst: onDelta,
      qc_gst: qcGstDelta,
      qc_qst: qcQstDelta,
      qc_total: qcTotalDelta,
    },
  };
}

function runTotalsOutlierRecheck(
  variantSets: LineVariantSet[],
  totals: ReceiptCorrectionTotalsInput | undefined,
): TotalsRecheckDecision {
  const selectedIndices = variantSets.map((set) => set.selected_index);
  const totalsSelectedLineNumbers = new Set<number>();
  const outlierLineNumbers = new Set<number>();

  if (totals?.total == null) {
    return {
      selected_indices: selectedIndices,
      outlier_line_numbers: [],
      totals_selected_line_numbers: [],
    };
  }

  for (let pass = 0; pass < MAX_TOTALS_RECHECK_PASSES; pass += 1) {
    const currentLines = variantSets.map((set, index) => set.variants[selectedIndices[index]].line);
    const totalsCheck = buildTotalsCheck({ lines: currentLines, totals });
    if (totalsCheck.status !== "warn" || totalsCheck.delta_to_total == null) {
      break;
    }

    const currentDelta = totalsCheck.delta_to_total;
    let bestSwap:
      | {
          setIndex: number;
          variantIndex: number;
          improvement: number;
          nextDelta: number;
          score: number;
        }
      | null = null;
    let bestSuspectSetIndex: number | null = null;

    for (let setIndex = 0; setIndex < variantSets.length; setIndex += 1) {
      const set = variantSets[setIndex];
      const currentVariant = set.variants[selectedIndices[setIndex]];
      const currentValue = currentVariant.line.line_cost ?? 0;

      for (let variantIndex = 0; variantIndex < set.variants.length; variantIndex += 1) {
        if (variantIndex === selectedIndices[setIndex]) continue;

        const candidate = set.variants[variantIndex];
        const candidateScore = candidate.local_score ?? 0;
        if (candidateScore < TOTALS_RECHECK_MIN_SCORE) continue;

        if (candidate.aggressive && candidateScore < MEDIUM_CONFIDENCE_THRESHOLD) continue;
        if (!candidate.changed && candidate.line.line_cost == null) continue;

        const nextValue = candidate.line.line_cost ?? 0;
        const nextDelta = roundCurrency(currentDelta + (nextValue - currentValue));
        const improvement = Number(
          (Math.abs(currentDelta) - Math.abs(nextDelta)).toFixed(2),
        );

        if (improvement <= 0) continue;

        if (
          bestSwap == null ||
          improvement > bestSwap.improvement ||
          (improvement === bestSwap.improvement &&
            Math.abs(nextDelta) < Math.abs(bestSwap.nextDelta)) ||
          (improvement === bestSwap.improvement &&
            Math.abs(nextDelta) === Math.abs(bestSwap.nextDelta) &&
            candidateScore > bestSwap.score)
        ) {
          bestSwap = {
            setIndex,
            variantIndex,
            improvement,
            nextDelta,
            score: candidateScore,
          };
        }

        if (bestSuspectSetIndex == null) {
          bestSuspectSetIndex = setIndex;
        }
      }
    }

    if (bestSwap == null) {
      if (bestSuspectSetIndex != null) {
        outlierLineNumbers.add(variantSets[bestSuspectSetIndex].original.line_number);
      }
      break;
    }

    const shouldApply =
      bestSwap.improvement >= TOTALS_RECHECK_MIN_IMPROVEMENT ||
      Math.abs(bestSwap.nextDelta) <= TOTAL_TOLERANCE;

    if (!shouldApply) {
      outlierLineNumbers.add(variantSets[bestSwap.setIndex].original.line_number);
      break;
    }

    selectedIndices[bestSwap.setIndex] = bestSwap.variantIndex;
    const lineNumber = variantSets[bestSwap.setIndex].original.line_number;
    outlierLineNumbers.add(lineNumber);
    totalsSelectedLineNumbers.add(lineNumber);
  }

  return {
    selected_indices: selectedIndices,
    outlier_line_numbers: Array.from(outlierLineNumbers),
    totals_selected_line_numbers: Array.from(totalsSelectedLineNumbers),
  };
}

function lineChanged(original: ParsedLineItem, next: ParsedLineItem): boolean {
  return (
    original.parsed_name !== next.parsed_name ||
    original.quantity !== next.quantity ||
    original.unit !== next.unit ||
    !sameMoney(original.line_cost, next.line_cost) ||
    !sameMoney(original.unit_cost, next.unit_cost) ||
    (original.plu_code ?? null) !== (next.plu_code ?? null) ||
    (original.organic_flag ?? null) !== (next.organic_flag ?? null) ||
    !sameProduceMatch(original.produce_match, next.produce_match)
  );
}

/**
 * Phase 1: numeric sanity and dual-interpretation selection with a guarded totals
 * outlier re-check loop. This remains pure (no DB/history access).
 */
export function runReceiptCorrectionCore(
  input: ReceiptCorrectionCoreInput,
): ReceiptCorrectionCoreResult {
  const historicalHintMap = buildHistoricalPriceHintMap(input.historical_price_hints);
  const variantSets = input.lines.map((line) =>
    buildLineVariantSet(line, historicalHintMap.get(line.line_number) ?? null),
  );
  const totalsRecheck = runTotalsOutlierRecheck(variantSets, input.totals);
  const totalsSelectedLineNumbers = new Set(totalsRecheck.totals_selected_line_numbers);

  const lines = variantSets.map((set, setIndex) => {
    const selected = set.variants[totalsRecheck.selected_indices[setIndex]];
    const produceNormalized = normalizeReceiptProduceLine(selected.line);
    const normalizedLine = produceNormalized.line;
    const changed = lineChanged(set.original, selected.line);

    const baseScore = selected.local_score;
    const boostedScore =
      totalsSelectedLineNumbers.has(set.original.line_number) && baseScore != null
        ? clamp01(baseScore + 0.03)
        : baseScore;

    const parseFlags = Array.from(
      new Set([
        ...selected.parse_flags,
        ...produceNormalized.parse_flags,
        ...(totalsSelectedLineNumbers.has(set.original.line_number)
          ? ["totals_outlier_recheck_selected"]
          : []),
      ]),
    );

    const correctionActions = [...selected.correction_actions];
    for (const correction of produceNormalized.corrections) {
      correctionActions.push({
        type: correction.type,
        before: correction.before,
        after: correction.after,
        confidence: 0.99,
        reason: correction.reason,
      });
    }

    if (totalsSelectedLineNumbers.has(set.original.line_number) && changed) {
      correctionActions.push({
        type: "totals_outlier_recheck",
        before: set.original.line_cost,
        after: selected.line.line_cost,
        confidence: boostedScore ?? selected.local_score ?? 0,
        reason: "Selected alternate line-cost candidate because it improved receipt total consistency.",
      });
    }

    return {
      line: normalizedLine,
      parse_confidence_score: boostedScore,
      parse_confidence_band: toConfidenceBand(boostedScore),
      parse_flags: parseFlags,
      correction_actions: correctionActions,
    };
  });

  const totalsCheck = buildTotalsCheck({
    lines: lines.map((entry) => entry.line),
    totals: input.totals,
    outlier_line_numbers: totalsRecheck.outlier_line_numbers,
  });
  const taxInterpretation = buildTaxInterpretation({
    lines: lines.map((entry) => entry.line),
    totals: input.totals,
  });

  const changedLineCount = lines.filter((entry, index) => lineChanged(input.lines[index], entry.line)).length;
  const correctionActionsApplied = lines.reduce(
    (sum, entry) => sum + entry.correction_actions.length,
    0,
  );

  return {
    lines,
    totals_check: totalsCheck,
    tax_interpretation: taxInterpretation,
    stats: {
      line_count: lines.length,
      changed_line_count: changedLineCount,
      correction_actions_applied: correctionActionsApplied,
    },
  };
}
