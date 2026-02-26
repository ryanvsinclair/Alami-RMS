export type DashboardPeriod = "today" | "week" | "month";

export type HomeFinancialSource = "godaddy_pos" | "uber_eats" | "doordash" | "shopping" | "manual";

export interface HomeDashboardFinancialTx {
  id: string;
  type: "income" | "expense";
  source: HomeFinancialSource;
  amount: number | string;
  description: string | null;
  occurred_at: string;
  shopping_session: {
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
}
