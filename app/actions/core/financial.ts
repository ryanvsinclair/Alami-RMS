"use server";

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import type { NormalizedTransaction, SyncResult } from "@/modules/integrations/types";
import { requireBusinessId } from "@/core/auth/tenant";

export type DashboardPeriod = "today" | "week" | "month";

function periodDates(period: DashboardPeriod): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    // month = calendar month to date
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

export async function getDashboardSummary(period: DashboardPeriod = "month") {
  const businessId = await requireBusinessId();
  const { start, end } = periodDates(period);

  const [business, incomeAgg, expenseAgg, transactions] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        business_id: businessId,
        type: "income",
        occurred_at: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        business_id: businessId,
        type: "expense",
        occurred_at: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.findMany({
      where: { business_id: businessId, occurred_at: { gte: start, lte: end } },
      orderBy: { occurred_at: "desc" },
      take: 25,
      include: {
        shopping_session: {
          select: { store_name: true, store_address: true, receipt_id: true },
        },
      },
    }),
  ]);

  const income = incomeAgg._sum.amount?.toNumber() ?? 0;
  const expenses = expenseAgg._sum.amount?.toNumber() ?? 0;

  return {
    period,
    businessName: business?.name ?? "My Business",
    income,
    expenses,
    net: income - expenses,
    transactions: serialize(transactions),
  };
}

/**
 * Idempotent ingestion of normalized revenue/expense transactions.
 * Used by future API sync jobs (GoDaddy POS, Uber Eats, DoorDash).
 * Historical records are NEVER overwritten — upsert with update: {} guarantees this.
 */
export async function ingestFinancialTransactions(
  records: NormalizedTransaction[]
): Promise<SyncResult> {
  const businessId = await requireBusinessId();
  if (records.length === 0) {
    return {
      source: "manual",
      records_fetched: 0,
      records_created: 0,
      errors: [],
    };
  }

  const source = records[0].source;
  let created = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const result = await prisma.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: businessId,
            source: record.source,
            external_id: record.external_id,
          },
        },
        create: {
          business_id: businessId,
          type: record.type,
          source: record.source,
          amount: record.amount,
          description: record.description,
          occurred_at: record.occurred_at,
          external_id: record.external_id,
          metadata: record.metadata as never ?? undefined,
        },
        update: {}, // Never overwrite historical data
        select: { id: true, created_at: true },
      });
      // created_at === updated_at only on fresh inserts (Prisma upsert doesn't expose isNew)
      // We count based on whether the record was newly inserted by checking created_at proximity
      const ageMs = Date.now() - new Date(result.created_at as Date).getTime();
      if (ageMs < 5000) created++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    source,
    records_fetched: records.length,
    records_created: created,
    errors,
  };
}
