"use client";

import { useEffect, useRef, useState } from "react";
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
    color: "text-warning",
    bg: "bg-warning/15",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.085.837l.383 1.437m0 0L6.75 12h10.5l2.01-5.69a.75.75 0 0 0-.707-.997H5.104Zm1.146 6.69a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
      </svg>
    ),
  },
  uber_eats: {
    label: "Uber Eats",
    color: "text-success",
    bg: "bg-success/15",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 19.5l-3 1.5-3-1.5m0-4.5 3-1.5 3 1.5m-6 0V9.75m6 5.25V9.75" />
      </svg>
    ),
  },
  doordash: {
    label: "DoorDash",
    color: "text-danger",
    bg: "bg-danger/15",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  godaddy_pos: {
    label: "GoDaddy POS",
    color: "text-primary",
    bg: "bg-primary/15",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  manual: {
    label: "Manual",
    color: "text-muted",
    bg: "bg-foreground/5",
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

const HOME_SNAPSHOT_PERIOD: DashboardPeriod = "month";

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-foreground/6 ${className}`} />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement | null>(null);
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
    function handleDocumentClick(event: MouseEvent) {
      if (!navMenuRef.current) return;
      if (!navMenuRef.current.contains(event.target as Node)) {
        setNavMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNavMenuOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
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

      {/* ═══ Layer 1 – Balance (on the blue bg) ═══════════════════════ */}
      <div className="relative z-0 px-5 pt-5 pb-10">
        {/* Top bar: hamburger */}
        <div ref={navMenuRef} className="relative mb-8 flex items-center justify-end">
          <button
            type="button"
            aria-label="Open secondary navigation"
            aria-expanded={navMenuOpen}
            onClick={() => setNavMenuOpen((open) => !open)}
            className={`grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/8 transition-colors ${
              navMenuOpen ? "text-white" : "text-white/80"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>

          {/* Dropdown menu */}
          <div
            className={`absolute right-0 top-12 z-30 w-64 origin-top-right rounded-2xl border border-border/80 bg-card/95 p-2 shadow-[0_16px_30px_rgba(0,0,0,0.16)] backdrop-blur transition-all duration-150 ${
              navMenuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
            }`}
          >
            <div className="px-2 py-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Quick Access</p>
            </div>

            <button
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-foreground/4 text-foreground/70">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground/90">Search</p>
                <p className="text-xs text-muted">Coming soon</p>
              </div>
            </button>

            <Link href="/profile" onClick={() => setNavMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-foreground/4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">Profile</span>
              <svg className="ml-auto h-4 w-4 text-foreground/25" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5.25 6 6-6 6" /></svg>
            </Link>

            <Link href="/reports" onClick={() => setNavMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-foreground/4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 18.75V14.5m5.25 4.25V9.5m5.25 9.25V5.25" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">Reports</span>
              <svg className="ml-auto h-4 w-4 text-foreground/25" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5.25 6 6-6 6" /></svg>
            </Link>

            <Link href="/contacts" onClick={() => setNavMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-foreground/4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.75 1.03 8.966 8.966 0 0 1-4.5 1.252c-1.33 0-2.59-.291-3.72-.811M12 6.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm-9.75 12a9.02 9.02 0 0 1 6.22-8.568m7.06 8.568A9.02 9.02 0 0 0 9.31 10.182" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">Contacts</span>
              <svg className="ml-auto h-4 w-4 text-foreground/25" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5.25 6 6-6 6" /></svg>
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
              <p className={`text-[44px] font-bold tracking-tight leading-none ${net >= 0 ? "text-white" : "text-red-400"}`}>
                {net < 0 ? "-" : ""}
                <span className="mr-0.5 text-[28px] font-semibold text-white/50">$</span>
                {new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(net)).replace(/,/g, " ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Layer 2 – Income / Spent (lighter blue card) ═════════════ */}
      <div className="layer-summary-fill flex flex-1 flex-col">
      <div className="layer-summary relative z-10 px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 rounded-lg bg-white/10" />
            <Skeleton className="h-12 rounded-lg bg-white/10" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">Income</p>
              <p className="mt-1.5 text-xl font-bold text-white">{formatMoney(income)}</p>
            </div>
            <div className="text-center border-l border-white/20">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">Spent</p>
              <p className="mt-1.5 text-xl font-bold text-white">{formatMoney(expenses)}</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Layer 3 – Transactions (card-colored sheet) ══════════════ */}
      <div className="layer-transactions relative z-20 flex-1 px-5 pt-5 pb-28">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[17px] font-bold text-foreground">Transactions</p>
          <div className="w-8 h-8 rounded-full bg-foreground/6 grid place-items-center">
            <svg className="w-4 h-4 text-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5 rounded-2xl px-3 py-3">
                <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-foreground/4 flex items-center justify-center">
              <svg className="w-8 h-8 text-foreground/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground/45">No transactions yet</p>
            <p className="text-xs text-foreground/35 mt-1">Commit a shopping session to see expenses here</p>
          </div>
        )}

        {!loading && !error && data && data.transactions.length > 0 && (
          <div className="space-y-1">
            {data.transactions.map((tx) => {
              const meta = SOURCE_META[tx.source];
              const amount = asNumber(tx.amount);
              const isIncome = tx.type === "income";
              const label = tx.description ?? tx.shopping_session?.store_name ?? meta.label;
              const receiptId = tx.shopping_session?.receipt_id;

              const card = (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3.5 rounded-2xl px-3 py-3 ${receiptId ? "active:scale-[0.98] transition-transform active:bg-foreground/3" : ""}`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate">{label}</p>
                    <p className="text-[11px] text-muted font-medium mt-0.5">{formatDate(tx.occurred_at)}</p>
                  </div>
                  <p className={`text-[15px] font-bold shrink-0 tabular-nums ${isIncome ? "text-primary" : "text-foreground"}`}>
                    <span className="text-[13px] font-semibold text-foreground/50 mr-0.5">$</span>
                    {" "}
                    {new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount))}
                  </p>
                  {receiptId && (
                    <svg className="w-4 h-4 text-foreground/20 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              );

              return receiptId ? (
                <Link key={tx.id} href={`/receive/receipt/${receiptId}`}>{card}</Link>
              ) : (
                card
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Nav ─────────────────────────────────────────────────── */}
      </div>
      <BottomNav enabledModules={enabledModules ?? undefined} />
      </div>
      </div>
    </BusinessConfigProvider>
  );
}
