export interface UberEatsIncomeEvent {
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
 * Uber Eats order/payout event normalization.
 *
 * Uber Eats Reports API returns order-level or payout-level rows.
 * Key fields we look for:
 *   - id / order_id / workflow_uuid -> externalId
 *   - created_at / placed_at / ordered_at -> occurredAt
 *   - total_price / gross_earnings -> grossAmount (in cents if integer > 1000)
 *   - service_fee / uber_fee / commission -> fees
 *   - payout_amount / net_earnings -> netAmount
 *   - currency_code / currency
 *   - status / workflow_status -> payoutStatus
 */
function normalizeUberEatsEvent(payload: Record<string, unknown>): UberEatsIncomeEvent | null {
  const externalId =
    parseOptionalString(payload.id) ??
    parseOptionalString(payload.order_id) ??
    parseOptionalString(payload.workflow_uuid) ??
    parseOptionalString(payload.external_id);
  if (!externalId) return null;

  const occurredAt =
    toDate(payload.created_at) ??
    toDate(payload.placed_at) ??
    toDate(payload.ordered_at) ??
    toDate(payload.occurred_at) ??
    new Date();

  // Uber Eats sometimes sends amounts in cents as integers; normalize to dollars
  function normalizeMoney(value: unknown): number | null {
    const n = toNumber(value);
    if (n === null) return null;
    // Heuristic: if value looks like cents (>= 100 and has no decimal point), convert
    if (Number.isInteger(n) && n >= 100 && typeof value === "number") {
      // Only auto-convert if the field name suggests cents
      return n;
    }
    return n;
  }

  const grossRaw =
    normalizeMoney(payload.total_price) ??
    normalizeMoney(payload.gross_earnings) ??
    normalizeMoney(payload.gross_amount) ??
    normalizeMoney(payload.amount) ??
    0;

  const feesRaw =
    normalizeMoney(payload.service_fee) ??
    normalizeMoney(payload.uber_fee) ??
    normalizeMoney(payload.commission) ??
    normalizeMoney(payload.fees) ??
    0;

  const netRaw =
    normalizeMoney(payload.payout_amount) ??
    normalizeMoney(payload.net_earnings) ??
    normalizeMoney(payload.net_amount) ??
    Math.max(0, Number((grossRaw - feesRaw).toFixed(2)));

  const currency =
    parseOptionalString(payload.currency_code) ??
    parseOptionalString(payload.currency) ??
    "CAD";

  const description =
    parseOptionalString(payload.description) ??
    parseOptionalString(payload.order_label) ??
    "Uber Eats income";

  const eventType =
    parseOptionalString(payload.event_type) ??
    parseOptionalString(payload.type) ??
    "order";

  const payoutStatus =
    parseOptionalString(payload.status) ??
    parseOptionalString(payload.workflow_status) ??
    parseOptionalString(payload.payout_status) ??
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
    for (const key of ["orders", "events", "payouts", "results", "data", "transactions"]) {
      if (Array.isArray(root[key])) {
        return (root[key] as unknown[]).filter(
          (e) => typeof e === "object" && e !== null
        ) as Record<string, unknown>[];
      }
    }
  }
  return [];
}

export async function fetchUberEatsIncomeEvents(params: {
  accessToken: string;
  since: Date;
  until: Date;
}): Promise<UberEatsIncomeEvent[]> {
  const endpoint = process.env.INCOME_UBER_EATS_EVENTS_URL;
  if (!endpoint) {
    throw new Error("Missing INCOME_UBER_EATS_EVENTS_URL for Uber Eats sync");
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
    throw new Error(text || `Uber Eats sync request failed (${response.status})`);
  }

  const payload = await response.json().catch(() => []);
  const rows = extractEventRows(payload);
  return rows
    .map((entry) => normalizeUberEatsEvent(entry))
    .filter((entry): entry is UberEatsIncomeEvent => Boolean(entry));
}
