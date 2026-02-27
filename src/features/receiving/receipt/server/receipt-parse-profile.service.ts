import type { ReceiptCorrectionProvinceCode } from "@/domain/parsers/receipt-correction-core";
import type { ReceiptPostOcrCorrectionSummary } from "./receipt-correction.contracts";
import {
  findReceiptParseProfileByKey,
  upsertReceiptParseProfile,
} from "./receipt.repository";

const RECEIPT_PARSE_PROFILE_VERSION = 1;
const MIN_PROVINCE_PRIOR_SAMPLE_SIZE = 2;
const MIN_PROVINCE_PRIOR_DOMINANCE_RATIO = 0.6;
const MIN_SKU_POSITION_PRIOR_SAMPLE_SIZE = 2;
const MIN_SKU_POSITION_PRIOR_DOMINANCE_RATIO = 0.6;

type CountMap = Record<string, number>;
type ReviewFeedbackStatus = "confirmed" | "skipped";
export type ReceiptParseProfileSkuPositionHint = "prefix" | "suffix";

type ReceiptParseProfileSignals = {
  source_counts: CountMap;
  province_counts: CountMap;
  province_source_counts: CountMap;
  tax_structure_counts: CountMap;
  tax_validation_status_counts: CountMap;
  tax_label_counts: CountMap;
  tax_flag_counts: CountMap;
  parse_confidence_band_counts: CountMap;
  parse_flag_counts: CountMap;
  correction_action_type_counts: CountMap;
  rollout_guard_reason_counts: CountMap;
};

type ReceiptParseProfileStats = {
  receipts_observed: number;
  lines_observed: number;
  changed_lines_observed: number;
  correction_actions_observed: number;
  confirmed_line_edits: number;
  skipped_line_edits: number;
  last_source: string | null;
  last_tax_structure: string | null;
  last_tax_validation_status: string | null;
  last_receipt_id: string | null;
};

type ReceiptParseProfileRecord = {
  signals: unknown;
  stats: unknown;
  version: number;
};

type ReceiptParseProfileRepository = {
  findByKey: (params: { businessId: string; profileKey: string }) => Promise<ReceiptParseProfileRecord | null>;
  upsert: (params: {
    businessId: string;
    supplierId?: string | null;
    googlePlaceId?: string | null;
    profileKey: string;
    signals: ReceiptParseProfileSignals;
    stats: ReceiptParseProfileStats;
    version: number;
    lastSeenAt?: Date;
  }) => Promise<unknown>;
};

export type ReceiptParseProfileContext = {
  businessId: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
};

export type ReceiptParseProfilePrior = {
  profileKey: string | null;
  provinceHint: ReceiptCorrectionProvinceCode | null;
  skuPositionHint: ReceiptParseProfileSkuPositionHint | null;
};

