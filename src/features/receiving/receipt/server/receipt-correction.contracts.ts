import type {
  ReceiptCorrectionCoreResult,
  ReceiptCorrectionConfidenceBand,
  ReceiptCorrectionHistoricalPriceHint,
  ReceiptCorrectionProvinceCode,
  ReceiptCorrectionProvinceSource,
  ReceiptCorrectionSource,
  ReceiptCorrectionTaxStructure,
  ReceiptCorrectionTaxValidationStatus,
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
  historical_price_hints?: ReceiptCorrectionHistoricalPriceHint[];
}

export interface ReceiptPostOcrCorrectionSummary {
  parser_version: string;
  requested_mode: ReceiptPostOcrCorrectionMode;
  mode: ReceiptPostOcrCorrectionMode;
  rollout_guard_status: "not_applicable" | "pass" | "fallback_to_shadow";
  rollout_guard_reason_counts: ReceiptCorrectionCountMap;
  source: ReceiptCorrectionSource;
  line_count: number;
  changed_line_count: number;
  correction_actions_applied: number;
  totals_check_status: ReceiptCorrectionCoreResult["totals_check"]["status"];
  totals_delta_to_total: number | null;
  totals_line_sum: number | null;
  tax_validation_status: ReceiptCorrectionTaxValidationStatus;
  tax_structure: ReceiptCorrectionTaxStructure;
  tax_province: ReceiptCorrectionProvinceCode | null;
  tax_province_source: ReceiptCorrectionProvinceSource;
  tax_zero_grocery_candidate: boolean;
  tax_flag_counts: ReceiptCorrectionCountMap;
  tax_label_counts: ReceiptCorrectionCountMap;
  parse_confidence_band_counts: ReceiptCorrectionConfidenceBandCounts;
  lines_with_parse_flags_count: number;
  lines_with_correction_actions_count: number;
  historical_hint_lines_count: number;
  historical_hint_sample_size_total: number;
  historical_hint_max_sample_size: number;
  historical_hint_lines_applied_count: number;
  parse_flag_counts: ReceiptCorrectionCountMap;
  correction_action_type_counts: ReceiptCorrectionCountMap;
}

export interface ReceiptPostOcrCorrectionResult {
  mode: ReceiptPostOcrCorrectionMode;
  lines: ParsedLineItem[];
  core: ReceiptCorrectionCoreResult;
  summary: ReceiptPostOcrCorrectionSummary;
}
