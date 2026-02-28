"use client";

import Link from "next/link";
import type { HomeDashboardFinancialTx } from "@/features/home/shared/dashboard-summary.contracts";
import { SOURCE_META, Skeleton, asNumber, formatDate, formatMoney } from "./home-financial-layer.shared";

export interface HomeTransactionsLayerProps {
  loading: boolean;
  error: string;
  transactions: HomeDashboardFinancialTx[];
  collapsed: boolean;
  title: string;
  onToggle: () => void;
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
          className="block w-full rounded-2xl border border-border/70 bg-foreground/4 px-4 py-3 text-left transition-colors hover:bg-foreground/6"
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
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3.5 rounded-2xl px-3 py-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
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
            <div className="space-y-1">
              {transactions.map((tx) => {
                const meta = SOURCE_META[tx.source];
                const amount = asNumber(tx.amount);
                const label = tx.description ?? tx.shopping_session?.store_name ?? meta.label;
                const receiptId = tx.shopping_session?.receipt_id;

                const card = (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3.5 rounded-2xl px-3 py-3 ${
                      receiptId ? "active:scale-[0.98] transition-transform active:bg-foreground/3" : ""
                    }`}
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.color}`}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-foreground">{label}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-muted">{formatDate(tx.occurred_at)}</p>
                    </div>
                    <p className="shrink-0 tabular-nums text-[15px] font-bold text-foreground">
                      <span className="mr-0.5 text-[13px] font-semibold text-foreground/50">$</span>
                      {new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
                        Math.abs(amount),
                      )}
                    </p>
                    {receiptId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/35">
                        View Photo
                        <svg className="h-3 w-3 shrink-0 text-foreground/25" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    )}
                  </div>
                );

                return receiptId ? (
                  <Link key={tx.id} href={`/receive/receipt/${receiptId}`}>
                    {card}
                  </Link>
                ) : (
                  card
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
