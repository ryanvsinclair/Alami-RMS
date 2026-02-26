import {
  runReceiptCorrectionCore,
} from "@/domain/parsers/receipt-correction-core";
import type { ReceiptCorrectionConfidenceBand } from "@/domain/parsers/receipt-correction-core";
import type {
  ReceiptCorrectionConfidenceBandCounts,
  ReceiptCorrectionCountMap,
  ReceiptPostOcrCorrectionInput,
  ReceiptPostOcrCorrectionMode,
  ReceiptPostOcrCorrectionResult,
} from "./receipt-correction.contracts";

const RECEIPT_CORRECTION_PARSER_VERSION = "v1-numeric-sanity-dual-interpretation";

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

function summarizeCorrectionCoreObservability(
  core: ReturnType<typeof runReceiptCorrectionCore>,
): {
  parse_confidence_band_counts: ReceiptCorrectionConfidenceBandCounts;
  lines_with_parse_flags_count: number;
  lines_with_correction_actions_count: number;
  parse_flag_counts: ReceiptCorrectionCountMap;
  correction_action_type_counts: ReceiptCorrectionCountMap;
} {
  const parseConfidenceBandCounts = createConfidenceBandCounts();
  const parseFlagCounts: ReceiptCorrectionCountMap = {};
  const correctionActionTypeCounts: ReceiptCorrectionCountMap = {};
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

  return {
    parse_confidence_band_counts: parseConfidenceBandCounts,
    lines_with_parse_flags_count: linesWithParseFlagsCount,
    lines_with_correction_actions_count: linesWithCorrectionActionsCount,
    parse_flag_counts: parseFlagCounts,
    correction_action_type_counts: correctionActionTypeCounts,
  };
}

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
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
  const mode = getReceiptPostOcrCorrectionMode();
  const core = runReceiptCorrectionCore({
    source: input.source,
    lines: input.lines,
    totals: input.totals,
  });
  const observability = summarizeCorrectionCoreObservability(core);

  const correctedLines = core.lines.map((entry) => entry.line);

  return {
    mode,
    lines: mode === "enforce" ? correctedLines : input.lines,
    core,
    summary: {
      parser_version: RECEIPT_CORRECTION_PARSER_VERSION,
      mode,
      source: input.source,
      line_count: core.stats.line_count,
      changed_line_count: core.stats.changed_line_count,
      correction_actions_applied: core.stats.correction_actions_applied,
      totals_check_status: core.totals_check.status,
      totals_delta_to_total: core.totals_check.delta_to_total,
      totals_line_sum: core.totals_check.lines_sum,
      parse_confidence_band_counts: observability.parse_confidence_band_counts,
      lines_with_parse_flags_count: observability.lines_with_parse_flags_count,
      lines_with_correction_actions_count: observability.lines_with_correction_actions_count,
      parse_flag_counts: observability.parse_flag_counts,
      correction_action_type_counts: observability.correction_action_type_counts,
    },
  };
}
