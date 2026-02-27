export const INCOME_EVENT_TYPES = [
  "sale",
  "payout",
  "refund",
  "adjustment",
  "fee",
  "tip",
  "tax",
  "transfer",
] as const;

export type IncomeEventType = (typeof INCOME_EVENT_TYPES)[number];

export const INCOME_PAYOUT_STATUSES = ["pending", "paid", "failed", "unknown"] as const;

export type IncomePayoutStatus = (typeof INCOME_PAYOUT_STATUSES)[number];

export interface NormalizedIncomeEvent {
  provider_id: string;
  connection_id: string;
  external_id: string;
  external_parent_id?: string | null;
  source_name: string;
  event_type: IncomeEventType;
  gross_amount: number;
  fees: number;
  net_amount: number;
  currency: string;
  occurred_at: Date;
  payout_status: IncomePayoutStatus;
  raw_payload: Record<string, unknown>;
  normalized_payload?: Record<string, unknown>;
  updated_at_provider?: Date | null;
}

// IN-00 decision lock: keep FinancialTransaction as dashboard source for MVP.
export const INCOME_DASHBOARD_PROJECTION_STRATEGY = "financial_transaction_projection";
