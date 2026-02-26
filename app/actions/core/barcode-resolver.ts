"use server";

import { prisma } from "@/core/prisma";
import {
  getBarcodeProviders,
  type BarcodeProvider,
  type BarcodeProviderId,
  type BarcodeProviderLayer,
  type ExternalProductMetadata,
} from "./barcode-providers";
import { normalizeBarcode } from "@/core/utils/barcode";
import { resolveNormalizedBarcodeWithProviders } from "./barcode-resolver-core";
import {
  buildBarcodeResolutionEventCreateArgs,
  buildResolvedGlobalBarcodeCatalogUpsertArgs,
  buildResolvedExternalGlobalBarcodeCatalogUpsertArgs,
  buildUnresolvedGlobalBarcodeCatalogUpsertArgs,
  getErrorCode,
  isCacheLayerUnavailableError,
  type GlobalBarcodeCatalogRow,
  type MatchConfidenceValue,
  type BarcodeResolutionEventOutcomeValue,
} from "./barcode-resolver-cache";
import type { lookupBarcode } from "./inventory";

type LookupBarcodeResult = Awaited<ReturnType<typeof lookupBarcode>>;

export type BarcodeResolverSource = BarcodeProviderId;
export type BarcodeResolverLayer = BarcodeProviderLayer;

