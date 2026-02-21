import type { FinancialSource, FinancialTransactionType } from "@/lib/generated/prisma/client";

export interface NormalizedTransaction {
  external_id: string;
  source: FinancialSource;
  type: FinancialTransactionType;
  /** Always positive; `type` determines direction (income = money in, expense = money out) */
  amount: number;
  description: string;
  occurred_at: Date;
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  source: FinancialSource;
  records_fetched: number;
  records_created: number;
  errors: string[];
}