const defaultRepository: ReceiptParseProfileRepository = {
  findByKey: async ({ businessId, profileKey }) =>
    findReceiptParseProfileByKey({ businessId, profileKey }),
  upsert: async (params) =>
    upsertReceiptParseProfile({
      businessId: params.businessId,
      supplierId: params.supplierId ?? null,
      googlePlaceId: params.googlePlaceId ?? null,
      profileKey: params.profileKey,
      signals: params.signals as never,
      stats: params.stats as never,
      version: params.version,
      lastSeenAt: params.lastSeenAt,
    }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCountMap(value: unknown): CountMap {
  if (!isRecord(value)) return {};
  const out: CountMap = {};
  for (const [key, raw] of Object.entries(value)) {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    out[key] = Math.round(numeric);
  }
  return out;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toPositiveInteger(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric);
}

function normalizeSignals(value: unknown): ReceiptParseProfileSignals {
  const source = isRecord(value) ? value : {};
  return {
    source_counts: normalizeCountMap(source.source_counts),
    province_counts: normalizeCountMap(source.province_counts),
    province_source_counts: normalizeCountMap(source.province_source_counts),
    tax_structure_counts: normalizeCountMap(source.tax_structure_counts),
    tax_validation_status_counts: normalizeCountMap(source.tax_validation_status_counts),
    tax_label_counts: normalizeCountMap(source.tax_label_counts),
    tax_flag_counts: normalizeCountMap(source.tax_flag_counts),
    parse_confidence_band_counts: normalizeCountMap(source.parse_confidence_band_counts),
    parse_flag_counts: normalizeCountMap(source.parse_flag_counts),
    correction_action_type_counts: normalizeCountMap(source.correction_action_type_counts),
    rollout_guard_reason_counts: normalizeCountMap(source.rollout_guard_reason_counts),
  };
}

function normalizeStats(value: unknown): ReceiptParseProfileStats {
  const source = isRecord(value) ? value : {};
  return {
    receipts_observed: toPositiveInteger(source.receipts_observed),
    lines_observed: toPositiveInteger(source.lines_observed),
    changed_lines_observed: toPositiveInteger(source.changed_lines_observed),
    correction_actions_observed: toPositiveInteger(source.correction_actions_observed),
    confirmed_line_edits: toPositiveInteger(source.confirmed_line_edits),
    skipped_line_edits: toPositiveInteger(source.skipped_line_edits),
    last_source: toNullableString(source.last_source),
    last_tax_structure: toNullableString(source.last_tax_structure),
    last_tax_validation_status: toNullableString(source.last_tax_validation_status),
    last_receipt_id: toNullableString(source.last_receipt_id),
  };
}

function mergeCountMap(target: CountMap, incoming: CountMap): void {
  for (const [key, value] of Object.entries(incoming)) {
    if (!Number.isFinite(value) || value <= 0) continue;
    target[key] = (target[key] ?? 0) + Math.round(value);
  }
}

function incrementCount(map: CountMap, key: string): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

function applyCorrectionSummaryToProfile(data: {
  summary: ReceiptPostOcrCorrectionSummary;
  signals: ReceiptParseProfileSignals;
  stats: ReceiptParseProfileStats;
  receiptId?: string;
}): void {
  const { summary, signals, stats } = data;

  incrementCount(signals.source_counts, summary.source);
  incrementCount(signals.tax_structure_counts, summary.tax_structure);
  incrementCount(signals.tax_validation_status_counts, summary.tax_validation_status);
  incrementCount(signals.province_source_counts, summary.tax_province_source);
  if (summary.tax_province) {
    incrementCount(signals.province_counts, summary.tax_province);
  }
  mergeCountMap(signals.tax_label_counts, summary.tax_label_counts);
  mergeCountMap(signals.tax_flag_counts, summary.tax_flag_counts);
  mergeCountMap(signals.parse_confidence_band_counts, summary.parse_confidence_band_counts);
  mergeCountMap(signals.parse_flag_counts, summary.parse_flag_counts);
  mergeCountMap(signals.correction_action_type_counts, summary.correction_action_type_counts);
  mergeCountMap(signals.rollout_guard_reason_counts, summary.rollout_guard_reason_counts);

  stats.receipts_observed += 1;
  stats.lines_observed += Math.max(0, Math.round(summary.line_count));
  stats.changed_lines_observed += Math.max(0, Math.round(summary.changed_line_count));
  stats.correction_actions_observed += Math.max(0, Math.round(summary.correction_actions_applied));
  stats.last_source = summary.source;
  stats.last_tax_structure = summary.tax_structure;
  stats.last_tax_validation_status = summary.tax_validation_status;
  if (data.receiptId) {
    stats.last_receipt_id = data.receiptId;
  }
}

export function buildReceiptParseProfileKey(data: {
  supplierId?: string | null;
  googlePlaceId?: string | null;
}): string | null {
  const placeId = data.googlePlaceId?.trim();
  if (placeId) return `place:${placeId}`;

  const supplierId = data.supplierId?.trim();
  if (supplierId) return `supplier:${supplierId}`;

  return null;
}

export function deriveProvinceHintFromProfileSignals(
  signals: unknown,
): ReceiptCorrectionProvinceCode | null {
  const provinceCounts = normalizeSignals(signals).province_counts;
  const onCount = provinceCounts.ON ?? 0;
  const qcCount = provinceCounts.QC ?? 0;
  const total = onCount + qcCount;
  if (total < MIN_PROVINCE_PRIOR_SAMPLE_SIZE) return null;

  const dominant = onCount >= qcCount ? "ON" : "QC";
  const dominantCount = dominant === "ON" ? onCount : qcCount;
  const dominanceRatio = dominantCount / total;
  if (dominanceRatio < MIN_PROVINCE_PRIOR_DOMINANCE_RATIO) {
    return null;
  }

  return dominant;
}

export function deriveSkuPositionHintFromProfileSignals(
  signals: unknown,
): ReceiptParseProfileSkuPositionHint | null {
  const parseFlagCounts = normalizeSignals(signals).parse_flag_counts;
  const prefixCount = parseFlagCounts.sku_token_prefix_removed ?? 0;
  const suffixCount = parseFlagCounts.sku_token_suffix_removed ?? 0;
  const total = prefixCount + suffixCount;
  if (total < MIN_SKU_POSITION_PRIOR_SAMPLE_SIZE) return null;

  const dominant = prefixCount >= suffixCount ? "prefix" : "suffix";
  const dominantCount = dominant === "prefix" ? prefixCount : suffixCount;
  const dominanceRatio = dominantCount / total;
  if (dominanceRatio < MIN_SKU_POSITION_PRIOR_DOMINANCE_RATIO) {
    return null;
  }

  return dominant;
}

export async function resolveReceiptParseProfilePrior(
  context: ReceiptParseProfileContext,
  repository: ReceiptParseProfileRepository = defaultRepository,
): Promise<ReceiptParseProfilePrior> {
  const profileKey = buildReceiptParseProfileKey(context);
  if (!profileKey) {
    return { profileKey: null, provinceHint: null, skuPositionHint: null };
  }

  const existing = await repository.findByKey({
    businessId: context.businessId,
    profileKey,
  });
  if (!existing) {
    return { profileKey, provinceHint: null, skuPositionHint: null };
  }

  return {
    profileKey,
    provinceHint: deriveProvinceHintFromProfileSignals(existing.signals),
    skuPositionHint: deriveSkuPositionHintFromProfileSignals(existing.signals),
  };
}

export async function recordReceiptParseProfileFromCorrection(data: {
  businessId: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
  receiptId?: string;
  summary: ReceiptPostOcrCorrectionSummary;
  lastSeenAt?: Date;
}, repository: ReceiptParseProfileRepository = defaultRepository): Promise<void> {
  const profileKey = buildReceiptParseProfileKey({
    supplierId: data.supplierId,
    googlePlaceId: data.googlePlaceId,
  });
  if (!profileKey) return;

  const existing = await repository.findByKey({
    businessId: data.businessId,
    profileKey,
  });

  const signals = normalizeSignals(existing?.signals);
  const stats = normalizeStats(existing?.stats);
  applyCorrectionSummaryToProfile({
    summary: data.summary,
    signals,
    stats,
    receiptId: data.receiptId,
  });

  await repository.upsert({
    businessId: data.businessId,
    supplierId: data.supplierId ?? null,
    googlePlaceId: data.googlePlaceId ?? null,
    profileKey,
    signals,
    stats,
    version: Math.max(existing?.version ?? RECEIPT_PARSE_PROFILE_VERSION, RECEIPT_PARSE_PROFILE_VERSION),
    lastSeenAt: data.lastSeenAt,
  });
}

export async function recordReceiptParseProfileLineReviewFeedback(data: {
  businessId: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
  status: ReviewFeedbackStatus;
  lastSeenAt?: Date;
}, repository: ReceiptParseProfileRepository = defaultRepository): Promise<void> {
  const profileKey = buildReceiptParseProfileKey({
    supplierId: data.supplierId,
    googlePlaceId: data.googlePlaceId,
  });
  if (!profileKey) return;

  const existing = await repository.findByKey({
    businessId: data.businessId,
    profileKey,
  });
  if (!existing) return;

  const signals = normalizeSignals(existing.signals);
  const stats = normalizeStats(existing.stats);
  if (data.status === "confirmed") {
    stats.confirmed_line_edits += 1;
  } else if (data.status === "skipped") {
    stats.skipped_line_edits += 1;
  }

  await repository.upsert({
    businessId: data.businessId,
    supplierId: data.supplierId ?? null,
    googlePlaceId: data.googlePlaceId ?? null,
    profileKey,
    signals,
    stats,
    version: Math.max(existing.version ?? RECEIPT_PARSE_PROFILE_VERSION, RECEIPT_PARSE_PROFILE_VERSION),
    lastSeenAt: data.lastSeenAt,
  });
}
