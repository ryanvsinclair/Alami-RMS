import assert from "node:assert/strict";
import test from "node:test";

import { resolveNormalizedBarcodeWithProviders } from "./barcode-resolver-core.ts";

function makeCatalogRow(overrides = {}) {
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

/** Shared no-op for the external upsert callback (not under test in most cases). */
async function noopExternalUpsert() {
  return null;
}

test("resolveNormalizedBarcodeWithProviders records hit metadata and returns resolved result", async () => {
  const resolvedUpserts = [];
  const unresolvedUpserts = [];
  const events = [];

  const result = await resolveNormalizedBarcodeWithProviders({
    normalizedBarcode: "012345678905",
    providers: [
      {
        id: "internal_tenant_lookup",
        layer: "layer0_internal",
        async lookup() {
          return {
            outcome: "hit",
            provider: "internal_tenant_lookup",
            layer: "layer0_internal",
            item: {
              id: "item_1",
              name: "Coke",
              unit: "each",
              supplier: { id: "supplier_1" },
            },
          };
        },
      },
    ],
    async readGlobalBarcodeCatalog() {
      return null;
    },
    async upsertResolvedGlobalBarcodeCatalog(data) {
      resolvedUpserts.push(data);
      return makeCatalogRow({
        id: "catalog_hit",
        barcode_normalized: data.barcode,
        resolution_status: "resolved",
        confidence: "high",
        source_provider: data.provider,
        source_updated_at: data.observedAt,
        retry_after_at: null,
        failure_count: 0,
      });
    },
    upsertResolvedExternalGlobalBarcodeCatalog: noopExternalUpsert,
    async upsertUnresolvedGlobalBarcodeCatalog(data) {
      unresolvedUpserts.push(data);
      return makeCatalogRow();
    },
    async createBarcodeResolutionEvent(data) {
      events.push(data);
    },
    shouldRethrowProviderError() {
      return true;
    },
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.source, "internal_tenant_lookup");
  assert.equal(result.layer, "layer0_internal");
  assert.equal(result.normalized_barcode, "012345678905");
  assert.equal(result.item.id, "item_1");

  assert.equal(unresolvedUpserts.length, 0);
  assert.equal(resolvedUpserts.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "hit");
  assert.equal(events[0].confidence, "high");
  assert.equal(events[0].barcodeCatalogId, "catalog_hit");
  assert.deepEqual(events[0].normalizedFieldsSnapshot, {
    layer: "layer0_internal",
    inventory_item_id: "item_1",
    inventory_item_name: "Coke",
    unit: "each",
    supplier_id: "supplier_1",
  });
  assert.equal(events[0].errorCode, undefined);
  assert.equal(typeof events[0].durationMs, "number");
  assert.ok(events[0].durationMs >= 0);
});

test("resolveNormalizedBarcodeWithProviders records miss metadata and returns unresolved", async () => {
  const events = [];
  const unresolvedUpserts = [];

  const result = await resolveNormalizedBarcodeWithProviders({
    normalizedBarcode: "0999999999999",
    providers: [
      {
        id: "internal_tenant_lookup",
        layer: "layer0_internal",
        async lookup() {
          return {
            outcome: "miss",
            provider: "internal_tenant_lookup",
            layer: "layer0_internal",
          };
        },
      },
    ],
    async readGlobalBarcodeCatalog() {
      return null;
    },
    async upsertResolvedGlobalBarcodeCatalog() {
      throw new Error("should not be called");
    },
    upsertResolvedExternalGlobalBarcodeCatalog: noopExternalUpsert,
    async upsertUnresolvedGlobalBarcodeCatalog(data) {
      unresolvedUpserts.push(data);
      return makeCatalogRow({
        id: "catalog_miss",
        barcode_normalized: data.barcode,
        resolution_status: "unresolved",
        failure_count: 1,
      });
    },
    async createBarcodeResolutionEvent(data) {
      events.push(data);
    },
  });

  assert.deepEqual(result, {
    status: "unresolved",
    layer: "layer0_internal",
    source: "internal_tenant_lookup",
    normalized_barcode: "0999999999999",
    reason: "not_found",
  });

  assert.equal(unresolvedUpserts.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "miss");
  assert.equal(events[0].confidence, "none");
  assert.equal(events[0].barcodeCatalogId, "catalog_miss");
  assert.equal(events[0].normalizedFieldsSnapshot, undefined);
});

test("resolveNormalizedBarcodeWithProviders logs provider exceptions before rethrowing when configured", async () => {
  const unresolvedUpserts = [];
  const events = [];

  await assert.rejects(
    () =>
      resolveNormalizedBarcodeWithProviders({
        normalizedBarcode: "012345678905",
        providers: [
          {
            id: "internal_tenant_lookup",
            layer: "layer0_internal",
            async lookup() {
              throw new TypeError("lookup failed");
            },
          },
        ],
        async readGlobalBarcodeCatalog() {
          return null;
        },
        async upsertResolvedGlobalBarcodeCatalog() {
          throw new Error("should not be called");
        },
        upsertResolvedExternalGlobalBarcodeCatalog: noopExternalUpsert,
        async upsertUnresolvedGlobalBarcodeCatalog(data) {
          unresolvedUpserts.push(data);
          return makeCatalogRow({
            id: "catalog_error",
            barcode_normalized: data.barcode,
            resolution_status: "unresolved",
          });
        },
        async createBarcodeResolutionEvent(data) {
          events.push(data);
        },
        shouldRethrowProviderError(providerId) {
          return providerId === "internal_tenant_lookup";
        },
      }),
    TypeError
  );

  assert.equal(unresolvedUpserts.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "error");
  assert.equal(events[0].confidence, "none");
  assert.equal(events[0].barcodeCatalogId, "catalog_error");
  assert.equal(events[0].errorCode, "TypeError");
});

test("resolveNormalizedBarcodeWithProviders handles hit_external and returns resolved_external", async () => {
  const externalUpserts = [];
  const events = [];

  const result = await resolveNormalizedBarcodeWithProviders({
    normalizedBarcode: "4006381333931",
    providers: [
      {
        id: "internal_tenant_lookup",
        layer: "layer0_internal",
        async lookup() {
          return {
            outcome: "miss",
            provider: "internal_tenant_lookup",
            layer: "layer0_internal",
          };
        },
      },
      {
        id: "open_food_facts",
        layer: "layer1_open_food_facts",
        async lookup() {
          return {
            outcome: "hit_external",
            provider: "open_food_facts",
            layer: "layer1_open_food_facts",
            metadata: {
              name: "Nivea Cream",
              brand: "Nivea",
              size_text: "150ml",
              category_hint: "Body care",
              image_url: "https://example.com/nivea.jpg",
            },
          };
        },
      },
    ],
    async readGlobalBarcodeCatalog() {
      return null;
    },
    async upsertResolvedGlobalBarcodeCatalog() {
      throw new Error("should not be called for external hits");
    },
    async upsertResolvedExternalGlobalBarcodeCatalog(data) {
      externalUpserts.push(data);
      return makeCatalogRow({
        id: "catalog_ext",
        barcode_normalized: data.barcode,
        resolution_status: "resolved",
        confidence: "medium",
        source_provider: data.provider,
        canonical_title: data.metadata.name,
        brand: data.metadata.brand,
      });
    },
    async upsertUnresolvedGlobalBarcodeCatalog(data) {
      // Called for the internal miss
      return makeCatalogRow({ barcode_normalized: data.barcode });
    },
    async createBarcodeResolutionEvent(data) {
      events.push(data);
    },
  });

  assert.equal(result.status, "resolved_external");
  assert.equal(result.source, "open_food_facts");
  assert.equal(result.layer, "layer1_open_food_facts");
  assert.equal(result.normalized_barcode, "4006381333931");
  assert.equal(result.metadata.name, "Nivea Cream");
  assert.equal(result.metadata.brand, "Nivea");
  assert.equal(result.metadata.size_text, "150ml");

  assert.equal(externalUpserts.length, 1);
  assert.equal(externalUpserts[0].provider, "open_food_facts");
  assert.equal(externalUpserts[0].metadata.name, "Nivea Cream");

  // 2 events: internal miss + external hit
  assert.equal(events.length, 2);
  assert.equal(events[0].outcome, "miss");
  assert.equal(events[0].provider, "internal_tenant_lookup");
  assert.equal(events[1].outcome, "hit");
  assert.equal(events[1].provider, "open_food_facts");
  assert.equal(events[1].confidence, "medium");
  assert.deepEqual(events[1].normalizedFieldsSnapshot, {
    layer: "layer1_open_food_facts",
    inventory_item_id: null,
    inventory_item_name: "Nivea Cream",
    brand: "Nivea",
    size_text: "150ml",
    category_hint: "Body care",
    image_url: "https://example.com/nivea.jpg",
  });
});

test("resolveNormalizedBarcodeWithProviders falls through external errors to next provider", async () => {
  const events = [];

  const result = await resolveNormalizedBarcodeWithProviders({
    normalizedBarcode: "012345678905",
    providers: [
      {
        id: "internal_tenant_lookup",
        layer: "layer0_internal",
        async lookup() {
          return {
            outcome: "miss",
            provider: "internal_tenant_lookup",
            layer: "layer0_internal",
          };
        },
      },
      {
        id: "open_food_facts",
        layer: "layer1_open_food_facts",
        async lookup() {
          return {
            outcome: "error",
            provider: "open_food_facts",
            layer: "layer1_open_food_facts",
            error_code: "timeout",
          };
        },
      },
      {
        id: "upcdatabase",
        layer: "layer3_upcdatabase",
        async lookup() {
          return {
            outcome: "hit_external",
            provider: "upcdatabase",
            layer: "layer3_upcdatabase",
            metadata: {
              name: "Test Product",
              brand: null,
              size_text: null,
              category_hint: null,
              image_url: null,
            },
          };
        },
      },
    ],
    async readGlobalBarcodeCatalog() {
      return null;
    },
    async upsertResolvedGlobalBarcodeCatalog() {
      throw new Error("should not be called");
    },
    async upsertResolvedExternalGlobalBarcodeCatalog(data) {
      return makeCatalogRow({
        id: "catalog_fallback",
        barcode_normalized: data.barcode,
        resolution_status: "resolved",
        confidence: "medium",
        source_provider: data.provider,
      });
    },
    async upsertUnresolvedGlobalBarcodeCatalog(data) {
      return makeCatalogRow({ barcode_normalized: data.barcode });
    },
    async createBarcodeResolutionEvent(data) {
      events.push(data);
    },
  });

  assert.equal(result.status, "resolved_external");
  assert.equal(result.source, "upcdatabase");
  assert.equal(result.metadata.name, "Test Product");

  // 3 events: internal miss, OFF error, upcdatabase hit
  assert.equal(events.length, 3);
  assert.equal(events[0].outcome, "miss");
  assert.equal(events[1].outcome, "error");
  assert.equal(events[1].errorCode, "timeout");
  assert.equal(events[2].outcome, "hit");
  assert.equal(events[2].provider, "upcdatabase");
});