type PrismaBarcodeCacheDelegates = {
  globalBarcodeCatalog: {
    findUnique(args: {
      where: { barcode_normalized: string };
    }): Promise<GlobalBarcodeCatalogRow | null>;
    upsert(args: {
      where: { barcode_normalized: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<GlobalBarcodeCatalogRow>;
  };
  barcodeResolutionEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

let delegateUnavailableCount = 0;
const BARCODE_PROVIDER_METRICS_LOG_EVERY_CALLS = 25;
const BARCODE_PROVIDER_METRICS_LOG_INTERVAL_MS = 5 * 60 * 1000;
const BARCODE_CHURN_WINDOW_MS = 2 * 60 * 1000;
const BARCODE_CHURN_THRESHOLD = 3;
const BARCODE_CHURN_COOLDOWN_MS = 10 * 60 * 1000;
const BARCODE_GLOBAL_EXTERNAL_BURST_WINDOW_MS = 30 * 1000;
const BARCODE_GLOBAL_EXTERNAL_BURST_THRESHOLD = 60;
const BARCODE_GLOBAL_EXTERNAL_BURST_COOLDOWN_MS = 2 * 60 * 1000;
const BARCODE_CHURN_STATE_MAX_KEYS = 1000;
const BARCODE_BACKGROUND_RETRY_MIN_DELAY_MS = 1_000;
const BARCODE_BACKGROUND_RETRY_MAX_DELAY_MS = 24 * 60 * 60 * 1000;
const BARCODE_BACKGROUND_RETRY_DUE_GRACE_MS = 1_500;
const BARCODE_BACKGROUND_RETRY_MAX_PENDING = 1_000;

type BarcodeResolverInvocationSource = "foreground" | "background_retry";

type BarcodeAbuseGuardReason =
  | "cache_retry_after"
  | "barcode_churn_cooldown"
  | "global_external_burst_cooldown";

type LatencyAccumulator = {
  count: number;
  total_ms: number;
  max_ms: number;
};

type BarcodeProviderMetricsState = {
  started_at_ms: number;
  last_emitted_at_ms: number;
  calls_since_last_emit: number;
  total_resolver_calls: number;
  invalid_barcode_calls: number;
  resolver_result_counts: Record<
    BarcodeResolutionResult["status"] | "exception",
    number
  >;
  resolver_source_counts: Record<BarcodeProviderId, number>;
  total_provider_depth_histogram: Record<string, number>;
  external_provider_depth_histogram: Record<string, number>;
  provider_call_counts: Record<BarcodeProviderId, number>;
  provider_hit_counts: Record<BarcodeProviderId, number>;
  provider_hit_external_counts: Record<BarcodeProviderId, number>;
  provider_miss_counts: Record<BarcodeProviderId, number>;
  provider_error_counts: Record<BarcodeProviderId, number>;
  provider_throttle_counts: Record<BarcodeProviderId, number>;
  provider_timeout_counts: Record<BarcodeProviderId, number>;
  provider_guard_skip_counts: Record<BarcodeProviderId, number>;
  provider_error_code_counts: Record<BarcodeProviderId, Record<string, number>>;
  abuse_guard_skip_resolver_calls: number;
  abuse_guard_cached_external_served_count: number;
  abuse_guard_reason_counts: Record<BarcodeAbuseGuardReason, number>;
  background_retry: BarcodeBackgroundRetryMetricsState;
  latency_total: LatencyAccumulator;
  latency_provider_total: LatencyAccumulator;
  latency_by_provider: Record<BarcodeProviderId, LatencyAccumulator>;
};

type BarcodeProviderLookupObservation = {
  provider: BarcodeProviderId;
  layer: BarcodeProviderLayer;
  outcome: "hit" | "hit_external" | "miss" | "error";
  error_code?: string | null;
};

type BarcodeChurnTrackerEntry = {
  window_started_at_ms: number;
  churn_count_in_window: number;
  unresolved_count_in_window: number;
  resolved_external_count_in_window: number;
  cooldown_until_ms: number;
  skip_count: number;
  last_seen_at_ms: number;
};

type BarcodeChurnGuardState = {
  per_barcode: Map<string, BarcodeChurnTrackerEntry>;
  global_external_attempt_timestamps_ms: number[];
  global_external_burst_cooldown_until_ms: number;
};

type ExternalProviderGuardDecision = {
  reason: BarcodeAbuseGuardReason;
  until_ms: number;
  cached_retry_after?: Date | null;
};

type CachedExternalCatalogHit = {
  source: Exclude<BarcodeProviderId, "internal_tenant_lookup">;
  layer: BarcodeProviderLayer;
  metadata: ExternalProductMetadata;
};

type BackgroundRetryResultCountKey =
  | "resolved"
  | "resolved_external"
  | "unresolved"
  | "error";

type BarcodeBackgroundRetryMetricsState = {
  scheduled_count: number;
  deduped_count: number;
  rescheduled_earlier_count: number;
  queue_full_drop_count: number;
  started_count: number;
  deferred_not_due_count: number;
  deferred_guard_count: number;
  skipped_not_unresolved_count: number;
  skipped_no_retry_after_count: number;
  skipped_disabled_count: number;
  cancelled_on_success_count: number;
  current_in_flight_count: number;
  max_in_flight_count: number;
  queue_size_high_watermark: number;
  result_counts: Record<BackgroundRetryResultCountKey, number>;
};

type BarcodeBackgroundRetryJob = {
  barcode: string;
  due_at_ms: number;
  scheduled_at_ms: number;
  trigger_source: BarcodeResolverInvocationSource;
  timeout_handle: ReturnType<typeof setTimeout>;
};

type BarcodeBackgroundRetrySchedulerState = {
  jobs_by_barcode: Map<string, BarcodeBackgroundRetryJob>;
  in_flight_barcodes: Set<string>;
};

function createLatencyAccumulator(): LatencyAccumulator {
  return {
    count: 0,
    total_ms: 0,
    max_ms: 0,
  };
}

function createProviderCounterRecord(): Record<BarcodeProviderId, number> {
  return {
    internal_tenant_lookup: 0,
    open_food_facts: 0,
    open_beauty_facts: 0,
    upcdatabase: 0,
    upcitemdb: 0,
  };
}

function createProviderErrorCodeRecord(): Record<BarcodeProviderId, Record<string, number>> {
  return {
    internal_tenant_lookup: {},
    open_food_facts: {},
    open_beauty_facts: {},
    upcdatabase: {},
    upcitemdb: {},
  };
}

function createAbuseGuardReasonCounterRecord(): Record<BarcodeAbuseGuardReason, number> {
  return {
    cache_retry_after: 0,
    barcode_churn_cooldown: 0,
    global_external_burst_cooldown: 0,
  };
}

function createProviderLatencyRecord(): Record<BarcodeProviderId, LatencyAccumulator> {
  return {
    internal_tenant_lookup: createLatencyAccumulator(),
    open_food_facts: createLatencyAccumulator(),
    open_beauty_facts: createLatencyAccumulator(),
    upcdatabase: createLatencyAccumulator(),
    upcitemdb: createLatencyAccumulator(),
  };
}

function createBackgroundRetryResultCounterRecord(): Record<BackgroundRetryResultCountKey, number> {
  return {
    resolved: 0,
    resolved_external: 0,
    unresolved: 0,
    error: 0,
  };
}

function createBackgroundRetryMetricsState(): BarcodeBackgroundRetryMetricsState {
  return {
    scheduled_count: 0,
    deduped_count: 0,
    rescheduled_earlier_count: 0,
    queue_full_drop_count: 0,
    started_count: 0,
    deferred_not_due_count: 0,
    deferred_guard_count: 0,
    skipped_not_unresolved_count: 0,
    skipped_no_retry_after_count: 0,
    skipped_disabled_count: 0,
    cancelled_on_success_count: 0,
    current_in_flight_count: 0,
    max_in_flight_count: 0,
    queue_size_high_watermark: 0,
    result_counts: createBackgroundRetryResultCounterRecord(),
  };
}

function createBarcodeProviderMetricsState(): BarcodeProviderMetricsState {
  const startedAt = Date.now();
  return {
    started_at_ms: startedAt,
    last_emitted_at_ms: startedAt,
    calls_since_last_emit: 0,
    total_resolver_calls: 0,
    invalid_barcode_calls: 0,
    resolver_result_counts: {
      resolved: 0,
      resolved_external: 0,
      unresolved: 0,
      exception: 0,
    },
    resolver_source_counts: createProviderCounterRecord(),
    total_provider_depth_histogram: {},
    external_provider_depth_histogram: {},
    provider_call_counts: createProviderCounterRecord(),
    provider_hit_counts: createProviderCounterRecord(),
    provider_hit_external_counts: createProviderCounterRecord(),
    provider_miss_counts: createProviderCounterRecord(),
    provider_error_counts: createProviderCounterRecord(),
    provider_throttle_counts: createProviderCounterRecord(),
    provider_timeout_counts: createProviderCounterRecord(),
    provider_guard_skip_counts: createProviderCounterRecord(),
    provider_error_code_counts: createProviderErrorCodeRecord(),
    abuse_guard_skip_resolver_calls: 0,
    abuse_guard_cached_external_served_count: 0,
    abuse_guard_reason_counts: createAbuseGuardReasonCounterRecord(),
    background_retry: createBackgroundRetryMetricsState(),
    latency_total: createLatencyAccumulator(),
    latency_provider_total: createLatencyAccumulator(),
    latency_by_provider: createProviderLatencyRecord(),
  };
}

const barcodeProviderMetrics = createBarcodeProviderMetricsState();
const barcodeChurnGuardState = createBarcodeChurnGuardState();
const barcodeBackgroundRetrySchedulerState = createBarcodeBackgroundRetrySchedulerState();

function createBarcodeChurnGuardState(): BarcodeChurnGuardState {
  return {
    per_barcode: new Map<string, BarcodeChurnTrackerEntry>(),
    global_external_attempt_timestamps_ms: [],
    global_external_burst_cooldown_until_ms: 0,
  };
}

function createBarcodeBackgroundRetrySchedulerState(): BarcodeBackgroundRetrySchedulerState {
  return {
    jobs_by_barcode: new Map<string, BarcodeBackgroundRetryJob>(),
    in_flight_barcodes: new Set<string>(),
  };
}

function addLatencySample(acc: LatencyAccumulator, durationMs: number): void {
  if (!Number.isFinite(durationMs)) return;
  const value = Math.max(0, Math.round(durationMs));
  acc.count += 1;
  acc.total_ms += value;
  acc.max_ms = Math.max(acc.max_ms, value);
}

function summarizeLatency(acc: LatencyAccumulator): {
  count: number;
  avg_ms: number | null;
  max_ms: number | null;
} {
  return {
    count: acc.count,
    avg_ms: acc.count > 0 ? Math.round(acc.total_ms / acc.count) : null,
    max_ms: acc.count > 0 ? acc.max_ms : null,
  };
}

function incrementHistogram(map: Record<string, number>, rawKey: number): void {
  const key = String(Math.max(0, Math.round(rawKey)));
  map[key] = (map[key] ?? 0) + 1;
}

function isThrottleErrorCode(errorCode: string | null | undefined): boolean {
  const value = String(errorCode ?? "").toLowerCase();
  if (!value) return false;
  return value === "rate_limited" || value === "throttled" || value === "http_429";
}

function isTimeoutErrorCode(errorCode: string | null | undefined): boolean {
  const value = String(errorCode ?? "").toLowerCase();
  if (!value) return false;
  return value.includes("timeout") || value === "aborterror";
}

function recordProviderLookupMetrics(data: {
  provider: BarcodeProviderId;
  durationMs: number;
  outcome: BarcodeProviderLookupObservation["outcome"];
  errorCode?: string | null;
}): void {
  const { provider, durationMs, outcome, errorCode } = data;
  barcodeProviderMetrics.provider_call_counts[provider] += 1;
  addLatencySample(barcodeProviderMetrics.latency_provider_total, durationMs);
  addLatencySample(barcodeProviderMetrics.latency_by_provider[provider], durationMs);

  if (outcome === "hit" || outcome === "hit_external") {
    barcodeProviderMetrics.provider_hit_counts[provider] += 1;
    if (outcome === "hit_external") {
      barcodeProviderMetrics.provider_hit_external_counts[provider] += 1;
    }
    return;
  }

  if (outcome === "miss") {
    barcodeProviderMetrics.provider_miss_counts[provider] += 1;
    return;
  }

  barcodeProviderMetrics.provider_error_counts[provider] += 1;
  if (isThrottleErrorCode(errorCode)) {
    barcodeProviderMetrics.provider_throttle_counts[provider] += 1;
  }
  if (isTimeoutErrorCode(errorCode)) {
    barcodeProviderMetrics.provider_timeout_counts[provider] += 1;
  }
  if (errorCode) {
    const codeKey = String(errorCode).slice(0, 64);
    const providerCodes = barcodeProviderMetrics.provider_error_code_counts[provider];
    providerCodes[codeKey] = (providerCodes[codeKey] ?? 0) + 1;
  }
}

function recordResolverCallMetrics(data: {
  resolveDurationMs: number;
  resultStatus: BarcodeResolutionResult["status"] | "exception";
  resultSource?: BarcodeProviderId | null;
  totalProviderDepth: number;
  externalProviderDepth: number;
}): void {
  barcodeProviderMetrics.total_resolver_calls += 1;
  barcodeProviderMetrics.calls_since_last_emit += 1;
  barcodeProviderMetrics.resolver_result_counts[data.resultStatus] += 1;
  if (data.resultSource) {
    barcodeProviderMetrics.resolver_source_counts[data.resultSource] += 1;
  }
  incrementHistogram(barcodeProviderMetrics.total_provider_depth_histogram, data.totalProviderDepth);
  incrementHistogram(
    barcodeProviderMetrics.external_provider_depth_histogram,
    data.externalProviderDepth
  );
  addLatencySample(barcodeProviderMetrics.latency_total, data.resolveDurationMs);
  maybeEmitBarcodeProviderMetricsSummary();
}

function maybeEmitBarcodeProviderMetricsSummary(): void {
  if (process.env.NODE_ENV === "test") return;

  const now = Date.now();
  const shouldEmitByCalls =
    barcodeProviderMetrics.calls_since_last_emit >= BARCODE_PROVIDER_METRICS_LOG_EVERY_CALLS;
  const shouldEmitByTime =
    now - barcodeProviderMetrics.last_emitted_at_ms >= BARCODE_PROVIDER_METRICS_LOG_INTERVAL_MS;
  if (!shouldEmitByCalls && !shouldEmitByTime) return;

  barcodeProviderMetrics.last_emitted_at_ms = now;
  barcodeProviderMetrics.calls_since_last_emit = 0;

  const providerSummary = {
    internal_tenant_lookup: summarizeProviderCounts("internal_tenant_lookup"),
    open_food_facts: summarizeProviderCounts("open_food_facts"),
    open_beauty_facts: summarizeProviderCounts("open_beauty_facts"),
    upcdatabase: summarizeProviderCounts("upcdatabase"),
    upcitemdb: summarizeProviderCounts("upcitemdb"),
  };

  console.info("[barcode-resolver-metrics] summary", {
    uptime_ms: Math.max(0, now - barcodeProviderMetrics.started_at_ms),
    total_resolver_calls: barcodeProviderMetrics.total_resolver_calls,
    invalid_barcode_calls: barcodeProviderMetrics.invalid_barcode_calls,
    resolver_result_counts: barcodeProviderMetrics.resolver_result_counts,
    resolver_source_counts: barcodeProviderMetrics.resolver_source_counts,
    total_provider_depth_histogram: barcodeProviderMetrics.total_provider_depth_histogram,
    external_provider_depth_histogram: barcodeProviderMetrics.external_provider_depth_histogram,
    abuse_guard: {
      skipped_resolver_calls: barcodeProviderMetrics.abuse_guard_skip_resolver_calls,
      cached_external_served_count:
        barcodeProviderMetrics.abuse_guard_cached_external_served_count,
      reason_counts: barcodeProviderMetrics.abuse_guard_reason_counts,
    },
    background_retry: summarizeBackgroundRetryMetrics(),
    latency_total: summarizeLatency(barcodeProviderMetrics.latency_total),
    latency_provider_total: summarizeLatency(barcodeProviderMetrics.latency_provider_total),
    provider_summary: providerSummary,
  });
}

function summarizeBackgroundRetryMetrics(): {
  scheduled_count: number;
  deduped_count: number;
  rescheduled_earlier_count: number;
  queue_full_drop_count: number;
  started_count: number;
  deferred_not_due_count: number;
  deferred_guard_count: number;
  skipped_not_unresolved_count: number;
  skipped_no_retry_after_count: number;
  skipped_disabled_count: number;
  cancelled_on_success_count: number;
  queue_current_size: number;
  queue_size_high_watermark: number;
  in_flight_current_count: number;
  max_in_flight_count: number;
  result_counts: Record<BackgroundRetryResultCountKey, number>;
  success_rate: number | null;
} {
  const metrics = barcodeProviderMetrics.background_retry;
  const successCount = metrics.result_counts.resolved + metrics.result_counts.resolved_external;
  return {
    scheduled_count: metrics.scheduled_count,
    deduped_count: metrics.deduped_count,
    rescheduled_earlier_count: metrics.rescheduled_earlier_count,
    queue_full_drop_count: metrics.queue_full_drop_count,
    started_count: metrics.started_count,
    deferred_not_due_count: metrics.deferred_not_due_count,
    deferred_guard_count: metrics.deferred_guard_count,
    skipped_not_unresolved_count: metrics.skipped_not_unresolved_count,
    skipped_no_retry_after_count: metrics.skipped_no_retry_after_count,
    skipped_disabled_count: metrics.skipped_disabled_count,
    cancelled_on_success_count: metrics.cancelled_on_success_count,
    queue_current_size: barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size,
    queue_size_high_watermark: metrics.queue_size_high_watermark,
    in_flight_current_count: barcodeBackgroundRetrySchedulerState.in_flight_barcodes.size,
    max_in_flight_count: metrics.max_in_flight_count,
    result_counts: metrics.result_counts,
    success_rate:
      metrics.started_count > 0
        ? Number((successCount / metrics.started_count).toFixed(4))
        : null,
  };
}

function summarizeProviderCounts(provider: BarcodeProviderId): {
  calls: number;
  hit: number;
  hit_external: number;
  miss: number;
  error: number;
  throttled: number;
  timeout: number;
  guard_skipped: number;
  hit_rate: number | null;
  latency: { count: number; avg_ms: number | null; max_ms: number | null };
  error_code_counts: Record<string, number>;
} {
  const calls = barcodeProviderMetrics.provider_call_counts[provider];
  const hits = barcodeProviderMetrics.provider_hit_counts[provider];
  return {
    calls,
    hit: hits,
    hit_external: barcodeProviderMetrics.provider_hit_external_counts[provider],
    miss: barcodeProviderMetrics.provider_miss_counts[provider],
    error: barcodeProviderMetrics.provider_error_counts[provider],
    throttled: barcodeProviderMetrics.provider_throttle_counts[provider],
    timeout: barcodeProviderMetrics.provider_timeout_counts[provider],
    guard_skipped: barcodeProviderMetrics.provider_guard_skip_counts[provider],
    hit_rate: calls > 0 ? Number((hits / calls).toFixed(4)) : null,
    latency: summarizeLatency(barcodeProviderMetrics.latency_by_provider[provider]),
    error_code_counts: barcodeProviderMetrics.provider_error_code_counts[provider],
  };
}

function isExternalProviderId(
  value: string | null | undefined
): value is Exclude<BarcodeProviderId, "internal_tenant_lookup"> {
  return (
    value === "open_food_facts" ||
    value === "open_beauty_facts" ||
    value === "upcdatabase" ||
    value === "upcitemdb"
  );
}

function layerForProvider(provider: BarcodeProviderId): BarcodeProviderLayer {
  switch (provider) {
    case "internal_tenant_lookup":
      return "layer0_internal";
    case "open_food_facts":
      return "layer1_open_food_facts";
    case "open_beauty_facts":
      return "layer2_open_beauty_facts";
    case "upcdatabase":
      return "layer3_upcdatabase";
    case "upcitemdb":
      return "layer4_upcitemdb";
  }
}

function inferExternalMetadataConfidence(data: {
  source: BarcodeProviderId;
  metadata: ExternalProductMetadata;
}): MatchConfidenceValue {
  const isHighConfidenceProvider =
    data.source === "open_food_facts" || data.source === "open_beauty_facts";
  const hasCompleteFields = Boolean(data.metadata.name && data.metadata.brand);
  return isHighConfidenceProvider && hasCompleteFields ? "high" : "medium";
}

function getCachedExternalCatalogHit(
  row: GlobalBarcodeCatalogRow | null
): CachedExternalCatalogHit | null {
  if (!row) return null;
  if (row.resolution_status !== "resolved") return null;
  if (!isExternalProviderId(row.source_provider)) return null;
  const name = row.canonical_title?.trim();
  if (!name) return null;

  return {
    source: row.source_provider,
    layer: layerForProvider(row.source_provider),
    metadata: {
      name,
      brand: row.brand ?? null,
      size_text: row.size_text ?? null,
      category_hint: row.category_hint ?? null,
      image_url: row.image_url ?? null,
    },
  };
}

function pruneGlobalExternalAttemptTimestamps(nowMs: number): void {
  const cutoff = nowMs - BARCODE_GLOBAL_EXTERNAL_BURST_WINDOW_MS;
  const timestamps = barcodeChurnGuardState.global_external_attempt_timestamps_ms;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
}

function getOrCreateBarcodeChurnEntry(
  barcode: string,
  nowMs: number
): BarcodeChurnTrackerEntry {
  const existing = barcodeChurnGuardState.per_barcode.get(barcode);
  if (existing) {
    existing.last_seen_at_ms = nowMs;
    return existing;
  }

  // Bound memory growth during abuse bursts across many unique barcodes.
  if (barcodeChurnGuardState.per_barcode.size >= BARCODE_CHURN_STATE_MAX_KEYS) {
    let oldestKey: string | null = null;
    let oldestSeen = Number.POSITIVE_INFINITY;
    for (const [key, entry] of barcodeChurnGuardState.per_barcode) {
      if (entry.last_seen_at_ms < oldestSeen) {
        oldestSeen = entry.last_seen_at_ms;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      barcodeChurnGuardState.per_barcode.delete(oldestKey);
    }
  }

  const created: BarcodeChurnTrackerEntry = {
    window_started_at_ms: nowMs,
    churn_count_in_window: 0,
    unresolved_count_in_window: 0,
    resolved_external_count_in_window: 0,
    cooldown_until_ms: 0,
    skip_count: 0,
    last_seen_at_ms: nowMs,
  };
  barcodeChurnGuardState.per_barcode.set(barcode, created);
  return created;
}

function maybeResetBarcodeChurnWindow(entry: BarcodeChurnTrackerEntry, nowMs: number): void {
  if (nowMs - entry.window_started_at_ms < BARCODE_CHURN_WINDOW_MS) return;
  entry.window_started_at_ms = nowMs;
  entry.churn_count_in_window = 0;
  entry.unresolved_count_in_window = 0;
  entry.resolved_external_count_in_window = 0;
}

function shouldEmitGuardLogs(): boolean {
  return process.env.NODE_ENV !== "test";
}

function logExternalProviderGuardSkip(data: {
  barcode: string;
  reason: BarcodeAbuseGuardReason;
  untilMs: number;
  nowMs: number;
  hasCachedExternal: boolean;
}): void {
  if (!shouldEmitGuardLogs()) return;

  const remainingMs = Math.max(0, data.untilMs - data.nowMs);
  const entry = getOrCreateBarcodeChurnEntry(data.barcode, data.nowMs);
  const nextSkipCount = entry.skip_count + 1;
  entry.skip_count = nextSkipCount;
  entry.last_seen_at_ms = data.nowMs;

  if (nextSkipCount === 1 || nextSkipCount % 10 === 0) {
    console.info("[barcode-resolver-guard] external_providers_skipped", {
      barcode: data.barcode,
      reason: data.reason,
      cooldown_remaining_ms: remainingMs,
      has_cached_external: data.hasCachedExternal,
      skip_count_for_barcode: nextSkipCount,
    });
  }
}

function logBarcodeChurnCooldownEntered(data: {
  barcode: string;
  nowMs: number;
  cooldownUntilMs: number;
  entry: BarcodeChurnTrackerEntry;
}): void {
  if (!shouldEmitGuardLogs()) return;
  console.warn("[barcode-resolver-guard] barcode_churn_cooldown_entered", {
    barcode: data.barcode,
    cooldown_ms: Math.max(0, data.cooldownUntilMs - data.nowMs),
    churn_count_in_window: data.entry.churn_count_in_window,
    unresolved_count_in_window: data.entry.unresolved_count_in_window,
    resolved_external_count_in_window: data.entry.resolved_external_count_in_window,
    window_ms: BARCODE_CHURN_WINDOW_MS,
  });
}

function logGlobalExternalBurstCooldownEntered(data: {
  nowMs: number;
  cooldownUntilMs: number;
  externalAttemptsInWindow: number;
}): void {
  if (!shouldEmitGuardLogs()) return;
  console.warn("[barcode-resolver-guard] global_external_burst_cooldown_entered", {
    cooldown_ms: Math.max(0, data.cooldownUntilMs - data.nowMs),
    external_attempts_in_window: data.externalAttemptsInWindow,
    window_ms: BARCODE_GLOBAL_EXTERNAL_BURST_WINDOW_MS,
    threshold: BARCODE_GLOBAL_EXTERNAL_BURST_THRESHOLD,
  });
}

function recordExternalGuardSkipMetrics(data: {
  reason: BarcodeAbuseGuardReason;
  skippedProviders: readonly BarcodeProvider[];
}): void {
  barcodeProviderMetrics.abuse_guard_skip_resolver_calls += 1;
  barcodeProviderMetrics.abuse_guard_reason_counts[data.reason] += 1;
  for (const provider of data.skippedProviders) {
    barcodeProviderMetrics.provider_guard_skip_counts[provider.id] += 1;
  }
}

function recordCachedExternalServedFromGuard(): void {
  barcodeProviderMetrics.abuse_guard_cached_external_served_count += 1;
}

function getExternalProviderGuardDecision(data: {
  barcode: string;
  cacheRecord: GlobalBarcodeCatalogRow | null;
  nowMs: number;
}): ExternalProviderGuardDecision | null {
  const retryAfterMs = data.cacheRecord?.retry_after_at?.getTime() ?? 0;
  if (
    data.cacheRecord?.resolution_status === "unresolved" &&
    retryAfterMs > data.nowMs
  ) {
    return {
      reason: "cache_retry_after",
      until_ms: retryAfterMs,
      cached_retry_after: data.cacheRecord.retry_after_at,
    };
  }

  if (barcodeChurnGuardState.global_external_burst_cooldown_until_ms > data.nowMs) {
    return {
      reason: "global_external_burst_cooldown",
      until_ms: barcodeChurnGuardState.global_external_burst_cooldown_until_ms,
    };
  }

  const entry = barcodeChurnGuardState.per_barcode.get(data.barcode);
  if (entry && entry.cooldown_until_ms > data.nowMs) {
    return {
      reason: "barcode_churn_cooldown",
      until_ms: entry.cooldown_until_ms,
    };
  }

  return null;
}

function recordExternalProviderAttemptsForGuard(data: {
  nowMs: number;
  externalProviderDepth: number;
}): void {
  if (data.externalProviderDepth <= 0) return;

  const timestamps = barcodeChurnGuardState.global_external_attempt_timestamps_ms;
  for (let i = 0; i < data.externalProviderDepth; i += 1) {
    timestamps.push(data.nowMs);
  }
  pruneGlobalExternalAttemptTimestamps(data.nowMs);

  const attemptsInWindow = timestamps.length;
  if (
    attemptsInWindow >= BARCODE_GLOBAL_EXTERNAL_BURST_THRESHOLD &&
    barcodeChurnGuardState.global_external_burst_cooldown_until_ms <= data.nowMs
  ) {
    barcodeChurnGuardState.global_external_burst_cooldown_until_ms =
      data.nowMs + BARCODE_GLOBAL_EXTERNAL_BURST_COOLDOWN_MS;
    logGlobalExternalBurstCooldownEntered({
      nowMs: data.nowMs,
      cooldownUntilMs: barcodeChurnGuardState.global_external_burst_cooldown_until_ms,
      externalAttemptsInWindow: attemptsInWindow,
    });
  }
}

function updateBarcodeChurnGuardAfterResult(data: {
  barcode: string;
  nowMs: number;
  result: BarcodeResolutionResult;
  externalProviderDepth: number;
}): void {
  const { barcode, nowMs, result, externalProviderDepth } = data;

  if (result.status === "resolved" && result.source === "internal_tenant_lookup") {
    barcodeChurnGuardState.per_barcode.delete(barcode);
    return;
  }

  if (externalProviderDepth <= 0) {
    return;
  }

  if (result.status !== "unresolved" && result.status !== "resolved_external") {
    return;
  }

  const entry = getOrCreateBarcodeChurnEntry(barcode, nowMs);
  maybeResetBarcodeChurnWindow(entry, nowMs);
  entry.last_seen_at_ms = nowMs;
  entry.churn_count_in_window += 1;

  if (result.status === "unresolved") {
    entry.unresolved_count_in_window += 1;
  } else {
    entry.resolved_external_count_in_window += 1;
  }

  if (
    entry.churn_count_in_window >= BARCODE_CHURN_THRESHOLD &&
    entry.cooldown_until_ms <= nowMs
  ) {
    entry.cooldown_until_ms = nowMs + BARCODE_CHURN_COOLDOWN_MS;
    entry.skip_count = 0;
    logBarcodeChurnCooldownEntered({
      barcode,
      nowMs,
      cooldownUntilMs: entry.cooldown_until_ms,
      entry,
    });
  }
}

function isBackgroundRetrySchedulingEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "test" &&
    process.env.BARCODE_BACKGROUND_RETRY_DISABLED !== "1"
  );
}

function maybeLogBackgroundRetryEvent(
  level: "info" | "warn",
  event: string,
  details: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "test") return;
  const logger = level === "warn" ? console.warn : console.info;
  logger(`[barcode-resolver-bg-retry] ${event}`, details);
}

function recordBackgroundRetryQueueDepthMetrics(): void {
  const metrics = barcodeProviderMetrics.background_retry;
  metrics.queue_size_high_watermark = Math.max(
    metrics.queue_size_high_watermark,
    barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size
  );
}

function syncBackgroundRetryInFlightMetrics(): void {
  const current = barcodeBackgroundRetrySchedulerState.in_flight_barcodes.size;
  const metrics = barcodeProviderMetrics.background_retry;
  metrics.current_in_flight_count = current;
  metrics.max_in_flight_count = Math.max(metrics.max_in_flight_count, current);
}

function clampBackgroundRetryDelayMs(rawDelayMs: number): number {
  if (!Number.isFinite(rawDelayMs)) {
    return BARCODE_BACKGROUND_RETRY_MIN_DELAY_MS;
  }
  return Math.max(
    BARCODE_BACKGROUND_RETRY_MIN_DELAY_MS,
    Math.min(BARCODE_BACKGROUND_RETRY_MAX_DELAY_MS, Math.round(rawDelayMs))
  );
}

function scheduleBarcodeBackgroundRetry(data: {
  barcode: string;
  dueAtMs: number;
  nowMs: number;
  triggerSource: BarcodeResolverInvocationSource;
  reason: "retry_after" | "deferred_not_due" | "deferred_guard";
}): void {
  const metrics = barcodeProviderMetrics.background_retry;
  if (!isBackgroundRetrySchedulingEnabled()) {
    metrics.skipped_disabled_count += 1;
    return;
  }

  const existing = barcodeBackgroundRetrySchedulerState.jobs_by_barcode.get(data.barcode);
  if (existing && existing.due_at_ms <= data.dueAtMs) {
    metrics.deduped_count += 1;
    return;
  }

  if (!existing && barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size >= BARCODE_BACKGROUND_RETRY_MAX_PENDING) {
    metrics.queue_full_drop_count += 1;
    maybeLogBackgroundRetryEvent("warn", "queue_full_drop", {
      barcode: data.barcode,
      queue_size: barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size,
      max_pending: BARCODE_BACKGROUND_RETRY_MAX_PENDING,
    });
    return;
  }

  if (existing) {
    clearTimeout(existing.timeout_handle);
    barcodeBackgroundRetrySchedulerState.jobs_by_barcode.delete(data.barcode);
    metrics.rescheduled_earlier_count += 1;
  } else {
    metrics.scheduled_count += 1;
  }

  const delayMs = clampBackgroundRetryDelayMs(data.dueAtMs - data.nowMs);
  const scheduledDueAtMs = data.nowMs + delayMs;
  const timeoutHandle = setTimeout(() => {
    void runScheduledBarcodeBackgroundRetry({
      barcode: data.barcode,
      expectedDueAtMs: scheduledDueAtMs,
    });
  }, delayMs);

  const nodeTimer = timeoutHandle as ReturnType<typeof setTimeout> & {
    unref?: () => void;
  };
  nodeTimer.unref?.();

  barcodeBackgroundRetrySchedulerState.jobs_by_barcode.set(data.barcode, {
    barcode: data.barcode,
    due_at_ms: scheduledDueAtMs,
    scheduled_at_ms: data.nowMs,
    trigger_source: data.triggerSource,
    timeout_handle: timeoutHandle,
  });
  recordBackgroundRetryQueueDepthMetrics();

  if (
    data.reason !== "retry_after" ||
    metrics.scheduled_count === 1 ||
    metrics.scheduled_count % 25 === 0
  ) {
    maybeLogBackgroundRetryEvent("info", "scheduled", {
      barcode: data.barcode,
      reason: data.reason,
      trigger_source: data.triggerSource,
      delay_ms: delayMs,
      due_at_ms: scheduledDueAtMs,
      queue_size: barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size,
      rescheduled_existing: Boolean(existing),
    });
  }
}

function clearScheduledBarcodeBackgroundRetry(data: {
  barcode: string;
  reason: "resolved" | "resolved_external";
}): void {
  const existing = barcodeBackgroundRetrySchedulerState.jobs_by_barcode.get(data.barcode);
  if (!existing) return;
  clearTimeout(existing.timeout_handle);
  barcodeBackgroundRetrySchedulerState.jobs_by_barcode.delete(data.barcode);
  barcodeProviderMetrics.background_retry.cancelled_on_success_count += 1;

  maybeLogBackgroundRetryEvent("info", "cancelled_on_success", {
    barcode: data.barcode,
    reason: data.reason,
    queue_size: barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size,
  });
}

async function maybeScheduleBackgroundRetryForUnresolvedBarcode(data: {
  barcode: string;
  nowMs: number;
  triggerSource: BarcodeResolverInvocationSource;
}): Promise<void> {
  const metrics = barcodeProviderMetrics.background_retry;
  if (!isBackgroundRetrySchedulingEnabled()) {
    metrics.skipped_disabled_count += 1;
    return;
  }

  const row = await readGlobalBarcodeCatalog(data.barcode);
  if (!row || row.resolution_status !== "unresolved") {
    metrics.skipped_not_unresolved_count += 1;
    return;
  }

  const retryAfterMs = row.retry_after_at?.getTime() ?? 0;
  if (!retryAfterMs) {
    metrics.skipped_no_retry_after_count += 1;
    return;
  }

  scheduleBarcodeBackgroundRetry({
    barcode: data.barcode,
    dueAtMs: retryAfterMs,
    nowMs: data.nowMs,
    triggerSource: data.triggerSource,
    reason: "retry_after",
  });
}

async function runScheduledBarcodeBackgroundRetry(data: {
  barcode: string;
  expectedDueAtMs: number;
}): Promise<void> {
  const metrics = barcodeProviderMetrics.background_retry;
  const scheduled = barcodeBackgroundRetrySchedulerState.jobs_by_barcode.get(data.barcode);
  if (!scheduled || scheduled.due_at_ms !== data.expectedDueAtMs) {
    return;
  }
  barcodeBackgroundRetrySchedulerState.jobs_by_barcode.delete(data.barcode);

  if (!isBackgroundRetrySchedulingEnabled()) {
    metrics.skipped_disabled_count += 1;
    return;
  }

  if (barcodeBackgroundRetrySchedulerState.in_flight_barcodes.has(data.barcode)) {
    metrics.deduped_count += 1;
    return;
  }

  const nowMs = Date.now();
  const cacheRow = await readGlobalBarcodeCatalog(data.barcode);
  if (!cacheRow || cacheRow.resolution_status !== "unresolved") {
    metrics.skipped_not_unresolved_count += 1;
    maybeLogBackgroundRetryEvent("info", "skipped_not_unresolved", {
      barcode: data.barcode,
      has_row: Boolean(cacheRow),
      resolution_status: cacheRow?.resolution_status ?? null,
    });
    return;
  }

  const retryAfterMs = cacheRow.retry_after_at?.getTime() ?? 0;
  if (!retryAfterMs) {
    metrics.skipped_no_retry_after_count += 1;
    maybeLogBackgroundRetryEvent("warn", "skipped_no_retry_after", {
      barcode: data.barcode,
      failure_count: cacheRow.failure_count,
    });
    return;
  }

  if (retryAfterMs > nowMs + BARCODE_BACKGROUND_RETRY_DUE_GRACE_MS) {
    metrics.deferred_not_due_count += 1;
    scheduleBarcodeBackgroundRetry({
      barcode: data.barcode,
      dueAtMs: retryAfterMs,
      nowMs,
      triggerSource: "background_retry",
      reason: "deferred_not_due",
    });
    return;
  }

  const guard = getExternalProviderGuardDecision({
    barcode: data.barcode,
    cacheRecord: cacheRow,
    nowMs,
  });
  if (guard) {
    metrics.deferred_guard_count += 1;
    scheduleBarcodeBackgroundRetry({
      barcode: data.barcode,
      dueAtMs: guard.until_ms,
      nowMs,
      triggerSource: "background_retry",
      reason: "deferred_guard",
    });
    return;
  }

  barcodeBackgroundRetrySchedulerState.in_flight_barcodes.add(data.barcode);
  metrics.started_count += 1;
  syncBackgroundRetryInFlightMetrics();

  maybeLogBackgroundRetryEvent("info", "started", {
    barcode: data.barcode,
    queue_size: barcodeBackgroundRetrySchedulerState.jobs_by_barcode.size,
    in_flight_count: barcodeBackgroundRetrySchedulerState.in_flight_barcodes.size,
  });

  try {
    const result = await resolveBarcodeInternal(
      { barcode: data.barcode },
      {
        includeInternalTenantLookup: false,
        invocationSource: "background_retry",
      }
    );
    metrics.result_counts[result.status] += 1;

    if (result.status !== "unresolved") {
      maybeLogBackgroundRetryEvent("info", "completed", {
        barcode: data.barcode,
        result_status: result.status,
        result_source: result.source,
      });
    }
  } catch (error) {
    metrics.result_counts.error += 1;
    maybeLogBackgroundRetryEvent("warn", "error", {
      barcode: data.barcode,
      error_code: getErrorCode(error),
    });
  } finally {
    barcodeBackgroundRetrySchedulerState.in_flight_barcodes.delete(data.barcode);
    syncBackgroundRetryInFlightMetrics();
  }
}

function shouldLog(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.DEBUG_BARCODE_RESOLVER_CACHE === "1"
  );
}

function logBarcodeCacheLayerError(operation: string, error: unknown): void {
  if (!shouldLog()) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[barcode-resolver-cache] ${operation} failed: ${message}`);
}

function logBarcodeCacheDelegatesUnavailable(): void {
  if (!shouldLog()) return;
  delegateUnavailableCount++;
  // Log first occurrence loudly, then every 10th to avoid flooding
  if (delegateUnavailableCount === 1 || delegateUnavailableCount % 10 === 0) {
    console.warn(
      `[barcode-resolver-cache] Prisma cache delegates unavailable (${delegateUnavailableCount} skipped). ` +
        "Cache/event writes are disabled. Restart the Next.js dev server after `prisma generate`."
    );
  }
}

export type BarcodeResolverConfidence = MatchConfidenceValue;

export type BarcodeResolutionResult =
  | {
      status: "resolved";
      layer: BarcodeResolverLayer;
      source: BarcodeResolverSource;
      confidence: BarcodeResolverConfidence;
      normalized_barcode: string;
      item: NonNullable<LookupBarcodeResult>;
    }
  | {
      status: "resolved_external";
      layer: BarcodeResolverLayer;
      source: BarcodeResolverSource;
      confidence: BarcodeResolverConfidence;
      normalized_barcode: string;
      metadata: ExternalProductMetadata;
    }
  | {
      status: "unresolved";
      layer: BarcodeResolverLayer;
      source: BarcodeResolverSource;
      confidence: BarcodeResolverConfidence;
      normalized_barcode: string | null;
      reason: "invalid_barcode" | "not_found";
    };

function getBarcodeCacheDelegates(): PrismaBarcodeCacheDelegates | null {
  const client = prisma as unknown as Partial<PrismaBarcodeCacheDelegates>;
  const globalBarcodeCatalog = client.globalBarcodeCatalog;
  const barcodeResolutionEvent = client.barcodeResolutionEvent;

  if (
    !globalBarcodeCatalog ||
    typeof globalBarcodeCatalog.findUnique !== "function" ||
    typeof globalBarcodeCatalog.upsert !== "function" ||
    !barcodeResolutionEvent ||
    typeof barcodeResolutionEvent.create !== "function"
  ) {
    logBarcodeCacheDelegatesUnavailable();
    return null;
  }

  return {
    globalBarcodeCatalog,
    barcodeResolutionEvent,
  };
}

async function readGlobalBarcodeCatalog(
  barcode: string
): Promise<GlobalBarcodeCatalogRow | null> {
  const delegates = getBarcodeCacheDelegates();
  if (!delegates) return null;

  try {
    return await delegates.globalBarcodeCatalog.findUnique({
      where: { barcode_normalized: barcode },
    });
  } catch (error) {
    logBarcodeCacheLayerError("globalBarcodeCatalog.findUnique", error);
    if (!isCacheLayerUnavailableError(error)) {
      return null;
    }
    return null;
  }
}

async function upsertResolvedGlobalBarcodeCatalog(data: {
  barcode: string;
  provider: BarcodeProviderId;
  item: NonNullable<LookupBarcodeResult>;
  observedAt: Date;
}): Promise<GlobalBarcodeCatalogRow | null> {
  const delegates = getBarcodeCacheDelegates();
  if (!delegates) return null;

  try {
    return await delegates.globalBarcodeCatalog.upsert(
      buildResolvedGlobalBarcodeCatalogUpsertArgs({
        barcode: data.barcode,
        provider: data.provider,
        item: data.item as Record<string, unknown>,
        observedAt: data.observedAt,
      })
    );
  } catch (error) {
    logBarcodeCacheLayerError("globalBarcodeCatalog.upsert(resolved)", error);
    if (isCacheLayerUnavailableError(error)) {
      return null;
    }
    return null;
  }
}

async function upsertResolvedExternalGlobalBarcodeCatalog(data: {
  barcode: string;
  provider: string;
  metadata: ExternalProductMetadata;
  observedAt: Date;
}): Promise<GlobalBarcodeCatalogRow | null> {
  const delegates = getBarcodeCacheDelegates();
  if (!delegates) return null;

  try {
    return await delegates.globalBarcodeCatalog.upsert(
      buildResolvedExternalGlobalBarcodeCatalogUpsertArgs({
        barcode: data.barcode,
        provider: data.provider,
        metadata: data.metadata,
        observedAt: data.observedAt,
      })
    );
  } catch (error) {
    logBarcodeCacheLayerError("globalBarcodeCatalog.upsert(resolved_external)", error);
    if (isCacheLayerUnavailableError(error)) {
      return null;
    }
    return null;
  }
}

async function upsertUnresolvedGlobalBarcodeCatalog(data: {
  barcode: string;
  observedAt: Date;
  previous: GlobalBarcodeCatalogRow | null;
}): Promise<GlobalBarcodeCatalogRow | null> {
  const delegates = getBarcodeCacheDelegates();
  if (!delegates) return null;

  const { args } = buildUnresolvedGlobalBarcodeCatalogUpsertArgs(data);

  try {
    return await delegates.globalBarcodeCatalog.upsert(args);
  } catch (error) {
    logBarcodeCacheLayerError("globalBarcodeCatalog.upsert(unresolved)", error);
    if (isCacheLayerUnavailableError(error)) {
      return null;
    }
    return null;
  }
}

async function createBarcodeResolutionEvent(data: {
  barcode: string;
  provider: BarcodeProviderId;
  outcome: Extract<BarcodeResolutionEventOutcomeValue, "hit" | "miss" | "error">;
  confidence: MatchConfidenceValue;
  durationMs: number;
  barcodeCatalogId?: string | null;
  errorCode?: string | null;
  normalizedFieldsSnapshot?: Record<string, unknown> | null;
}): Promise<void> {
  const delegates = getBarcodeCacheDelegates();
  if (!delegates) return;

  try {
    await delegates.barcodeResolutionEvent.create(
      buildBarcodeResolutionEventCreateArgs({
        barcode: data.barcode,
        provider: data.provider,
        outcome: data.outcome,
        confidence: data.confidence,
        durationMs: data.durationMs,
        barcodeCatalogId: data.barcodeCatalogId,
        errorCode: data.errorCode,
        normalizedFieldsSnapshot: data.normalizedFieldsSnapshot,
      })
    );
  } catch (error) {
    logBarcodeCacheLayerError("barcodeResolutionEvent.create", error);
    if (isCacheLayerUnavailableError(error)) {
      return;
    }
  }
}

type ResolveBarcodeInternalOptions = {
  includeInternalTenantLookup?: boolean;
  invocationSource?: BarcodeResolverInvocationSource;
};

async function resolveBarcodeInternal(
  data: {
    barcode: string;
  },
  options: ResolveBarcodeInternalOptions = {}
): Promise<BarcodeResolutionResult> {
  const includeInternalTenantLookup = options.includeInternalTenantLookup !== false;
  const invocationSource = options.invocationSource ?? "foreground";
  const resolveStartedAt = Date.now();
  const normalizedBarcode = normalizeBarcode(data.barcode);

  if (!normalizedBarcode) {
    barcodeProviderMetrics.invalid_barcode_calls += 1;
    recordResolverCallMetrics({
      resolveDurationMs: Date.now() - resolveStartedAt,
      resultStatus: "unresolved",
      resultSource: "internal_tenant_lookup",
      totalProviderDepth: 0,
      externalProviderDepth: 0,
    });
    return {
      status: "unresolved",
      layer: "layer0_internal",
      source: "internal_tenant_lookup",
      confidence: "none",
      normalized_barcode: null,
      reason: "invalid_barcode",
    };
  }

  const preloadedCacheRecord = await readGlobalBarcodeCatalog(normalizedBarcode);
  const cachedExternalCatalogHit = getCachedExternalCatalogHit(preloadedCacheRecord);
  const guardNowMs = Date.now();
  const externalProviderGuard = getExternalProviderGuardDecision({
    barcode: normalizedBarcode,
    cacheRecord: preloadedCacheRecord,
    nowMs: guardNowMs,
  });

  const allProviders = getBarcodeProviders();
  const candidateProviders = includeInternalTenantLookup
    ? allProviders
    : allProviders.filter((provider) => provider.id !== "internal_tenant_lookup");
  const internalProvider =
    candidateProviders.find((provider) => provider.id === "internal_tenant_lookup") ?? null;
  const externalProviders = candidateProviders.filter(
    (provider) => provider.id !== "internal_tenant_lookup"
  );
  const providers = externalProviderGuard
    ? internalProvider
      ? [internalProvider]
      : []
    : candidateProviders;

  if (externalProviderGuard && externalProviders.length > 0) {
    recordExternalGuardSkipMetrics({
      reason: externalProviderGuard.reason,
      skippedProviders: externalProviders,
    });
    logExternalProviderGuardSkip({
      barcode: normalizedBarcode,
      reason: externalProviderGuard.reason,
      untilMs: externalProviderGuard.until_ms,
      nowMs: guardNowMs,
      hasCachedExternal: Boolean(cachedExternalCatalogHit),
    });
  }

  if (providers.length === 0) {
    const resolveEndedAt = Date.now();

    if (invocationSource === "background_retry" && externalProviderGuard) {
      barcodeProviderMetrics.background_retry.deferred_guard_count += 1;
      scheduleBarcodeBackgroundRetry({
        barcode: normalizedBarcode,
        dueAtMs: externalProviderGuard.until_ms,
        nowMs: resolveEndedAt,
        triggerSource: "background_retry",
        reason: "deferred_guard",
      });
    }

    if (externalProviderGuard && cachedExternalCatalogHit) {
      recordCachedExternalServedFromGuard();
      const finalResult: BarcodeResolutionResult = {
        status: "resolved_external",
        layer: cachedExternalCatalogHit.layer,
        source: cachedExternalCatalogHit.source,
        confidence: inferExternalMetadataConfidence({
          source: cachedExternalCatalogHit.source,
          metadata: cachedExternalCatalogHit.metadata,
        }),
        normalized_barcode: normalizedBarcode,
        metadata: cachedExternalCatalogHit.metadata,
      };
      recordResolverCallMetrics({
        resolveDurationMs: resolveEndedAt - resolveStartedAt,
        resultStatus: finalResult.status,
        resultSource: finalResult.source,
        totalProviderDepth: 0,
        externalProviderDepth: 0,
      });
      clearScheduledBarcodeBackgroundRetry({
        barcode: normalizedBarcode,
        reason: "resolved_external",
      });
      return finalResult;
    }

    const fallbackProvider = externalProviders[0];
    const finalResult: BarcodeResolutionResult = {
      status: "unresolved",
      layer: (fallbackProvider?.layer ?? "layer1_open_food_facts") as BarcodeResolverLayer,
      source: (fallbackProvider?.id ?? "open_food_facts") as BarcodeResolverSource,
      confidence: "none",
      normalized_barcode: normalizedBarcode,
      reason: "not_found",
    };

    recordResolverCallMetrics({
      resolveDurationMs: resolveEndedAt - resolveStartedAt,
      resultStatus: finalResult.status,
      resultSource: finalResult.source as BarcodeProviderId,
      totalProviderDepth: 0,
      externalProviderDepth: 0,
    });

    if (!(invocationSource === "background_retry" && externalProviderGuard)) {
      await maybeScheduleBackgroundRetryForUnresolvedBarcode({
        barcode: normalizedBarcode,
        nowMs: resolveEndedAt,
        triggerSource: invocationSource,
      });
    }
    return finalResult;
  }

  const providerLookupObservations: BarcodeProviderLookupObservation[] = [];
  const instrumentedProviders: BarcodeProvider[] = providers.map((provider) => ({
    ...provider,
    async lookup(args) {
      const startedAt = Date.now();
      try {
        const result = await provider.lookup(args);
        const durationMs = Date.now() - startedAt;
        providerLookupObservations.push({
          provider: result.provider,
          layer: result.layer,
          outcome: result.outcome,
          error_code: result.outcome === "error" ? result.error_code : null,
        });
        recordProviderLookupMetrics({
          provider: result.provider,
          durationMs,
          outcome: result.outcome,
          errorCode: result.outcome === "error" ? result.error_code : null,
        });
        return result;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const errorCode = getErrorCode(error);
        providerLookupObservations.push({
          provider: provider.id,
          layer: provider.layer,
          outcome: "error",
          error_code: errorCode,
        });
        recordProviderLookupMetrics({
          provider: provider.id,
          durationMs,
          outcome: "error",
          errorCode,
        });
        throw error;
      }
    },
  }));

  let preloadedCacheRecordUsed = false;
  const readGlobalBarcodeCatalogForCore = async (
    barcode: string
  ): Promise<GlobalBarcodeCatalogRow | null> => {
    if (!preloadedCacheRecordUsed && barcode === normalizedBarcode) {
      preloadedCacheRecordUsed = true;
      return preloadedCacheRecord;
    }
    return readGlobalBarcodeCatalog(barcode);
  };

  let result;
  try {
    result = await resolveNormalizedBarcodeWithProviders({
      normalizedBarcode,
      providers: instrumentedProviders,
      readGlobalBarcodeCatalog: readGlobalBarcodeCatalogForCore,
      upsertResolvedGlobalBarcodeCatalog: async ({
        barcode,
        provider,
        item,
        observedAt,
      }) =>
        upsertResolvedGlobalBarcodeCatalog({
          barcode,
          provider: provider as BarcodeProviderId,
          item: item as NonNullable<LookupBarcodeResult>,
          observedAt,
        }),
      upsertResolvedExternalGlobalBarcodeCatalog: async ({
        barcode,
        provider,
        metadata,
        observedAt,
      }) =>
        upsertResolvedExternalGlobalBarcodeCatalog({
          barcode,
          provider,
          metadata: metadata as ExternalProductMetadata,
          observedAt,
        }),
      upsertUnresolvedGlobalBarcodeCatalog,
      createBarcodeResolutionEvent,
      shouldRethrowProviderError: (providerId) =>
        providerId === "internal_tenant_lookup",
    });
  } catch (error) {
    const externalProviderDepth = providerLookupObservations.filter(
      (row) => row.provider !== "internal_tenant_lookup"
    ).length;
    recordExternalProviderAttemptsForGuard({
      nowMs: Date.now(),
      externalProviderDepth,
    });
    recordResolverCallMetrics({
      resolveDurationMs: Date.now() - resolveStartedAt,
      resultStatus: "exception",
      resultSource: null,
      totalProviderDepth: providerLookupObservations.length,
      externalProviderDepth,
    });
    throw error;
  }

  let effectiveResult = result;
  if (
    externalProviderGuard &&
    result.status === "unresolved" &&
    result.source === "internal_tenant_lookup" &&
    cachedExternalCatalogHit
  ) {
    recordCachedExternalServedFromGuard();
    effectiveResult = {
      status: "resolved_external",
      layer: cachedExternalCatalogHit.layer,
      source: cachedExternalCatalogHit.source,
      normalized_barcode: normalizedBarcode,
      metadata: cachedExternalCatalogHit.metadata,
    };
  }

  const externalProviderDepth = providerLookupObservations.filter(
    (row) => row.provider !== "internal_tenant_lookup"
  ).length;
  const resolveEndedAt = Date.now();
  recordExternalProviderAttemptsForGuard({
    nowMs: resolveEndedAt,
    externalProviderDepth,
  });
  recordResolverCallMetrics({
    resolveDurationMs: resolveEndedAt - resolveStartedAt,
    resultStatus: effectiveResult.status,
    resultSource: effectiveResult.source as BarcodeProviderId,
    totalProviderDepth: providerLookupObservations.length,
    externalProviderDepth,
  });

  if (effectiveResult.status === "resolved") {
    const confidence: MatchConfidenceValue =
      effectiveResult.source === "internal_tenant_lookup" ? "high" : "medium";

    const finalResult: BarcodeResolutionResult = {
      status: "resolved",
      layer: effectiveResult.layer as BarcodeResolverLayer,
      source: effectiveResult.source as BarcodeResolverSource,
      confidence,
      normalized_barcode: effectiveResult.normalized_barcode,
      item: effectiveResult.item as NonNullable<LookupBarcodeResult>,
    };
    updateBarcodeChurnGuardAfterResult({
      barcode: normalizedBarcode,
      nowMs: resolveEndedAt,
      result: finalResult,
      externalProviderDepth,
    });
    clearScheduledBarcodeBackgroundRetry({
      barcode: normalizedBarcode,
      reason: "resolved",
    });
    return finalResult;
  }

  if (effectiveResult.status === "resolved_external") {
    const confidence = inferExternalMetadataConfidence({
      source: effectiveResult.source as BarcodeProviderId,
      metadata: effectiveResult.metadata as ExternalProductMetadata,
    });

    const finalResult: BarcodeResolutionResult = {
      status: "resolved_external",
      layer: effectiveResult.layer as BarcodeResolverLayer,
      source: effectiveResult.source as BarcodeResolverSource,
      confidence,
      normalized_barcode: effectiveResult.normalized_barcode,
      metadata: effectiveResult.metadata as ExternalProductMetadata,
    };
    updateBarcodeChurnGuardAfterResult({
      barcode: normalizedBarcode,
      nowMs: resolveEndedAt,
      result: finalResult,
      externalProviderDepth,
    });
    clearScheduledBarcodeBackgroundRetry({
      barcode: normalizedBarcode,
      reason: "resolved_external",
    });
    return finalResult;
  }

  const finalResult: BarcodeResolutionResult = {
    status: "unresolved",
    layer: effectiveResult.layer as BarcodeResolverLayer,
    source: effectiveResult.source as BarcodeResolverSource,
    confidence: "none",
    normalized_barcode: effectiveResult.normalized_barcode,
    reason: effectiveResult.reason,
  };
  updateBarcodeChurnGuardAfterResult({
    barcode: normalizedBarcode,
    nowMs: resolveEndedAt,
    result: finalResult,
    externalProviderDepth,
  });
  await maybeScheduleBackgroundRetryForUnresolvedBarcode({
    barcode: normalizedBarcode,
    nowMs: resolveEndedAt,
    triggerSource: invocationSource,
  });
  return finalResult;
}

export async function resolveBarcode(data: {
  barcode: string;
}): Promise<BarcodeResolutionResult> {
  return resolveBarcodeInternal(data, {
    includeInternalTenantLookup: true,
    invocationSource: "foreground",
  });
}
