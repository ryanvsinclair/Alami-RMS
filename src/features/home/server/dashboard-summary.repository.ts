import { prisma } from "@/core/prisma";

export interface HomeDashboardSummaryWindow {
  start: Date;
  end: Date;
}

export async function getHomeDashboardSummaryRows(
  businessId: string,
  window: HomeDashboardSummaryWindow,
) {
  const { start, end } = window;

  const [business, incomeAgg, expenseAgg, incomeBySource, transactions] = await Promise.all([
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
    prisma.financialTransaction.groupBy({
      by: ["source"],
      where: {
        business_id: businessId,
        type: "income",
        occurred_at: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { _all: true },
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

  return {
    business,
    incomeAgg,
    expenseAgg,
    incomeBySource,
    transactions,
  };
}
