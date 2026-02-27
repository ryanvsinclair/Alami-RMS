import {
  runReceiptCorrectionCore,
} from "@/domain/parsers/receipt-correction-core";
import type { ParsedLineItem, ParsedLineProduceMatch } from "@/domain/parsers/receipt";
import type {
  ReceiptCorrectionCoreResult,
  ReceiptCorrectionConfidenceBand,
  ReceiptCorrectionHistoricalPriceHint,
} from "@/domain/parsers/receipt-correction-core";
import type {
  ReceiptCorrectionConfidenceBandCounts,
  ReceiptCorrectionCountMap,
  ReceiptPostOcrCorrectionInput,
  ReceiptPostOcrCorrectionMode,
  ReceiptPostOcrCorrectionResult,
} from "./receipt-correction.contracts";
import { applyProduceLookupToCorrectionLines } from "./receipt-produce-lookup.service";

const RECEIPT_CORRECTION_PARSER_VERSION = "v1.5-rollout-guarded-history-aware";

function createConfidenceBandCounts(): ReceiptCorrectionConfidenceBandCounts {
  return {
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  };
}

function incrementCount(map: ReceiptCorrectionCountMap, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function sameMoney(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= 0.005;
}

function sameProduceMatch(
  a: ParsedLineProduceMatch | null | undefined,
  b: ParsedLineProduceMatch | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return (
    a.display_name === b.display_name &&
    a.commodity === b.commodity &&
    (a.variety ?? null) === (b.variety ?? null) &&
    a.language_code === b.language_code &&
    a.match_method === b.match_method
  );
}

function lineChangedFromInput(original: ParsedLineItem, next: ParsedLineItem): boolean {
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

function rebuildCoreStatsWithProduceLookup(data: {
  inputLines: ParsedLineItem[];
  lines: ReceiptCorrectionCoreResult["lines"];
}): ReceiptCorrectionCoreResult["stats"] {
  const changedLineCount = data.lines.reduce((count, entry, index) => {
    const original = data.inputLines[index];
    if (!original) return count + 1;
    return lineChangedFromInput(original, entry.line) ? count + 1 : count;
  }, 0);
  const correctionActionsApplied = data.lines.reduce(
    (sum, entry) => sum + entry.correction_actions.length,
    0,
  );

  return {
    line_count: data.lines.length,
    changed_line_count: changedLineCount,
    correction_actions_applied: correctionActionsApplied,
  };
}

function summarizeCorrectionCoreObservability(
  core: ReturnType<typeof runReceiptCorrectionCore>,
): {
  tax_flag_counts: ReceiptCorrectionCountMap;
  tax_label_counts: ReceiptCorrectionCountMap;
  parse_confidence_band_counts: ReceiptCorrectionConfidenceBandCounts;
  lines_with_parse_flags_count: number;
  lines_with_correction_actions_count: number;
  parse_flag_counts: ReceiptCorrectionCountMap;
  correction_action_type_counts: ReceiptCorrectionCountMap;
} {
  const parseConfidenceBandCounts = createConfidenceBandCounts();
  const parseFlagCounts: ReceiptCorrectionCountMap = {};
  const correctionActionTypeCounts: ReceiptCorrectionCountMap = {};
  const taxFlagCounts: ReceiptCorrectionCountMap = {};
  const taxLabelCounts: ReceiptCorrectionCountMap = {};
  let linesWithParseFlagsCount = 0;
  let linesWithCorrectionActionsCount = 0;

  for (const line of core.lines) {
    const band = (line.parse_confidence_band ?? "none") as ReceiptCorrectionConfidenceBand;
    parseConfidenceBandCounts[band] += 1;

    if (line.parse_flags.length > 0) {
      linesWithParseFlagsCount += 1;
      for (const flag of line.parse_flags) {
        incrementCount(parseFlagCounts, flag);
      }
    }

    if (line.correction_actions.length > 0) {
      linesWithCorrectionActionsCount += 1;
      for (const action of line.correction_actions) {
        incrementCount(correctionActionTypeCounts, action.type);
      }
    }
  }

  for (const flag of core.tax_interpretation.flags) {
    incrementCount(taxFlagCounts, flag);
  }
  for (const [label, count] of Object.entries(core.tax_interpretation.detected_tax_label_counts)) {
    taxLabelCounts[label] = count;
  }

  return {
    tax_flag_counts: taxFlagCounts,
    tax_label_counts: taxLabelCounts,
    parse_confidence_band_counts: parseConfidenceBandCounts,
    lines_with_parse_flags_count: linesWithParseFlagsCount,
    lines_with_correction_actions_count: linesWithCorrectionActionsCount,
    parse_flag_counts: parseFlagCounts,
    correction_action_type_counts: correctionActionTypeCounts,
  };
}

function summarizeHistoricalHintObservability(data: {
  hints: ReceiptCorrectionHistoricalPriceHint[] | undefined;
  core: ReturnType<typeof runReceiptCorrectionCore>;
}): {
  historical_hint_lines_count: number;
  historical_hint_sample_size_total: number;
  historical_hint_max_sample_size: number;
  historical_hint_lines_applied_count: number;
} {
  const hints = data.hints ?? [];
  const hintLines = new Set<number>();
  let sampleTotal = 0;
  let maxSampleSize = 0;

  for (const hint of hints) {
    const lineNumber = Number(hint.line_number);
    const sampleSize = Number(hint.sample_size);
    if (!Number.isFinite(lineNumber) || !Number.isInteger(lineNumber) || lineNumber <= 0) continue;
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) continue;
    hintLines.add(lineNumber);
    sampleTotal += Math.max(1, Math.round(sampleSize));
    maxSampleSize = Math.max(maxSampleSize, Math.max(1, Math.round(sampleSize)));
  }

  let linesAppliedCount = 0;
  for (const line of data.core.lines) {
    if (
      hintLines.has(line.line.line_number) &&
      line.parse_flags.includes("historical_price_signal_available")
    ) {
      linesAppliedCount += 1;
    }
  }

  return {
    historical_hint_lines_count: hintLines.size,
    historical_hint_sample_size_total: sampleTotal,
    historical_hint_max_sample_size: maxSampleSize,
    historical_hint_lines_applied_count: linesAppliedCount,
  };
}

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function parseIntegerEnv(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

type EnforceRolloutGuardResult = {
  effectiveMode: ReceiptPostOcrCorrectionMode;
  status: "not_applicable" | "pass" | "fallback_to_shadow";
  reasonCounts: ReceiptCorrectionCountMap;
};

function evaluateEnforceRolloutGuard(data: {
  requestedMode: ReceiptPostOcrCorrectionMode;
  core: ReceiptCorrectionCoreResult;
  observability: ReturnType<typeof summarizeCorrectionCoreObservability>;
}): EnforceRolloutGuardResult {
  if (data.requestedMode !== "enforce") {
    return {
      effectiveMode: data.requestedMode,
      status: "not_applicable",
      reasonCounts: {},
    };
  }

  const maxLowConfidenceLines = Math.max(
    0,
    parseIntegerEnv(process.env.RECEIPT_CORRECTION_ENFORCE_MAX_LOW_CONFIDENCE_LINES) ?? 0,
  );
  const allowTaxWarn =
    parseBooleanEnv(process.env.RECEIPT_CORRECTION_ENFORCE_ALLOW_TAX_WARN) ?? false;
  const requireTotalsPass =
    parseBooleanEnv(process.env.RECEIPT_CORRECTION_ENFORCE_REQUIRE_TOTALS_PASS) ?? true;

  const reasonCounts: ReceiptCorrectionCountMap = {};
  if (requireTotalsPass && data.core.totals_check.status !== "pass") {
    incrementCount(reasonCounts, "totals_not_pass");
  }
  if (data.observability.parse_confidence_band_counts.low > maxLowConfidenceLines) {
    incrementCount(reasonCounts, "low_parse_confidence_lines_exceed_threshold");
  }
  if (!allowTaxWarn && data.core.tax_interpretation.status === "warn") {
    incrementCount(reasonCounts, "tax_validation_warn");
  }

  if (Object.keys(reasonCounts).length > 0) {
    return {
      effectiveMode: "shadow",
      status: "fallback_to_shadow",
      reasonCounts,
    };
  }

  return {
    effectiveMode: "enforce",
    status: "pass",
    reasonCounts: {},
  };
}

export function getReceiptPostOcrCorrectionMode(): ReceiptPostOcrCorrectionMode {
  const enabledOverride = parseBooleanEnv(process.env.RECEIPT_POST_OCR_CORRECTION_ENABLED);
  if (enabledOverride === false) return "off";

  const rawMode = (process.env.RECEIPT_POST_OCR_CORRECTION_MODE ?? "").trim().toLowerCase();
  if (rawMode === "shadow" || rawMode === "enforce") {
    return rawMode;
  }

  if (enabledOverride === true) {
    return "shadow";
  }

  return "off";
}

/**
 * Feature-level wrapper around the domain correction core.
 * `shadow` mode computes corrections for observability but does not change persisted line values.
 */
export async function runReceiptPostOcrCorrection(
  input: ReceiptPostOcrCorrectionInput,
): Promise<ReceiptPostOcrCorrectionResult> {
  const requestedMode = getReceiptPostOcrCorrectionMode();
  const coreBase = runReceiptCorrectionCore({
    source: input.source,
    lines: input.lines,
    totals: input.totals,
    historical_price_hints: input.historical_price_hints,
  });
  const linesWithProduceLookup = await applyProduceLookupToCorrectionLines(
    coreBase.lines,
    { provinceHint: coreBase.tax_interpretation.province },
  );
  const core: ReceiptCorrectionCoreResult = {
    ...coreBase,
    lines: linesWithProduceLookup,
    stats: rebuildCoreStatsWithProduceLookup({
      inputLines: input.lines,
      lines: linesWithProduceLookup,
    }),
  };
  const observability = summarizeCorrectionCoreObservability(core);
  const historicalHintObservability = summarizeHistoricalHintObservability({
    hints: input.historical_price_hints,
    core,
  });
  const rolloutGuard = evaluateEnforceRolloutGuard({
    requestedMode,
    core,
    observability,
  });

  const correctedLines = core.lines.map((entry) => entry.line);

  return {
    mode: rolloutGuard.effectiveMode,
    lines: rolloutGuard.effectiveMode === "enforce" ? correctedLines : input.lines,
    core,
    summary: {
      parser_version: RECEIPT_CORRECTION_PARSER_VERSION,
      requested_mode: requestedMode,
      mode: rolloutGuard.effectiveMode,
      rollout_guard_status: rolloutGuard.status,
      rollout_guard_reason_counts: rolloutGuard.reasonCounts,
      source: input.source,
      line_count: core.stats.line_count,
      changed_line_count: core.stats.changed_line_count,
      correction_actions_applied: core.stats.correction_actions_applied,
      totals_check_status: core.totals_check.status,
      totals_delta_to_total: core.totals_check.delta_to_total,
      totals_line_sum: core.totals_check.lines_sum,
      tax_validation_status: core.tax_interpretation.status,
      tax_structure: core.tax_interpretation.structure,
      tax_province: core.tax_interpretation.province,
      tax_province_source: core.tax_interpretation.province_source,
      tax_zero_grocery_candidate: core.tax_interpretation.zero_tax_grocery_candidate,
      tax_flag_counts: observability.tax_flag_counts,
      tax_label_counts: observability.tax_label_counts,
      parse_confidence_band_counts: observability.parse_confidence_band_counts,
      lines_with_parse_flags_count: observability.lines_with_parse_flags_count,
      lines_with_correction_actions_count: observability.lines_with_correction_actions_count,
      historical_hint_lines_count: historicalHintObservability.historical_hint_lines_count,
      historical_hint_sample_size_total: historicalHintObservability.historical_hint_sample_size_total,
      historical_hint_max_sample_size: historicalHintObservability.historical_hint_max_sample_size,
      historical_hint_lines_applied_count: historicalHintObservability.historical_hint_lines_applied_count,
      parse_flag_counts: observability.parse_flag_counts,
      correction_action_type_counts: observability.correction_action_type_counts,
    },
  };
}
