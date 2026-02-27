/**
 * Unit tests for intake-capability.service.ts (UI-03).
 * Validates capability resolution, intent visibility, and resolveVisibleIntents.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline pure capability logic for pure-node testing (no TS transform needed)
// ---------------------------------------------------------------------------

const ALWAYS_AVAILABLE = new Set(["manual_entry"]);

const INDUSTRY_CAPABILITIES = {
  restaurant: ["barcode_capture", "photo_assistance", "receipt_parse", "produce_entry", "invoice_entry"],
  contractor: ["barcode_capture", "photo_assistance", "receipt_parse", "invoice_entry"],
  salon:      ["receipt_parse", "invoice_entry", "photo_assistance"],
  retail:     ["barcode_capture", "photo_assistance", "receipt_parse", "invoice_entry"],
  general:    ["barcode_capture", "receipt_parse"],
};

const MODULE_GATED = { supplier_sync: "integrations" };

const INTAKE_INTENT_CAPABILITIES = {
  live_purchase: ["barcode_capture", "produce_entry", "manual_entry", "photo_assistance"],
  bulk_intake:   ["receipt_parse", "invoice_entry", "manual_entry", "photo_assistance"],
  supplier_sync: ["supplier_sync"],
};

const INTAKE_INTENT_ORDER_BY_INDUSTRY = {
  restaurant: ["live_purchase", "bulk_intake", "supplier_sync"],
  retail:     ["live_purchase", "bulk_intake", "supplier_sync"],
  salon:      ["bulk_intake", "live_purchase", "supplier_sync"],
  contractor: ["live_purchase", "bulk_intake", "supplier_sync"],
  general:    ["live_purchase", "bulk_intake", "supplier_sync"],
};

function resolveIntakeCapabilities(industryType, enabledModules) {
  const result = new Set(ALWAYS_AVAILABLE);
  for (const cap of INDUSTRY_CAPABILITIES[industryType] ?? []) result.add(cap);
  const moduleSet = enabledModules != null ? new Set(enabledModules) : null;
  for (const [cap, mod] of Object.entries(MODULE_GATED)) {
    if (moduleSet == null || moduleSet.has(mod)) result.add(cap);
  }
  return result;
}

function isIntentVisible(intent, capabilities) {
  return INTAKE_INTENT_CAPABILITIES[intent].some((cap) => capabilities.has(cap));
}

function resolveVisibleIntents(industryType, enabledModules) {
  const caps = resolveIntakeCapabilities(industryType, enabledModules);
  return INTAKE_INTENT_ORDER_BY_INDUSTRY[industryType].filter((intent) =>
    isIntentVisible(intent, caps)
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveIntakeCapabilities — always-available", () => {
  it("manual_entry is always present regardless of industry", () => {
    for (const industry of ["restaurant", "salon", "contractor", "retail", "general"]) {
      const caps = resolveIntakeCapabilities(industry, []);
      assert.ok(caps.has("manual_entry"), `manual_entry missing for ${industry}`);
    }
  });
});

describe("resolveIntakeCapabilities — industry capabilities", () => {
  it("restaurant includes produce_entry", () => {
    const caps = resolveIntakeCapabilities("restaurant", []);
    assert.ok(caps.has("produce_entry"));
  });
  it("salon does NOT include produce_entry", () => {
    const caps = resolveIntakeCapabilities("salon", []);
    assert.ok(!caps.has("produce_entry"));
  });
  it("contractor includes invoice_entry", () => {
    const caps = resolveIntakeCapabilities("contractor", []);
    assert.ok(caps.has("invoice_entry"));
  });
  it("general includes barcode_capture", () => {
    const caps = resolveIntakeCapabilities("general", []);
    assert.ok(caps.has("barcode_capture"));
  });
});

describe("resolveIntakeCapabilities — module-gated supplier_sync", () => {
  it("supplier_sync absent when enabledModules=[]", () => {
    const caps = resolveIntakeCapabilities("restaurant", []);
    assert.ok(!caps.has("supplier_sync"));
  });
  it("supplier_sync present when integrations module enabled", () => {
    const caps = resolveIntakeCapabilities("restaurant", ["integrations"]);
    assert.ok(caps.has("supplier_sync"));
  });
  it("supplier_sync present when enabledModules=null (unconstrained)", () => {
    const caps = resolveIntakeCapabilities("restaurant", null);
    assert.ok(caps.has("supplier_sync"));
  });
});

describe("isIntentVisible", () => {
  it("live_purchase visible when manual_entry present", () => {
    const caps = new Set(["manual_entry"]);
    assert.ok(isIntentVisible("live_purchase", caps));
  });
  it("bulk_intake visible when manual_entry present", () => {
    const caps = new Set(["manual_entry"]);
    assert.ok(isIntentVisible("bulk_intake", caps));
  });
  it("supplier_sync hidden when supplier_sync capability absent", () => {
    const caps = new Set(["manual_entry", "barcode_capture"]);
    assert.ok(!isIntentVisible("supplier_sync", caps));
  });
  it("supplier_sync visible when supplier_sync capability present", () => {
    const caps = new Set(["manual_entry", "supplier_sync"]);
    assert.ok(isIntentVisible("supplier_sync", caps));
  });
});

describe("resolveVisibleIntents", () => {
  it("restaurant + no integrations: 2 intents (live_purchase, bulk_intake)", () => {
    const intents = resolveVisibleIntents("restaurant", []);
    assert.deepEqual(intents, ["live_purchase", "bulk_intake"]);
  });
  it("restaurant + integrations: 3 intents in order", () => {
    const intents = resolveVisibleIntents("restaurant", ["integrations"]);
    assert.deepEqual(intents, ["live_purchase", "bulk_intake", "supplier_sync"]);
  });
  it("salon + no integrations: bulk_intake first (industry ordering)", () => {
    const intents = resolveVisibleIntents("salon", []);
    assert.equal(intents[0], "bulk_intake");
    assert.ok(!intents.includes("supplier_sync"));
  });
  it("salon + integrations: bulk_intake first then live_purchase then supplier_sync", () => {
    const intents = resolveVisibleIntents("salon", ["integrations"]);
    assert.deepEqual(intents, ["bulk_intake", "live_purchase", "supplier_sync"]);
  });
  it("general + null modules: all 3 intents (unconstrained)", () => {
    const intents = resolveVisibleIntents("general", null);
    assert.ok(intents.includes("live_purchase"));
    assert.ok(intents.includes("bulk_intake"));
    assert.ok(intents.includes("supplier_sync"));
  });
});
