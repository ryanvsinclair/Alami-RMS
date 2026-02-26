import type {
  ReceiptCorrectionCoreResult,
  ReceiptCorrectionConfidenceBand,
  ReceiptCorrectionSource,
  ReceiptCorrectionTotalsInput,
} from "@/domain/parsers/receipt-correction-core";
import type { ParsedLineItem } from "@/domain/parsers/receipt";

export type ReceiptPostOcrCorrectionMode = "off" | "shadow" | "enforce";
export type ReceiptCorrectionCountMap = Record<string, number>;
export type ReceiptCorrectionConfidenceBandCounts = Record<ReceiptCorrectionConfidenceBand, number>;

export interface ReceiptPostOcrCorrectionInput {
  businessId: string;
  receiptId?: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
  source: ReceiptCorrectionSource;
  lines: ParsedLineItem[];
  totals?: ReceiptCorrectionTotalsInput;
}

export interface ReceiptPostOcrCorrectionSummary {
  parser_version: string;
  mode: ReceiptPostOcrCorrectionMode;
  source: ReceiptCorrectionSource;
  line_count: number;
  changed_line_count: number;
  correction_actions_applied: number;
  totals_check_status: ReceiptCorrectionCoreResult["totals_check"]["status"];
  totals_delta_to_total: number | null;
  totals_line_sum: number | null;
  parse_confidence_band_counts: ReceiptCorrectionConfidenceBandCounts;
  lines_with_parse_flags_count: number;
  lines_with_correction_actions_count: number;
  parse_flag_counts: ReceiptCorrectionCountMap;
  correction_action_type_counts: ReceiptCorrectionCountMap;
}

export interface ReceiptPostOcrCorrectionResult {
  mode: ReceiptPostOcrCorrectionMode;
  lines: ParsedLineItem[];
  core: ReceiptCorrectionCoreResult;
  summary: ReceiptPostOcrCorrectionSummary;
}
