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
  provider_error_code_counts: Record<BarcodeProviderId, Record<string, number>>;
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

function createProviderLatencyRecord(): Record<BarcodeProviderId, LatencyAccumulator> {
  return {
    internal_tenant_lookup: createLatencyAccumulator(),
    open_food_facts: createLatencyAccumulator(),
    open_beauty_facts: createLatencyAccumulator(),
    upcdatabase: createLatencyAccumulator(),
    upcitemdb: createLatencyAccumulator(),
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
    provider_error_code_counts: createProviderErrorCodeRecord(),
    latency_total: createLatencyAccumulator(),
    latency_provider_total: createLatencyAccumulator(),
    latency_by_provider: createProviderLatencyRecord(),
  };
}

let barcodeProviderMetrics = createBarcodeProviderMetricsState();

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
    latency_total: summarizeLatency(barcodeProviderMetrics.latency_total),
    latency_provider_total: summarizeLatency(barcodeProviderMetrics.latency_provider_total),
    provider_summary: providerSummary,
  });
}

function summarizeProviderCounts(provider: BarcodeProviderId): {
  calls: number;
  hit: number;
  hit_external: number;
  miss: number;
  error: number;
  throttled: number;
  timeout: number;
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
    hit_rate: calls > 0 ? Number((hits / calls).toFixed(4)) : null,
    latency: summarizeLatency(barcodeProviderMetrics.latency_by_provider[provider]),
    error_code_counts: barcodeProviderMetrics.provider_error_code_counts[provider],
  };
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

export async function resolveBarcode(data: {
  barcode: string;
}): Promise<BarcodeResolutionResult> {
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

  const providers = getBarcodeProviders();
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

  let result;
  try {
    result = await resolveNormalizedBarcodeWithProviders({
    normalizedBarcode,
    providers: instrumentedProviders,
    readGlobalBarcodeCatalog,
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
    recordResolverCallMetrics({
      resolveDurationMs: Date.now() - resolveStartedAt,
      resultStatus: "exception",
      resultSource: null,
      totalProviderDepth: providerLookupObservations.length,
      externalProviderDepth,
    });
    throw error;
  }

  const externalProviderDepth = providerLookupObservations.filter(
    (row) => row.provider !== "internal_tenant_lookup"
  ).length;
  recordResolverCallMetrics({
    resolveDurationMs: Date.now() - resolveStartedAt,
    resultStatus: result.status,
    resultSource: result.source as BarcodeProviderId,
    totalProviderDepth: providerLookupObservations.length,
    externalProviderDepth,
  });

  if (result.status === "resolved") {
    const confidence: MatchConfidenceValue =
      result.source === "internal_tenant_lookup" ? "high" : "medium";

    return {
      status: "resolved",
      layer: result.layer as BarcodeResolverLayer,
      source: result.source as BarcodeResolverSource,
      confidence,
      normalized_barcode: result.normalized_barcode,
      item: result.item as NonNullable<LookupBarcodeResult>,
    };
  }

  if (result.status === "resolved_external") {
    // Confidence per plan: OFF/OBF with complete fields = high, others = medium
    const isHighConfidenceProvider =
      result.source === "open_food_facts" || result.source === "open_beauty_facts";
    const hasCompleteFields =
      result.metadata.name && result.metadata.brand;
    const confidence: MatchConfidenceValue =
      isHighConfidenceProvider && hasCompleteFields ? "high" : "medium";

    return {
      status: "resolved_external",
      layer: result.layer as BarcodeResolverLayer,
      source: result.source as BarcodeResolverSource,
      confidence,
      normalized_barcode: result.normalized_barcode,
      metadata: result.metadata as ExternalProductMetadata,
    };
  }

  return {
    status: "unresolved",
    layer: result.layer as BarcodeResolverLayer,
    source: result.source as BarcodeResolverSource,
    confidence: "none",
    normalized_barcode: result.normalized_barcode,
    reason: result.reason,
  };
}
