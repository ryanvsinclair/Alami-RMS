export interface GoDaddyPilotIncomeEvent {
  externalId: string;
  occurredAt: Date;
  grossAmount: number;
  fees: number;
  netAmount: number;
  currency: string;
  description: string;
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

function normalizeGoDaddyEvent(payload: Record<string, unknown>): GoDaddyPilotIncomeEvent | null {
  const externalId =
    (typeof payload.external_id === "string" && payload.external_id) ||
    (typeof payload.transaction_id === "string" && payload.transaction_id) ||
    (typeof payload.id === "string" && payload.id);
  if (!externalId) return null;

  const occurredAt =
    toDate(payload.occurred_at) ??
    toDate(payload.transaction_time) ??
    toDate(payload.created_at) ??
    new Date();

  const grossAmount = toNumber(payload.gross_amount) ?? toNumber(payload.amount) ?? 0;
  const fees = toNumber(payload.fees) ?? toNumber(payload.fee_amount) ?? 0;
  const netAmount =
    toNumber(payload.net_amount) ??
    Math.max(0, Number((grossAmount - fees).toFixed(2)));
  const currency =
    (typeof payload.currency === "string" && payload.currency) ||
    "CAD";
  const description =
    (typeof payload.description === "string" && payload.description) ||
    "GoDaddy POS income";

  return {
    externalId,
    occurredAt: occurredAt ?? new Date(),
    grossAmount,
    fees,
    netAmount,
    currency,
    description,
    rawPayload: payload,
    normalizedPayload: {
      gross_amount: grossAmount,
      fees,
      net_amount: netAmount,
      currency,
      occurred_at: (occurredAt ?? new Date()).toISOString(),
      description,
    },
  };
}

function extractEventRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry) => typeof entry === "object" && entry !== null) as Record<
      string,
      unknown
    >[];
  }

  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    if (Array.isArray(root.events)) {
      return root.events.filter((entry) => typeof entry === "object" && entry !== null) as Record<
        string,
        unknown
      >[];
    }
    if (Array.isArray(root.transactions)) {
      return root.transactions.filter((entry) => typeof entry === "object" && entry !== null) as Record<
        string,
        unknown
      >[];
    }
  }

  return [];
}

export async function fetchGoDaddyPilotIncomeEvents(params: {
  accessToken: string;
  since: Date;
  until: Date;
}): Promise<GoDaddyPilotIncomeEvent[]> {
  const endpoint = process.env.INCOME_GODADDY_POS_EVENTS_URL;
  if (!endpoint) {
    throw new Error("Missing INCOME_GODADDY_POS_EVENTS_URL for GoDaddy pilot sync");
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
    throw new Error(text || `GoDaddy sync request failed (${response.status})`);
  }

  const payload = await response.json().catch(() => []);
  const rows = extractEventRows(payload);
  return rows
    .map((entry) => normalizeGoDaddyEvent(entry))
    .filter((entry): entry is GoDaddyPilotIncomeEvent => Boolean(entry));
}
