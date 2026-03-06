export type DashboardPeriod = "today" | "week" | "month";

export type HomeFinancialSource =
  | "godaddy_pos"
  | "uber_eats"
  | "doordash"
  | "shopping"
  | "manual"
  | "document_intake"
  | "recurring_bill";

export interface PendingBillOccurrenceSummary {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  category: string;
  recurrence: string;
  dueAt: string;
}

export interface HomeDashboardFinancialTx {
  id: string;
  type: "income" | "expense";
  source: HomeFinancialSource;
  amount: number | string;
  balance_after: number | string | null;
  description: string | null;
  occurred_at: string;
  shopping_session: {
    id: string;
    store_name: string | null;
    store_address: string | null;
    receipt_id: string | null;
  } | null;
}

export interface HomeIncomeBreakdownEntry {
  source: HomeDashboardFinancialTx["source"];
  amount: number;
  count: number;
}

export interface HomeDashboardSummary {
  period: DashboardPeriod;
  businessName: string;
  income: number;
  expenses: number;
  net: number;
  incomeBreakdown: HomeIncomeBreakdownEntry[];
  transactions: HomeDashboardFinancialTx[];
  pendingBills: PendingBillOccurrenceSummary[];
}
