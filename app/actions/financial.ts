"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import type { NormalizedTransaction, SyncResult } from "@/lib/integrations/types";
import { requireRestaurantId } from "@/lib/auth/tenant";

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
  const restaurantId = await requireRestaurantId();
  const { start, end } = periodDates(period);

  const [restaurant, incomeAgg, expenseAgg, transactions] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        restaurant_id: restaurantId,
        type: "income",
        occurred_at: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        restaurant_id: restaurantId,
        type: "expense",
        occurred_at: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.findMany({
      where: { restaurant_id: restaurantId, occurred_at: { gte: start, lte: end } },
      orderBy: { occurred_at: "desc" },
      take: 25,
      include: {
        shopping_session: {
          select: { store_name: true, store_address: true },
        },
      },
    }),
  ]);

  const income = incomeAgg._sum.amount?.toNumber() ?? 0;
  const expenses = expenseAgg._sum.amount?.toNumber() ?? 0;

  return {
    period,
    restaurantName: restaurant?.name ?? "My Restaurant",
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
  const restaurantId = await requireRestaurantId();
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
          restaurant_id_source_external_id: {
            restaurant_id: restaurantId,
            source: record.source,
            external_id: record.external_id,
          },
        },
        create: {
          restaurant_id: restaurantId,
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
