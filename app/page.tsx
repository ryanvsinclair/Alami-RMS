"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardSummary, type DashboardPeriod } from "@/app/actions/core/financial";
import { getCurrentBusinessConfigAction } from "@/app/actions/core/modules";
import { BottomNav } from "@/components/nav/bottom-nav";
import { BusinessConfigProvider } from "@/lib/config/context";
import { getTerminology } from "@/lib/config/terminology";
import type { IndustryType } from "@/lib/generated/prisma/client";
import { HomeIncomeLayer, HomeTransactionsLayer, Skeleton } from "@/features/home/ui";
import type { HomeDashboardSummary } from "@/features/home/shared/dashboard-summary.contracts";

// Types

type DashboardData = HomeDashboardSummary;

interface BusinessConfigData {
  industryType: IndustryType;
  enabledModules: string[];
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};

const HOME_SNAPSHOT_PERIOD: DashboardPeriod = "month";

// Page

export default function HomePage() {
  const [transactionsCollapsed, setTransactionsCollapsed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [industryType, setIndustryType] = useState<IndustryType>("general");
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentBusinessConfigAction()
      .then((config) => {
        const cfg = config as BusinessConfigData;
        setIndustryType(cfg.industryType);
        setEnabledModules(cfg.enabledModules);
      })
      .catch(() => {
        setIndustryType("general");
        setEnabledModules(null);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    getDashboardSummary(HOME_SNAPSHOT_PERIOD)
      .then((res) => setData(res as DashboardData))
      .catch(() => setError("Failed to load financial data"))
      .finally(() => setLoading(false));
  }, []);

  const income = data?.income ?? 0;
  const expenses = data?.expenses ?? 0;
  const net = data?.net ?? 0;
  const expenseTransactions = (data?.transactions ?? []).filter((tx) => tx.type === "expense");
  const incomeBreakdown = data?.incomeBreakdown ?? [];
  const terminology = getTerminology(industryType);

  return (
    <BusinessConfigProvider
      config={{
        industryType,
        enabledModules: enabledModules ?? [],
        terminology,
      }}
    >
      <div className="layer-stack min-h-screen w-full">
      <div className="max-w-lg mx-auto w-full flex flex-col min-h-screen">

      {/* â•â•â• Layer 1 â€“ Balance (on the blue bg) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="layer-balance relative px-5 pt-5 pb-10">
        {/* Top bar: overlay quick actions */}
        <div className="relative mb-8 h-10">
          <div className="absolute right-0 top-0 z-[60] flex flex-col items-end gap-2">
            <Link
              href="/contacts"
              aria-label="Contacts"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.75 1.03 8.966 8.966 0 0 1-4.5 1.252c-1.33 0-2.59-.291-3.72-.811M12 6.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm-9.75 12a9.02 9.02 0 0 1 6.22-8.568m7.06 8.568A9.02 9.02 0 0 0 9.31 10.182" />
              </svg>
            </Link>

            <Link
              href="/reports"
              aria-label="Reports"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 18.75V14.5m5.25 4.25V9.5m5.25 9.25V5.25" />
              </svg>
            </Link>

            <button
              type="button"
              disabled
              aria-label="Search (coming soon)"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white/45"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
            </button>

            <Link
              href="/profile"
              aria-label="Profile"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 1 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Balance content */}
        <div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Total Balance</p>
            <p className="mt-0.5 text-[10px] font-medium text-white/35 mb-3">{PERIOD_LABELS[HOME_SNAPSHOT_PERIOD]}</p>
            {loading ? (
              <Skeleton className="h-11 w-48 bg-white/15 rounded-xl" />
            ) : (
              <p className="text-[44px] font-bold tracking-tight leading-none text-white">
                {net < 0 ? "-" : ""}
                <span className="mr-0.5">$</span>
                {new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(net)).replace(/,/g, " ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* â•â•â• Layer 2 â€“ Income / Spent (lighter blue card) â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="layer-summary-fill flex flex-1 flex-col">
      <HomeIncomeLayer
        loading={loading}
        income={income}
        expenses={expenses}
        incomeLabel={terminology.moneyIn}
        expenseLabel={terminology.moneyOut}
        incomeBreakdown={incomeBreakdown}
        industryType={industryType}
        transactionsCollapsed={transactionsCollapsed}
        onFocusIncome={() => setTransactionsCollapsed(true)}
      />

      {/* â•â•â• Layer 3 â€“ Transactions (card-colored sheet) â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <HomeTransactionsLayer
        loading={loading}
        error={error}
        transactions={expenseTransactions}
        collapsed={transactionsCollapsed}
        title={terminology.moneyOut}
        onToggle={() => setTransactionsCollapsed((prev) => !prev)}
      />

      {/* â”€â”€ Bottom Nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      </div>
      <BottomNav enabledModules={enabledModules ?? undefined} />
      </div>
      </div>
    </BusinessConfigProvider>
  );
}

