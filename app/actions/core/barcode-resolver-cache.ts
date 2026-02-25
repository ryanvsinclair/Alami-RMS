export type BarcodeResolutionStatusValue = "resolved" | "unresolved" | "needs_review";
export type BarcodeResolutionEventOutcomeValue = "hit" | "miss" | "error" | "throttled";
export type MatchConfidenceValue = "high" | "medium" | "low" | "none";

export type GlobalBarcodeCatalogRow = {
  id: string;
  barcode_normalized: string;
  resolution_status: BarcodeResolutionStatusValue;
  confidence: MatchConfidenceValue;
  source_provider: string | null;
  source_updated_at: Date | null;
  first_seen_at: Date;
  last_seen_at: Date;
  retry_after_at: Date | null;
  failure_count: number;
  canonical_title: string | null;
  brand: string | null;
  size_text: string | null;
  category_hint: string | null;
  image_url: string | null;
  gtin_format: string | null;
};

export type CatalogUpsertArgs = {
  where: { barcode_normalized: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

export type BarcodeResolutionEventCreateArgs = {
  data: Record<string, unknown>;
};

export function inferGtinFormat(barcode: string): string | null {
  switch (barcode.length) {
    case 8:
      return "ean_8";
    case 12:
      return "upc_a";
    case 13:
      return "ean_13";
    case 14:
      return "gtin_14";
    default:
      return null;
  }
}

export function computeRetryAfter(now: Date, nextFailureCount: number): Date {
  const minutes = Math.min(24 * 60, 15 * 2 ** Math.max(0, nextFailureCount - 1));
  return new Date(now.getTime() + minutes * 60 * 1000);
}

export function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.name || "unknown_error";
  }
  return "unknown_error";
}

export function isCacheLayerUnavailableError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("global_barcode_catalog") ||
    message.includes("barcode_resolution_events") ||
    message.includes("barcoderesolutionstatus") ||
    message.includes("barcodesourceprovider") ||
    message.includes("barcoderesolutioneventoutcome") ||
    message.includes("does not exist") ||
    message.includes("unknown argument")
  );
}

export function buildResolvedGlobalBarcodeCatalogUpsertArgs(data: {
  barcode: string;
  provider: string;
  item: Record<string, unknown>;
  observedAt: Date;
}): CatalogUpsertArgs {
  const canonicalTitle =
    typeof data.item.name === "string" ? data.item.name.trim() || null : null;

  return {
    where: { barcode_normalized: data.barcode },
    create: {
      barcode_normalized: data.barcode,
      gtin_format: inferGtinFormat(data.barcode),
      resolution_status: "resolved",
      confidence: "high",
      source_provider: data.provider,
      source_updated_at: data.observedAt,
      canonical_title: canonicalTitle,
      last_seen_at: data.observedAt,
      retry_after_at: null,
      failure_count: 0,
    },
    update: {
      gtin_format: inferGtinFormat(data.barcode),
      resolution_status: "resolved",
      confidence: "high",
      source_provider: data.provider,
      source_updated_at: data.observedAt,
      canonical_title: canonicalTitle,
      last_seen_at: data.observedAt,
      retry_after_at: null,
      failure_count: 0,
    },
  };
}

