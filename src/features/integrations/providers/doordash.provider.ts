export interface DoorDashIncomeEvent {
  externalId: string;
  occurredAt: Date;
  grossAmount: number;
  fees: number;
  netAmount: number;
  currency: string;
  description: string;
  eventType: string | null;
  payoutStatus: string | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * DoorDash order/payout event normalization.
 *
 * DoorDash Drive API / Reports API returns order-level payouts.
 * Key fields we look for:
 *   - id / delivery_id / order_id / external_delivery_id -> externalId
 *   - created_at / pickup_time / quoted_pickup_time -> occurredAt
 *   - subtotal / order_total / gross_amount -> grossAmount
 *   - commission_amount / fee / dasher_tip -> fees
 *   - payout_amount / net_amount -> netAmount
 *   - currency
 *   - delivery_status / order_status -> payoutStatus
 */
function normalizeDoorDashEvent(payload: Record<string, unknown>): DoorDashIncomeEvent | null {
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

function extractEventRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((e) => typeof e === "object" && e !== null) as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    for (const key of ["orders", "deliveries", "events", "payouts", "results", "data", "transactions"]) {
      if (Array.isArray(root[key])) {
        return (root[key] as unknown[]).filter(
          (e) => typeof e === "object" && e !== null
        ) as Record<string, unknown>[];
      }
    }
  }
  return [];
}

export async function fetchDoorDashIncomeEvents(params: {
  accessToken: string;
  since: Date;
  until: Date;
}): Promise<DoorDashIncomeEvent[]> {
  const endpoint = process.env.INCOME_DOORDASH_EVENTS_URL;
  if (!endpoint) {
    throw new Error("Missing INCOME_DOORDASH_EVENTS_URL for DoorDash sync");
  }

  const url = new URL(endpoint);
  url.searchParams.set("since", params.since.toISOString());
  url.searchParams.set("until", params.until.toISOString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `DoorDash sync request failed (${response.status})`);
  }

  const payload = await response.json().catch(() => []);
  const rows = extractEventRows(payload);
  return rows
    .map((entry) => normalizeDoorDashEvent(entry))
    .filter((entry): entry is DoorDashIncomeEvent => Boolean(entry));
}
