"use client";

import Link from "next/link";
import type { getTerminology } from "@/lib/config/terminology";
import type { HomeDashboardFinancialTx } from "@/features/home/shared/dashboard-summary.contracts";
import { SOURCE_META, Skeleton, asNumber, formatMoney } from "./home-financial-layer.shared";

export type BalanceView = "balance" | "income" | "expenses";

type HomeTerminology = ReturnType<typeof getTerminology>;

export interface HomeActivityListProps {
  loading: boolean;
  error: string;
  transactions: HomeDashboardFinancialTx[];
  view: BalanceView;
  terminology: HomeTerminology;
}

interface DailyTransactionGroup {
  key: string;
  label: string;
  items: HomeDashboardFinancialTx[];
}

function getVisibleTransactions(
  transactions: HomeDashboardFinancialTx[],
  view: BalanceView,
) {
  if (view === "balance") return transactions;
  return transactions.filter((tx) =>
    view === "income" ? tx.type === "income" : tx.type === "expense",
  );
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

function groupTransactionsByDay(
  transactions: HomeDashboardFinancialTx[],
): DailyTransactionGroup[] {
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

function getHeaderTitle(view: BalanceView, terminology: HomeTerminology): string {
  if (view === "income") return `${terminology.moneyIn} Activity`;
  if (view === "expenses") return `${terminology.moneyOut} Activity`;
  return "Activity";
}

function getEmptyStateMessage(view: BalanceView): string {
  if (view === "income") return "No income recorded this period";
  if (view === "expenses") return "No expenses yet";
  return "No transactions yet";
}

export function HomeActivityList({
  loading,
  error,
  transactions,
  view,
  terminology,
}: HomeActivityListProps) {
  const visibleTransactions = getVisibleTransactions(transactions, view);
  const groupedTransactions = groupTransactionsByDay(visibleTransactions);
  const headerTitle = getHeaderTitle(view, terminology);
  const emptyStateMessage = getEmptyStateMessage(view);

  return (
    <div className="layer-transactions relative z-20 flex-1 px-5 pb-28 pt-5" style={{ marginTop: 8 }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-foreground">{headerTitle}</p>
        </div>
        <Link
          href="/integrations"
          className="text-[11px] font-semibold uppercase tracking-wide text-primary hover:text-primary-hover"
        >
          + Integrations
        </Link>
      </div>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-2 rounded-2xl bg-foreground/[0.03] px-4 py-3.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      )}

      {!loading && Boolean(error) && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && groupedTransactions.length === 0 && (
        <div className="rounded-2xl bg-foreground/[0.03] px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground/55">{emptyStateMessage}</p>
        </div>
      )}

      {!loading && !error && groupedTransactions.length > 0 && (
        <div className="space-y-6">
          {groupedTransactions.map((group) => (
            <section key={group.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {group.label}
              </p>
              <div className="mt-2 divide-y divide-border/40">
                {group.items.map((tx) => {
                  const meta = SOURCE_META[tx.source];
                  const amount = asNumber(tx.amount);
                  const signedAmount = `${tx.type === "income" ? "+" : "-"}${formatMoney(Math.abs(amount))}`;
                  const amountClass = tx.type === "income" ? "text-success" : "text-foreground";
                  const label = tx.description ?? tx.shopping_session?.store_name ?? meta.label;
                  const receiptId = tx.shopping_session?.receipt_id;

                  const row = (
                    <div
                      className={`flex items-center gap-3 py-3 ${
                        receiptId
                          ? "transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
                          : ""
                      }`}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.bg} ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-muted">
                          {meta.label} - {formatRowTime(tx.occurred_at)}
                          {receiptId ? " - View Photo" : ""}
                        </p>
                      </div>
                      <p className={`shrink-0 tabular-nums text-sm font-bold ${amountClass}`}>
                        {signedAmount}
                      </p>
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
    </div>
  );
}
