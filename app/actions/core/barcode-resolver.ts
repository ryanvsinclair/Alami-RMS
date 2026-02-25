"use server";

import { prisma } from "@/core/prisma";
import {
  getBarcodeProviders,
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
  const normalizedBarcode = normalizeBarcode(data.barcode);

  if (!normalizedBarcode) {
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
  const result = await resolveNormalizedBarcodeWithProviders({
    normalizedBarcode,
    providers,
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
