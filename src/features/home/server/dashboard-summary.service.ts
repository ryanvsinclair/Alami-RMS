import { serialize } from "@/core/utils/serialize";
import type { DashboardPeriod, HomeDashboardSummary } from "@/features/home/shared/dashboard-summary.contracts";
import { getHomeDashboardSummaryRows } from "./dashboard-summary.repository";

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

export async function getHomeDashboardSummary(
  businessId: string,
  period: DashboardPeriod = "month",
): Promise<HomeDashboardSummary> {
  const rows = await getHomeDashboardSummaryRows(businessId, periodDates(period));
  const income = rows.incomeAgg._sum.amount?.toNumber() ?? 0;
  const expenses = rows.expenseAgg._sum.amount?.toNumber() ?? 0;

  return {
    period,
    businessName: rows.business?.name ?? "My Business",
    income,
    expenses,
    net: income - expenses,
    incomeBreakdown: rows.incomeBySource.map((row) => ({
      source: row.source,
      amount: row._sum.amount?.toNumber() ?? 0,
      count: row._count._all,
    })),
    transactions: serialize(rows.transactions),
  };
}
