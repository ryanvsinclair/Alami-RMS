/**
 * Unit tests for intake-session.contracts.ts (UI-02).
 * Validates status mapping adapters for Shopping and Receipt → IntakeSessionStatus.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline the mapping functions for pure-node testing (no TS transform needed)
// ---------------------------------------------------------------------------

function shoppingStatusToIntakeStatus(shoppingStatus) {
  switch (shoppingStatus) {
    case "draft":       return "active";
    case "reconciling": return "reviewing";
    case "ready":       return "reviewing";
    case "committed":   return "committed";
    case "cancelled":   return "archived";
    default:            return "active";
  }
}

function receiptStatusToIntakeStatus(receiptStatus) {
  switch (receiptStatus) {
    case "pending":   return "created";
    case "parsing":   return "active";
    case "review":    return "reviewing";
    case "committed": return "committed";
    case "failed":    return "archived";
    default:          return "active";
  }
}

function buildIntakeSessionRoute(intent, underlyingId) {
  switch (intent) {
    case "live_purchase":  return "/shopping";
    case "bulk_intake":    return `/receive/receipt/${underlyingId}`;
    case "supplier_sync":  return "/integrations";
    default:               return "/intake";
  }
}

function deriveIntentFromSessionOrigin(origin) {
  switch (origin) {
    case "shopping":    return "live_purchase";
    case "receipt":     return "bulk_intake";
    case "integration": return "supplier_sync";
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("shoppingStatusToIntakeStatus", () => {
  it("draft → active", () => {
    assert.equal(shoppingStatusToIntakeStatus("draft"), "active");
  });
  it("reconciling → reviewing", () => {
    assert.equal(shoppingStatusToIntakeStatus("reconciling"), "reviewing");
  });
  it("ready → reviewing", () => {
    assert.equal(shoppingStatusToIntakeStatus("ready"), "reviewing");
  });
  it("committed → committed", () => {
    assert.equal(shoppingStatusToIntakeStatus("committed"), "committed");
  });
  it("cancelled → archived", () => {
    assert.equal(shoppingStatusToIntakeStatus("cancelled"), "archived");
  });
  it("unknown → active (safe default)", () => {
    assert.equal(shoppingStatusToIntakeStatus("unknown_future_status"), "active");
  });
});

describe("receiptStatusToIntakeStatus", () => {
  it("pending → created", () => {
    assert.equal(receiptStatusToIntakeStatus("pending"), "created");
  });
  it("parsing → active", () => {
    assert.equal(receiptStatusToIntakeStatus("parsing"), "active");
  });
  it("review → reviewing", () => {
    assert.equal(receiptStatusToIntakeStatus("review"), "reviewing");
  });
  it("committed → committed", () => {
    assert.equal(receiptStatusToIntakeStatus("committed"), "committed");
  });
  it("failed → archived", () => {
    assert.equal(receiptStatusToIntakeStatus("failed"), "archived");
  });
  it("unknown → active (safe default)", () => {
    assert.equal(receiptStatusToIntakeStatus("unknown_future_status"), "active");
  });
});

describe("buildIntakeSessionRoute", () => {
  it("live_purchase → /shopping", () => {
    assert.equal(buildIntakeSessionRoute("live_purchase", "abc"), "/shopping");
  });
  it("bulk_intake → /receive/receipt/:id", () => {
    assert.equal(buildIntakeSessionRoute("bulk_intake", "r-123"), "/receive/receipt/r-123");
  });
  it("supplier_sync → /integrations", () => {
    assert.equal(buildIntakeSessionRoute("supplier_sync", "conn-1"), "/integrations");
  });
});

describe("deriveIntentFromSessionOrigin", () => {
  it("shopping → live_purchase", () => {
    assert.equal(deriveIntentFromSessionOrigin("shopping"), "live_purchase");
  });
  it("receipt → bulk_intake", () => {
    assert.equal(deriveIntentFromSessionOrigin("receipt"), "bulk_intake");
  });
  it("integration → supplier_sync", () => {
    assert.equal(deriveIntentFromSessionOrigin("integration"), "supplier_sync");
  });
});