export function buildResolvedExternalGlobalBarcodeCatalogUpsertArgs(data: {
  barcode: string;
  provider: string;
  metadata: {
    name: string;
    brand: string | null;
    size_text: string | null;
    category_hint: string | null;
    image_url: string | null;
  };
  observedAt: Date;
}): CatalogUpsertArgs {
  return {
    where: { barcode_normalized: data.barcode },
    create: {
      barcode_normalized: data.barcode,
      gtin_format: inferGtinFormat(data.barcode),
      resolution_status: "resolved",
      confidence: "medium",
      source_provider: data.provider,
      source_updated_at: data.observedAt,
      canonical_title: data.metadata.name,
      brand: data.metadata.brand,
      size_text: data.metadata.size_text,
      category_hint: data.metadata.category_hint,
      image_url: data.metadata.image_url,
      last_seen_at: data.observedAt,
      retry_after_at: null,
      failure_count: 0,
    },
    update: {
      gtin_format: inferGtinFormat(data.barcode),
      resolution_status: "resolved",
      confidence: "medium",
      source_provider: data.provider,
      source_updated_at: data.observedAt,
      canonical_title: data.metadata.name,
      brand: data.metadata.brand,
      size_text: data.metadata.size_text,
      category_hint: data.metadata.category_hint,
      image_url: data.metadata.image_url,
      last_seen_at: data.observedAt,
      retry_after_at: null,
      failure_count: 0,
    },
  };
}

export function buildUnresolvedGlobalBarcodeCatalogUpsertArgs(data: {
  barcode: string;
  observedAt: Date;
  previous: GlobalBarcodeCatalogRow | null;
}): { args: CatalogUpsertArgs; nextFailureCount: number; retryAfter: Date | null } {
  const preservesResolvedState = data.previous?.resolution_status === "resolved";
  const nextFailureCount = preservesResolvedState
    ? data.previous?.failure_count ?? 0
    : (data.previous?.failure_count ?? 0) + 1;
  const retryAfter = preservesResolvedState
    ? data.previous?.retry_after_at ?? null
    : computeRetryAfter(data.observedAt, nextFailureCount);

  const args: CatalogUpsertArgs = {
    where: { barcode_normalized: data.barcode },
    create: {
      barcode_normalized: data.barcode,
      gtin_format: inferGtinFormat(data.barcode),
      resolution_status: "unresolved",
      confidence: "none",
      last_seen_at: data.observedAt,
      retry_after_at: retryAfter,
      failure_count: nextFailureCount,
    },
    update: preservesResolvedState
      ? {
          last_seen_at: data.observedAt,
        }
      : {
          gtin_format: inferGtinFormat(data.barcode),
          resolution_status: "unresolved",
          confidence: "none",
          last_seen_at: data.observedAt,
          retry_after_at: retryAfter,
          failure_count: nextFailureCount,
        },
  };

  return { args, nextFailureCount, retryAfter };
}

export function buildHitSnapshot(
  item: Record<string, unknown>,
  layer: string
): Record<string, unknown> {
  const supplierRecord =
    item.supplier && typeof item.supplier === "object"
      ? (item.supplier as Record<string, unknown>)
      : null;

  return {
    layer,
    inventory_item_id: typeof item.id === "string" ? item.id : null,
    inventory_item_name: typeof item.name === "string" ? item.name : null,
    unit: typeof item.unit === "string" ? item.unit : null,
    supplier_id:
      supplierRecord && typeof supplierRecord.id === "string" ? supplierRecord.id : null,
  };
}

export function buildBarcodeResolutionEventCreateArgs(data: {
  barcode: string;
  provider: string;
  outcome: Extract<BarcodeResolutionEventOutcomeValue, "hit" | "miss" | "error">;
  confidence: MatchConfidenceValue;
  durationMs: number;
  barcodeCatalogId?: string | null;
  errorCode?: string | null;
  normalizedFieldsSnapshot?: Record<string, unknown> | null;
}): BarcodeResolutionEventCreateArgs {
  const eventData: Record<string, unknown> = {
    barcode_catalog_id: data.barcodeCatalogId ?? null,
    barcode_normalized: data.barcode,
    provider: data.provider,
    outcome: data.outcome,
    confidence: data.confidence,
    error_code: data.errorCode ?? null,
    duration_ms: data.durationMs,
  };

  if (data.normalizedFieldsSnapshot !== undefined && data.normalizedFieldsSnapshot !== null) {
    eventData.normalized_fields_snapshot = data.normalizedFieldsSnapshot;
  }

  return {
    data: eventData,
  };
}
