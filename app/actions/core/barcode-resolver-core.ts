import {
  buildHitSnapshot,
  getErrorCode,
  type BarcodeResolutionEventOutcomeValue,
  type GlobalBarcodeCatalogRow,
  type MatchConfidenceValue,
} from "./barcode-resolver-cache";

export type ExternalMetadata = {
  name: string;
  brand: string | null;
  size_text: string | null;
  category_hint: string | null;
  image_url: string | null;
};

export type ResolverCoreProviderLookupResult<TItem> =
  | {
      outcome: "hit";
      provider: string;
      layer: string;
      item: TItem;
    }
  | {
      outcome: "hit_external";
      provider: string;
      layer: string;
      metadata: ExternalMetadata;
    }
  | {
      outcome: "miss";
      provider: string;
      layer: string;
    }
  | {
      outcome: "error";
      provider: string;
      layer: string;
      error_code: string;
    };

export interface ResolverCoreProvider<TItem> {
  id: string;
  layer: string;
  lookup(data: {
    normalized_barcode: string;
  }): Promise<ResolverCoreProviderLookupResult<TItem>>;
}

export type ResolverCoreResolvedResult<TItem> = {
  status: "resolved";
  layer: string;
  source: string;
  normalized_barcode: string;
  item: TItem;
};

export type ResolverCoreResolvedExternalResult = {
  status: "resolved_external";
  layer: string;
  source: string;
  normalized_barcode: string;
  metadata: ExternalMetadata;
};

export type ResolverCoreUnresolvedResult = {
  status: "unresolved";
  layer: string;
  source: string;
  normalized_barcode: string;
  reason: "not_found";
};

export type ResolverCoreResult<TItem> =
  | ResolverCoreResolvedResult<TItem>
  | ResolverCoreResolvedExternalResult
  | ResolverCoreUnresolvedResult;

type ResolverEventInput = {
  barcode: string;
  provider: string;
  outcome: Extract<BarcodeResolutionEventOutcomeValue, "hit" | "miss" | "error">;
  confidence: MatchConfidenceValue;
  durationMs: number;
  barcodeCatalogId?: string | null;
  errorCode?: string | null;
  normalizedFieldsSnapshot?: Record<string, unknown> | null;
};

type ResolverUpsertResolvedInput<TItem> = {
  barcode: string;
  provider: string;
  item: TItem;
  observedAt: Date;
};

type ResolverUpsertResolvedExternalInput = {
  barcode: string;
  provider: string;
  metadata: ExternalMetadata;
  observedAt: Date;
};

type ResolverUpsertUnresolvedInput = {
  barcode: string;
  observedAt: Date;
  previous: GlobalBarcodeCatalogRow | null;
};

