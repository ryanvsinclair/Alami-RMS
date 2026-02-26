"use client";

import type { IndustryType } from "@/lib/generated/prisma/client";
import type { HomeIncomeBreakdownEntry } from "@/features/home/shared/dashboard-summary.contracts";
import {
  SOURCE_META,
  Skeleton,
  formatMoney,
  formatSourceLabel,
  getOrderedIncomeBreakdown,
} from "./home-financial-layer.shared";

export interface HomeIncomeLayerProps {
  loading: boolean;
  income: number;
  expenses: number;
  incomeLabel: string;
  expenseLabel: string;
  incomeBreakdown: HomeIncomeBreakdownEntry[];
  industryType: IndustryType;
  transactionsCollapsed: boolean;
  onFocusIncome: () => void;
}

export function HomeIncomeLayer({
  loading,
  income,
  expenses,
  incomeLabel,
  expenseLabel,
  incomeBreakdown,
  industryType,
  transactionsCollapsed,
  onFocusIncome,
}: HomeIncomeLayerProps) {
  const orderedIncomeBreakdown = getOrderedIncomeBreakdown(industryType, incomeBreakdown);

  return (
    <button
      type="button"
      onClick={onFocusIncome}
      className="layer-summary relative z-10 block w-full px-6 py-5 text-left"
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 rounded-lg bg-white/10" />
          <Skeleton className="h-12 rounded-lg bg-white/10" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">{incomeLabel}</p>
              <p className="mt-1.5 text-xl font-bold text-white">{formatMoney(income)}</p>
            </div>
            <div className="border-l border-white/20 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">{expenseLabel}</p>
              <p className="mt-1.5 text-xl font-bold text-white">{formatMoney(expenses)}</p>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              transactionsCollapsed ? "mt-4 max-h-80 opacity-100" : "mt-0 max-h-0 opacity-0"
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">{incomeLabel} Sources</p>
                <p className="text-[10px] font-medium text-white/40">{orderedIncomeBreakdown.length} streams</p>
              </div>

              {orderedIncomeBreakdown.length === 0 ? (
                <p className="py-2 text-xs text-white/45">No income sources recorded this period.</p>
              ) : (
                <div className="space-y-2">
                  {orderedIncomeBreakdown.map((entry) => (
                    <div
                      key={entry.source}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.04] text-white/85">
                        {SOURCE_META[entry.source].icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-white/90">{formatSourceLabel(entry.source)}</p>
                        <p className="text-[10px] text-white/40">
                          {entry.count} {entry.count === 1 ? "entry" : "entries"}
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums text-[13px] font-bold text-white">{formatMoney(entry.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] font-medium text-white/45">
            {transactionsCollapsed ? "Income sources expanded" : `Tap this card to focus ${incomeLabel.toLowerCase()}`}
          </p>
        </>
      )}
    </button>
  );
}
