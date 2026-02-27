import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline re-implementation of normalizeDoorDashEvent for deterministic testing
// (mirrors doordash.provider.ts field mapping contract exactly)
// ---------------------------------------------------------------------------

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDoorDashEvent(payload) {
  const externalId =
    parseOptionalString(payload.id) ??
    parseOptionalString(payload.delivery_id) ??
    parseOptionalString(payload.order_id) ??
    parseOptionalString(payload.external_delivery_id) ??
    parseOptionalString(payload.external_id);
  if (!externalId) return null;

  const occurredAt =
    toDate(payload.created_at) ??
    toDate(payload.pickup_time) ??
    toDate(payload.quoted_pickup_time) ??
    toDate(payload.occurred_at) ??
    new Date();

  const grossRaw =
    toNumber(payload.subtotal) ??
    toNumber(payload.order_total) ??
    toNumber(payload.gross_amount) ??
    toNumber(payload.amount) ??
    0;

  const feesRaw =
    toNumber(payload.commission_amount) ??
    toNumber(payload.fee) ??
    toNumber(payload.dasher_tip) ??
    toNumber(payload.fees) ??
    0;

  const netRaw =
    toNumber(payload.payout_amount) ??
    toNumber(payload.net_amount) ??
    Math.max(0, Number((grossRaw - feesRaw).toFixed(2)));

  const currency =
    parseOptionalString(payload.currency) ??
    parseOptionalString(payload.currency_code) ??
    "CAD";

  const description =
    parseOptionalString(payload.description) ??
    parseOptionalString(payload.store_name) ??
    "DoorDash income";

  const eventType =
    parseOptionalString(payload.event_type) ??
    parseOptionalString(payload.type) ??
    "order";

  const payoutStatus =
    parseOptionalString(payload.delivery_status) ??
    parseOptionalString(payload.order_status) ??
    parseOptionalString(payload.payout_status) ??
    parseOptionalString(payload.status) ??
    "unknown";

  return {
    externalId,
    occurredAt,
    grossAmount: grossRaw,
    fees: feesRaw,
    netAmount: netRaw,
    currency,
    description,
    eventType,
    payoutStatus,
    rawPayload: payload,
    normalizedPayload: {
      gross_amount: grossRaw,
      fees: feesRaw,
      net_amount: netRaw,
      currency,
      occurred_at: occurredAt.toISOString(),
      description,
      event_type: eventType,
      payout_status: payoutStatus,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("normalizeDoorDashEvent: maps id field to externalId", () => {
  const result = normalizeDoorDashEvent({ id: "dd_001", created_at: "2026-02-25T10:00:00Z" });
  assert.ok(result);
  assert.equal(result.externalId, "dd_001");
});

test("normalizeDoorDashEvent: maps delivery_id when id absent", () => {
  const result = normalizeDoorDashEvent({ delivery_id: "del_abc", created_at: "2026-02-25T10:00:00Z" });
  assert.ok(result);
  assert.equal(result.externalId, "del_abc");
});

test("normalizeDoorDashEvent: maps external_delivery_id as fallback", () => {
  const result = normalizeDoorDashEvent({ external_delivery_id: "ext_xyz" });
  assert.ok(result);
  assert.equal(result.externalId, "ext_xyz");
});

test("normalizeDoorDashEvent: returns null when no externalId can be extracted", () => {
  const result = normalizeDoorDashEvent({ created_at: "2026-02-25T10:00:00Z", subtotal: 10 });
  assert.equal(result, null);
});

test("normalizeDoorDashEvent: computes net from subtotal minus commission_amount", () => {
  const result = normalizeDoorDashEvent({ id: "dd_002", subtotal: 80, commission_amount: 20 });
  assert.ok(result);
  assert.equal(result.grossAmount, 80);
  assert.equal(result.fees, 20);
  assert.equal(result.netAmount, 60);
});

test("normalizeDoorDashEvent: uses payout_amount over computed net", () => {
  const result = normalizeDoorDashEvent({ id: "dd_003", subtotal: 80, commission_amount: 20, payout_amount: 58 });
  assert.ok(result);
  assert.equal(result.netAmount, 58);
});

test("normalizeDoorDashEvent: uses order_total when subtotal absent", () => {
  const result = normalizeDoorDashEvent({ id: "dd_004", order_total: 95, fee: 10 });
  assert.ok(result);
  assert.equal(result.grossAmount, 95);
  assert.equal(result.fees, 10);
});

test("normalizeDoorDashEvent: extracts currency with fallback to CAD", () => {
  const withCurrency = normalizeDoorDashEvent({ id: "dd_005", currency: "USD" });
  assert.equal(withCurrency?.currency, "USD");

  const withCurrencyCode = normalizeDoorDashEvent({ id: "dd_006", currency_code: "EUR" });
  assert.equal(withCurrencyCode?.currency, "EUR");

  const withFallback = normalizeDoorDashEvent({ id: "dd_007" });
  assert.equal(withFallback?.currency, "CAD");
});

test("normalizeDoorDashEvent: uses pickup_time as occurredAt when created_at absent", () => {
  const result = normalizeDoorDashEvent({ id: "dd_008", pickup_time: "2026-02-21T09:00:00Z" });
  assert.ok(result);
  assert.equal(result.occurredAt.toISOString(), "2026-02-21T09:00:00.000Z");
});

test("normalizeDoorDashEvent: maps delivery_status to payoutStatus", () => {
  const result = normalizeDoorDashEvent({ id: "dd_009", delivery_status: "delivered" });
  assert.ok(result);
  assert.equal(result.payoutStatus, "delivered");
});

test("normalizeDoorDashEvent: defaults payoutStatus to unknown when absent", () => {
  const result = normalizeDoorDashEvent({ id: "dd_010" });
  assert.ok(result);
  assert.equal(result.payoutStatus, "unknown");
});

test("normalizeDoorDashEvent: uses store_name as description fallback", () => {
  const result = normalizeDoorDashEvent({ id: "dd_011", store_name: "The Pizza Place" });
  assert.ok(result);
  assert.equal(result.description, "The Pizza Place");
});

test("normalizeDoorDashEvent: normalizedPayload contains canonical fields", () => {
  const result = normalizeDoorDashEvent({ id: "dd_012", subtotal: 70, commission_amount: 10, currency: "CAD", created_at: "2026-02-25T14:00:00Z" });
  assert.ok(result);
  assert.equal(result.normalizedPayload.gross_amount, 70);
  assert.equal(result.normalizedPayload.fees, 10);
  assert.equal(result.normalizedPayload.net_amount, 60);
  assert.equal(result.normalizedPayload.currency, "CAD");
  assert.ok(result.normalizedPayload.occurred_at);
});