export async function resolveNormalizedBarcodeWithProviders<TItem>(args: {
  normalizedBarcode: string;
  providers: readonly ResolverCoreProvider<TItem>[];
  readGlobalBarcodeCatalog(barcode: string): Promise<GlobalBarcodeCatalogRow | null>;
  upsertResolvedGlobalBarcodeCatalog(
    data: ResolverUpsertResolvedInput<TItem>
  ): Promise<GlobalBarcodeCatalogRow | null>;
  upsertResolvedExternalGlobalBarcodeCatalog(
    data: ResolverUpsertResolvedExternalInput
  ): Promise<GlobalBarcodeCatalogRow | null>;
  upsertUnresolvedGlobalBarcodeCatalog(
    data: ResolverUpsertUnresolvedInput
  ): Promise<GlobalBarcodeCatalogRow | null>;
  createBarcodeResolutionEvent(data: ResolverEventInput): Promise<void>;
  shouldRethrowProviderError?(providerId: string): boolean;
}): Promise<ResolverCoreResult<TItem>> {
  const { normalizedBarcode, providers } = args;
  const firstProvider = providers[0];
  if (!firstProvider) {
    throw new Error("No barcode providers configured");
  }

  let cacheRecord = await args.readGlobalBarcodeCatalog(normalizedBarcode);
  let lastSource = firstProvider.id;
  let lastLayer = firstProvider.layer;

  for (const provider of providers) {
    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof provider.lookup>>;

    try {
      result = await provider.lookup({ normalized_barcode: normalizedBarcode });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const observedAt = new Date();
      cacheRecord = await args.upsertUnresolvedGlobalBarcodeCatalog({
        barcode: normalizedBarcode,
        observedAt,
        previous: cacheRecord,
      });
      await args.createBarcodeResolutionEvent({
        barcode: normalizedBarcode,
        provider: provider.id,
        outcome: "error",
        confidence: "none",
        durationMs,
        barcodeCatalogId: cacheRecord?.id ?? null,
        errorCode: getErrorCode(error),
      });

      if (args.shouldRethrowProviderError?.(provider.id)) {
        throw error;
      }
      continue;
    }

    lastSource = result.provider;
    lastLayer = result.layer;
    const durationMs = Date.now() - startedAt;
    const observedAt = new Date();

    if (result.outcome === "hit") {
      cacheRecord = await args.upsertResolvedGlobalBarcodeCatalog({
        barcode: normalizedBarcode,
        provider: result.provider,
        item: result.item,
        observedAt,
      });
      await args.createBarcodeResolutionEvent({
        barcode: normalizedBarcode,
        provider: result.provider,
        outcome: "hit",
        confidence: "high",
        durationMs,
        barcodeCatalogId: cacheRecord?.id ?? null,
        normalizedFieldsSnapshot: buildHitSnapshot(
          result.item as Record<string, unknown>,
          result.layer
        ),
      });
      return {
        status: "resolved",
        layer: result.layer,
        source: result.provider,
        normalized_barcode: normalizedBarcode,
        item: result.item,
      };
    }

    if (result.outcome === "hit_external") {
      // External provider found the product but it's not in the tenant's inventory.
      // Update the global barcode catalog with the metadata.
      cacheRecord = await args.upsertResolvedExternalGlobalBarcodeCatalog({
        barcode: normalizedBarcode,
        provider: result.provider,
        metadata: result.metadata,
        observedAt,
      });
      await args.createBarcodeResolutionEvent({
        barcode: normalizedBarcode,
        provider: result.provider,
        outcome: "hit",
        confidence: "medium",
        durationMs,
        barcodeCatalogId: cacheRecord?.id ?? null,
        normalizedFieldsSnapshot: buildExternalHitSnapshot(
          result.metadata,
          result.layer
        ),
      });
      return {
        status: "resolved_external",
        layer: result.layer,
        source: result.provider,
        normalized_barcode: normalizedBarcode,
        metadata: result.metadata,
      };
    }

    if (result.outcome === "error") {
      cacheRecord = await args.upsertUnresolvedGlobalBarcodeCatalog({
        barcode: normalizedBarcode,
        observedAt,
        previous: cacheRecord,
      });
      await args.createBarcodeResolutionEvent({
        barcode: normalizedBarcode,
        provider: result.provider,
        outcome: "error",
        confidence: "none",
        durationMs,
        barcodeCatalogId: cacheRecord?.id ?? null,
        errorCode: result.error_code,
      });
      continue;
    }

    cacheRecord = await args.upsertUnresolvedGlobalBarcodeCatalog({
      barcode: normalizedBarcode,
      observedAt,
      previous: cacheRecord,
    });
    await args.createBarcodeResolutionEvent({
      barcode: normalizedBarcode,
      provider: result.provider,
      outcome: "miss",
      confidence: "none",
      durationMs,
      barcodeCatalogId: cacheRecord?.id ?? null,
    });
  }

  return {
    status: "unresolved",
    layer: lastLayer,
    source: lastSource,
    normalized_barcode: normalizedBarcode,
    reason: "not_found",
  };
}

function buildExternalHitSnapshot(
  metadata: ExternalMetadata,
  layer: string
): Record<string, unknown> {
  return {
    layer,
    inventory_item_id: null,
    inventory_item_name: metadata.name,
    brand: metadata.brand,
    size_text: metadata.size_text,
    category_hint: metadata.category_hint,
    image_url: metadata.image_url,
  };
}
