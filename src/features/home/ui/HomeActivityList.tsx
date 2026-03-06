"use client";

import { useState } from "react";
import Link from "next/link";
import type { getTerminology } from "@/lib/config/terminology";
import type {
  HomeDashboardFinancialTx,
  PendingBillOccurrenceSummary,
} from "@/features/home/shared/dashboard-summary.contracts";
import { SOURCE_META, Skeleton, asNumber, formatMoney } from "./home-financial-layer.shared";
import {
  confirmBillOccurrenceAction,
  skipBillOccurrenceAction,
} from "@/app/actions/modules/recurring-bills";
import { RECURRENCE_LABELS } from "@/features/finance/shared/recurring-bill.contracts";
import type { RecurrenceInterval } from "@/features/finance/shared/recurring-bill.contracts";

export type BalanceView = "balance" | "income" | "expenses";

type HomeTerminology = ReturnType<typeof getTerminology>;

export interface HomeActivityListProps {
  loading: boolean;
  error: string;
  transactions: HomeDashboardFinancialTx[];
  pendingBills?: PendingBillOccurrenceSummary[];
  view: BalanceView;
  terminology: HomeTerminology;
  onBillConfirmed?: () => void;
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

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d)}`;
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

// ─── Pending bill confirm card ────────────────────────────────────────────────

function PendingBillCard({
  occ,
  onActioned,
}: {
  occ: PendingBillOccurrenceSummary;
  onActioned: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const dueDateLabel = formatDueDate(occ.dueAt);
  const isOverdue = new Date(occ.dueAt) < new Date();

  async function handleConfirm() {
    setConfirming(true);
    try {
      await confirmBillOccurrenceAction(occ.id);
      onActioned();
    } catch {
      // silent — user can retry
    } finally {
      setConfirming(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      await skipBillOccurrenceAction(occ.id);
      onActioned();
    } catch {
      // silent — user can retry
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        isOverdue
          ? "border-warning/30 bg-warning/5"
          : "border-border/30 bg-foreground/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            isOverdue ? "bg-warning/15 text-warning" : "bg-foreground/8 text-foreground/70"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
          </svg>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{occ.billName}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted">
            {RECURRENCE_LABELS[occ.recurrence as RecurrenceInterval] ?? occ.recurrence}
            {" · "}
            <span className={isOverdue ? "font-semibold text-warning" : ""}>{dueDateLabel}</span>
          </p>
        </div>

        {/* Amount */}
        <p className="shrink-0 text-sm font-bold text-foreground">
          -{formatMoney(occ.amount)}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming || skipping}
          className="flex-1 rounded-full bg-foreground/90 py-2 text-xs font-semibold text-background transition-opacity disabled:opacity-50"
        >
          {confirming ? "Confirming..." : "Confirm Payment"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={confirming || skipping}
          className="rounded-full border border-border/40 px-4 py-2 text-xs font-semibold text-foreground/50 transition-opacity disabled:opacity-50"
        >
          {skipping ? "..." : "Skip"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HomeActivityList({
  loading,
  error,
  transactions,
  pendingBills = [],
  view,
  terminology,
  onBillConfirmed,
}: HomeActivityListProps) {
  const visibleTransactions = getVisibleTransactions(transactions, view);
  const groupedTransactions = groupTransactionsByDay(visibleTransactions);
  const headerTitle = getHeaderTitle(view, terminology);
  const emptyStateMessage = getEmptyStateMessage(view);

  // Only show pending bills in balance/expenses views, not when income-only
  const visiblePendingBills =
    view === "income" ? [] : pendingBills;

  return (
    <div className="layer-transactions relative z-20 flex-1 px-5 pb-28 pt-5" style={{ marginTop: 8 }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-foreground">{headerTitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {visiblePendingBills.length > 0 && (
            <Link
              href="/bills"
              className="text-[11px] font-semibold normal-case tracking-normal text-warning hover:text-warning/80"
            >
              {visiblePendingBills.length} due
            </Link>
          )}
          <Link
            href="/integrations"
            className="text-[11px] font-semibold normal-case tracking-normal text-primary hover:text-primary-hover"
          >
            + Integrations
          </Link>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-2 rounded-xl bg-foreground/[0.03] px-4 py-3.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      )}

      {!loading && Boolean(error) && (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Pending bill confirm cards */}
      {!loading && !error && visiblePendingBills.length > 0 && (
        <div className="mb-5 space-y-3">
          <p className="text-[11px] font-semibold normal-case tracking-normal text-muted">
            BILLS TO CONFIRM
          </p>
          {visiblePendingBills.map((occ) => (
            <PendingBillCard
              key={occ.id}
              occ={occ}
              onActioned={() => onBillConfirmed?.()}
            />
          ))}
        </div>
      )}

      {!loading && !error && groupedTransactions.length === 0 && visiblePendingBills.length === 0 && (
        <div className="rounded-xl bg-foreground/[0.03] px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground/55">{emptyStateMessage}</p>
        </div>
      )}

      {!loading && !error && groupedTransactions.length > 0 && (
        <div className="space-y-6">
          {groupedTransactions.map((group) => (
            <section key={group.key}>
              <p className="text-[11px] font-semibold normal-case tracking-normal text-muted">
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
                  const shoppingSessionId = tx.shopping_session?.id;
                  const rowHref = receiptId
                    ? `/receive/receipt/${receiptId}`
                    : tx.source === "shopping" && shoppingSessionId
                      ? `/shopping/orders/${shoppingSessionId}`
                      : null;

                  const row = (
                    <div
                      className={`flex items-center gap-3 py-3 ${
                        rowHref
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
                          {receiptId
                            ? " - View Photo"
                            : tx.source === "shopping" && shoppingSessionId
                              ? " - Resolve Receipt"
                              : ""}
                        </p>
                      </div>
                      <p className={`shrink-0 tabular-nums text-sm font-bold ${amountClass}`}>
                        {signedAmount}
                      </p>
                    </div>
                  );

                  return rowHref ? (
                    <Link key={tx.id} href={rowHref} className="block">
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
