import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBarcodeResolutionEventCreateArgs,
  buildHitSnapshot,
  buildResolvedGlobalBarcodeCatalogUpsertArgs,
  buildUnresolvedGlobalBarcodeCatalogUpsertArgs,
} from "./barcode-resolver-cache.ts";

function makePreviousCatalog(overrides = {}) {
  return {
    id: "catalog_1",
    barcode_normalized: "012345678905",
    resolution_status: "unresolved",
    confidence: "none",
    source_provider: null,
    source_updated_at: null,
    first_seen_at: new Date("2026-02-25T10:00:00.000Z"),
    last_seen_at: new Date("2026-02-25T10:00:00.000Z"),
    retry_after_at: new Date("2026-02-25T10:15:00.000Z"),
    failure_count: 1,
    canonical_title: null,
    brand: null,
    size_text: null,
    category_hint: null,
    image_url: null,
    gtin_format: "upc_a",
    ...overrides,
  };
}

test("buildResolvedGlobalBarcodeCatalogUpsertArgs resets failure metadata and trims title", () => {
  const observedAt = new Date("2026-02-25T12:00:00.000Z");
  const args = buildResolvedGlobalBarcodeCatalogUpsertArgs({
    barcode: "012345678905",
    provider: "internal_tenant_lookup",
    item: {
      id: "item_1",
      name: "  Coke  ",
    },
    observedAt,
  });

  assert.equal(args.where.barcode_normalized, "012345678905");
  assert.equal(args.create.resolution_status, "resolved");
  assert.equal(args.update.resolution_status, "resolved");
  assert.equal(args.create.confidence, "high");
  assert.equal(args.update.source_provider, "internal_tenant_lookup");
  assert.equal(args.create.canonical_title, "Coke");
  assert.equal(args.update.failure_count, 0);
  assert.equal(args.update.retry_after_at, null);
  assert.equal(args.create.gtin_format, "upc_a");
});

test("buildUnresolvedGlobalBarcodeCatalogUpsertArgs marks miss/error with backoff and increments failure count", () => {
  const observedAt = new Date("2026-02-25T12:00:00.000Z");
  const { args, nextFailureCount, retryAfter } = buildUnresolvedGlobalBarcodeCatalogUpsertArgs({
    barcode: "012345678905",
    observedAt,
    previous: makePreviousCatalog({ failure_count: 2, retry_after_at: null }),
  });

  assert.equal(nextFailureCount, 3);
  assert.ok(retryAfter instanceof Date);
  assert.equal(retryAfter?.toISOString(), "2026-02-25T13:00:00.000Z");
  assert.equal(args.create.resolution_status, "unresolved");
  assert.equal(args.update.resolution_status, "unresolved");
  assert.equal(args.update.confidence, "none");
  assert.equal(args.update.failure_count, 3);
  assert.equal(
    args.update.retry_after_at?.toISOString(),
    "2026-02-25T13:00:00.000Z"
  );
});

test("buildUnresolvedGlobalBarcodeCatalogUpsertArgs preserves resolved rows on later misses", () => {
  const observedAt = new Date("2026-02-25T12:00:00.000Z");
  const previousRetry = new Date("2026-02-25T14:00:00.000Z");
  const { args, nextFailureCount, retryAfter } = buildUnresolvedGlobalBarcodeCatalogUpsertArgs({
    barcode: "012345678905",
    observedAt,
    previous: makePreviousCatalog({
      resolution_status: "resolved",
      confidence: "high",
      failure_count: 0,
      retry_after_at: previousRetry,
    }),
  });

  assert.equal(nextFailureCount, 0);
  assert.equal(retryAfter, previousRetry);
  assert.deepEqual(args.update, { last_seen_at: observedAt });
  assert.equal(args.create.resolution_status, "unresolved");
});

test("buildHitSnapshot extracts stable item fields for event payloads", () => {
  const snapshot = buildHitSnapshot(
    {
      id: "item_1",
      name: "Coke",
      unit: "each",
      supplier: { id: "supplier_1", name: "Acme" },
    },
    "layer0_internal"
  );

  assert.deepEqual(snapshot, {
    layer: "layer0_internal",
    inventory_item_id: "item_1",
    inventory_item_name: "Coke",
    unit: "each",
    supplier_id: "supplier_1",
  });
});

test("buildBarcodeResolutionEventCreateArgs includes hit and error payload metadata", () => {
  const hit = buildBarcodeResolutionEventCreateArgs({
    barcode: "012345678905",
    provider: "internal_tenant_lookup",
    outcome: "hit",
    confidence: "high",
    durationMs: 12,
    barcodeCatalogId: "catalog_1",
    normalizedFieldsSnapshot: { inventory_item_id: "item_1" },
  });

  assert.deepEqual(hit, {
    data: {
      barcode_catalog_id: "catalog_1",
      barcode_normalized: "012345678905",
      provider: "internal_tenant_lookup",
      outcome: "hit",
      confidence: "high",
      normalized_fields_snapshot: { inventory_item_id: "item_1" },
      error_code: null,
      duration_ms: 12,
    },
  });

  const error = buildBarcodeResolutionEventCreateArgs({
    barcode: "012345678905",
    provider: "internal_tenant_lookup",
    outcome: "error",
    confidence: "none",
    durationMs: 5,
    errorCode: "TypeError",
  });

  assert.deepEqual(error, {
    data: {
      barcode_catalog_id: null,
      barcode_normalized: "012345678905",
      provider: "internal_tenant_lookup",
      outcome: "error",
      confidence: "none",
      error_code: "TypeError",
      duration_ms: 5,
    },
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(error.data, "normalized_fields_snapshot"),
    false
  );
});
