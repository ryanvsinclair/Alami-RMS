"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardSummary, type DashboardPeriod } from "@/app/actions/core/financial";
import { getCurrentBusinessConfigAction } from "@/app/actions/core/modules";
import { BottomNav } from "@/components/nav/bottom-nav";
import { BusinessConfigProvider } from "@/lib/config/context";
import { getTerminology } from "@/lib/config/terminology";
import type { IndustryType } from "@/lib/generated/prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FinancialTx {
  id: string;
  type: "income" | "expense";
  source: "godaddy_pos" | "uber_eats" | "doordash" | "shopping" | "manual";
  amount: number | string;
  description: string | null;
  occurred_at: string;
  shopping_session: { store_name: string | null; store_address: string | null; receipt_id: string | null } | null;
}

interface DashboardData {
  period: DashboardPeriod;
  businessName: string;
  income: number;
  expenses: number;
  net: number;
  transactions: FinancialTx[];
}

interface BusinessConfigData {
  industryType: IndustryType;
  enabledModules: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return Number(v) || 0;
}

function formatMoney(v: number | string | null | undefined, showSign = false): string {
  const n = asNumber(v);
  const formatted = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  if (showSign) return n >= 0 ? `+$${formatted}` : `-$${formatted}`;
  return `$${formatted}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return `Today · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const SOURCE_META: Record<
  FinancialTx["source"],
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  shopping: {
    label: "Shopping",
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.085.837l.383 1.437m0 0L6.75 12h10.5l2.01-5.69a.75.75 0 0 0-.707-.997H5.104Zm1.146 6.69a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
      </svg>
    ),
  },
  uber_eats: {
    label: "Uber Eats",
    color: "text-green-400",
    bg: "bg-green-500/20",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 19.5l-3 1.5-3-1.5m0-4.5 3-1.5 3 1.5m-6 0V9.75m6 5.25V9.75" />
      </svg>
    ),
  },
  doordash: {
    label: "DoorDash",
    color: "text-red-400",
    bg: "bg-red-500/20",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  godaddy_pos: {
    label: "GoDaddy POS",
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  manual: {
    label: "Manual",
    color: "text-slate-400",
    bg: "bg-slate-500/20",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
      </svg>
    ),
  },
};

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.07] ${className}`} />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
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
    getDashboardSummary(period)
      .then((res) => setData(res as DashboardData))
      .catch(() => setError("Failed to load financial data"))
      .finally(() => setLoading(false));
  }, [period]);

  const income = data?.income ?? 0;
  const expenses = data?.expenses ?? 0;
  const net = data?.net ?? 0;
  const maxBar = Math.max(income, expenses, 1);
  const terminology = getTerminology(industryType);

  return (
    <BusinessConfigProvider
      config={{
        industryType,
        enabledModules: enabledModules ?? [],
        terminology,
      }}
    >
      <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto pb-24">
      <div className="px-4 pt-4">
        <div className="mx-auto flex items-center gap-2">
            <Link
              href="/profile"
              aria-label="Profile"
              className="group relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/18 bg-[radial-gradient(circle_at_30%_28%,#eedbc8_0%,#cfae93_36%,#6f5240_72%,#322821_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_6px_16px_rgba(0,0,0,0.28)] transition-transform hover:scale-[1.02]"
            >
              <svg className="h-5 w-5 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
            </Link>

            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <input
                type="search"
                readOnly
                placeholder="Search"
                aria-label="Search (coming soon)"
                className="h-10 w-full rounded-full border border-[rgba(128,164,202,0.22)] bg-[linear-gradient(180deg,rgba(10,24,42,0.9)_0%,rgba(8,19,34,0.92)_100%)] pl-9 pr-3 text-sm text-white/90 placeholder:text-white/35 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              />
            </div>

            <Link
              href="/reports"
              aria-label="Reports"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(128,164,202,0.22)] bg-[linear-gradient(180deg,rgba(10,24,42,0.9)_0%,rgba(8,19,34,0.92)_100%)] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-white/20 hover:text-[#3de38d]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 18.75V14.5m5.25 4.25V9.5m5.25 9.25V5.25" />
              </svg>
            </Link>
        </div>
      </div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mx-4 mt-4">
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #0f2744 0%, #091a2e 60%, #080d14 100%)",
            boxShadow:
              "0 20px 60px rgba(6,193,103,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Ambient glow */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(6,193,103,0.18) 0%, transparent 70%)",
            }}
          />

          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">
              Net Position
            </p>
            <div className="flex items-center gap-1 rounded-2xl bg-white/[0.07] p-1">
              {(["today", "week", "month"] as DashboardPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold tracking-wide uppercase transition-all ${
                    period === p
                      ? "bg-[#06c167] text-white shadow-sm"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  {p === "today" ? "Day" : p === "week" ? "Wk" : "Mo"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <>
              <Skeleton className="h-10 w-40 mb-4" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-full mb-4" />
              <div className="flex gap-3">
                <Skeleton className="h-14 flex-1" />
                <Skeleton className="h-14 flex-1" />
                <Skeleton className="h-14 flex-1" />
              </div>
            </>
          ) : (
            <>
              {/* Net amount */}
              <p
                className={`text-4xl font-bold tracking-tight mb-1 ${
                  net >= 0 ? "text-white" : "text-red-400"
                }`}
              >
                {net < 0 ? "-" : ""}
                <span className="text-2xl font-semibold text-white/50 mr-0.5">$</span>
                {new Intl.NumberFormat("en-CA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(Math.abs(net))}
              </p>
              <p className="text-xs text-white/40 mb-5">{PERIOD_LABELS[period]}</p>

              {/* Progress bars */}
              <div className="space-y-2.5 mb-5">
                <div>
                  <div className="flex justify-between text-[11px] text-white/50 mb-1.5">
                    <span className="uppercase tracking-wide font-semibold">Money In</span>
                    <span className="text-[#06c167] font-bold">{formatMoney(income)}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#06c167] rounded-full transition-all duration-700"
                      style={{ width: `${(income / maxBar) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-white/50 mb-1.5">
                    <span className="uppercase tracking-wide font-semibold">Money Out</span>
                    <span className="text-red-400 font-bold">{formatMoney(expenses)}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-700"
                      style={{ width: `${(expenses / maxBar) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stat pills */}
              <div className="flex gap-2.5">
                <div className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2.5 border border-white/[0.06]">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-semibold mb-0.5">
                    Income
                  </p>
                  <p className="text-sm font-bold text-[#06c167]">{formatMoney(income)}</p>
                </div>
                <div className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2.5 border border-white/[0.06]">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-semibold mb-0.5">
                    Expenses
                  </p>
                  <p className="text-sm font-bold text-red-400">{formatMoney(expenses)}</p>
                </div>
                <div className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2.5 border border-white/[0.06]">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-semibold mb-0.5">
                    Net P&amp;L
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      net >= 0 ? "text-[#06c167]" : "text-red-400"
                    }`}
                  >
                    {formatMoney(net, true)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div className="px-4 mt-5">
        <Link
          href="/contacts"
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors active:scale-[0.98]"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-[#06c167]/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#06c167]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Contacts</p>
            <p className="text-[11px] text-white/40">Distributors, vendors &amp; suppliers</p>
          </div>
          <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* ── Transaction Feed ────────────────────────────────────────────── */}
      <div className="px-4 mt-7">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Transactions</p>
          {data && data.transactions.length > 0 && (
            <span className="text-[11px] text-white/40 font-semibold">
              {PERIOD_LABELS[period]}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-4 flex gap-3 items-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && data?.transactions.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.05] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white/20"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white/30">No transactions yet</p>
            <p className="text-xs text-white/20 mt-1">
              Commit a shopping session to see expenses here
            </p>
          </div>
        )}

        {!loading && !error && data && data.transactions.length > 0 && (
          <div className="space-y-2">
            {data.transactions.map((tx) => {
              const meta = SOURCE_META[tx.source];
              const amount = asNumber(tx.amount);
              const isIncome = tx.type === "income";
              const label =
                tx.description ??
                tx.shopping_session?.store_name ??
                meta.label;
              const receiptId = tx.shopping_session?.receipt_id;

              const card = (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${receiptId ? "active:scale-[0.98] transition-transform" : ""}`}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{label}</p>
                    <p className="text-[11px] text-white/40 font-medium mt-0.5">
                      {formatDate(tx.occurred_at)}
                      <span className="mx-1.5 opacity-40">·</span>
                      <span className={meta.color}>{meta.label}</span>
                    </p>
                  </div>
                  <p
                    className={`text-sm font-bold shrink-0 ${
                      isIncome ? "text-[#06c167]" : "text-white/80"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {formatMoney(amount)}
                  </p>
                  {receiptId && (
                    <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
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
      </div>

      {/* ── Bottom Nav ─────────────────────────────────────────────────── */}
      <BottomNav enabledModules={enabledModules ?? undefined} />
      </div>
    </BusinessConfigProvider>
  );
}
