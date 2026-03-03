"use client";

import Link from "next/link";
import type { HomeDashboardFinancialTx } from "@/features/home/shared/dashboard-summary.contracts";
import { SOURCE_META, Skeleton, asNumber, formatMoney } from "./home-financial-layer.shared";

export interface HomeTransactionsLayerProps {
  loading: boolean;
  error: string;
  transactions: HomeDashboardFinancialTx[];
  collapsed: boolean;
  title: string;
  onToggle: () => void;
}

interface DailyTransactionGroup {
  key: string;
  label: string;
  items: HomeDashboardFinancialTx[];
}

function dayKey(dateStr: string): string {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDayLabel(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
    .format(new Date(dateStr))
    .toUpperCase();
}

function formatRowTime(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function groupTransactionsByDay(transactions: HomeDashboardFinancialTx[]): DailyTransactionGroup[] {
  const groups: DailyTransactionGroup[] = [];
  for (const tx of transactions) {
    const key = dayKey(tx.occurred_at);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.items.push(tx);
      continue;
    }

    groups.push({
      key,
      label: formatDayLabel(tx.occurred_at),
      items: [tx],
    });
  }
  return groups;
}

export function HomeTransactionsLayer({
  loading,
  error,
  transactions,
  collapsed,
  title,
  onToggle,
}: HomeTransactionsLayerProps) {
  const expenseTotal = transactions.reduce((sum, tx) => sum + asNumber(tx.amount), 0);
  const groupedTransactions = groupTransactionsByDay(transactions);

  return (
    <div
      className={`layer-transactions relative z-20 px-5 pt-5 transition-all duration-300 ${
        collapsed ? "flex-none pb-5" : "flex-1 pb-28"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[17px] font-bold text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] font-medium text-foreground/40">
            {collapsed ? "Collapsed - tap to expand" : "Recent expense activity"}
          </p>
        </div>
        <button
          type="button"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={onToggle}
          className="grid h-8 w-8 place-items-center rounded-full bg-foreground/6 transition-colors hover:bg-foreground/10"
        >
          <svg className="h-4 w-4 text-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            )}
          </svg>
        </button>
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          className="block w-full rounded-2xl bg-foreground/[0.05] px-4 py-3 text-left transition-colors hover:bg-foreground/[0.08]"
        >
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ) : error ? (
            <p className="text-sm font-medium text-red-400">{error}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground/80">
                {transactions.length === 0 ? "No expenses yet" : `${transactions.length} recent expenses`}
              </p>
              <p className="mt-1 text-xs text-foreground/45">
                {transactions.length === 0
                  ? "Tap to reopen the expense layer."
                  : `${formatMoney(expenseTotal)} total in visible list. Tap to reopen.`}
              </p>
            </>
          )}
        </button>
      ) : (
        <>
          {error && (
            <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 pb-4">
                  <Skeleton className="h-3.5 w-24" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <div className="ml-auto w-24 space-y-2 text-right">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && transactions.length === 0 && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/4">
                <svg className="h-8 w-8 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground/45">No expenses yet</p>
              <p className="mt-1 text-xs text-foreground/35">Commit a shopping session to see expenses here</p>
            </div>
          )}

          {!loading && !error && transactions.length > 0 && (
            <div className="space-y-6">
              {groupedTransactions.map((group) => (
                <section key={group.key}>
                  <p className="text-[11px] font-semibold normal-case tracking-normal text-muted">{group.label}</p>
                  <div className="mt-2 divide-y divide-border/40">
                    {group.items.map((tx) => {
                      const meta = SOURCE_META[tx.source];
                      const amount = asNumber(tx.amount);
                      const label = tx.description ?? tx.shopping_session?.store_name ?? meta.label;
                      const receiptId = tx.shopping_session?.receipt_id;

                      const row = (
                        <div
                          className={`flex items-start gap-3 py-4 ${
                            receiptId ? "transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[18px] font-semibold text-foreground">{label}</p>
                            <p className="mt-1 text-[12px] font-medium text-muted">
                              {meta.label} - {formatRowTime(tx.occurred_at)}
                              {receiptId ? " - View Photo" : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-start gap-2">
                            <div className="text-right">
                              <p className="tabular-nums text-[16px] font-bold text-foreground">
                                {formatMoney(-Math.abs(amount), true)}
                              </p>
                              {tx.balance_after != null && (
                                <p className="mt-0.5 tabular-nums text-[12px] font-medium text-foreground/45">
                                  {formatMoney(tx.balance_after, true)}
                                </p>
                              )}
                            </div>
                            {receiptId && (
                              <svg
                                className="mt-1 h-4 w-4 shrink-0 text-foreground/35"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.2}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );

                      return receiptId ? (
                        <Link key={tx.id} href={`/receive/receipt/${receiptId}`} className="block">
                          {row}
                        </Link>
                      ) : (
                        <div key={tx.id}>{row}</div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
