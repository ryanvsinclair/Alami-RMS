import type { ReactNode } from "react";
import type { IndustryType } from "@/lib/generated/prisma/client";
import type {
  HomeDashboardFinancialTx,
  HomeIncomeBreakdownEntry,
} from "@/features/home/shared/dashboard-summary.contracts";

export function asNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return Number(v) || 0;
}

export function formatMoney(v: number | string | null | undefined, showSign = false): string {
  const n = asNumber(v);
  const formatted = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));

  if (showSign) return n >= 0 ? `+$${formatted}` : `-$${formatted}`;
  return `$${formatted}`;
}

export function formatDate(dateStr: string): string {
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

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-foreground/6 ${className}`} />;
}

export const SOURCE_META: Record<
  HomeDashboardFinancialTx["source"],
  { label: string; color: string; bg: string; icon: ReactNode }
> = {
  shopping: {
    label: "Shopping",
    color: "text-warning",
    bg: "bg-warning/15",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.085.837l.383 1.437m0 0L6.75 12h10.5l2.01-5.69a.75.75 0 0 0-.707-.997H5.104Zm1.146 6.69a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
      </svg>
    ),
  },
  uber_eats: {
    label: "Uber Eats",
    color: "text-success",
    bg: "bg-success/15",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 19.5l-3 1.5-3-1.5m0-4.5 3-1.5 3 1.5m-6 0V9.75m6 5.25V9.75" />
      </svg>
    ),
  },
  doordash: {
    label: "DoorDash",
    color: "text-danger",
    bg: "bg-danger/15",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  godaddy_pos: {
    label: "GoDaddy POS",
    color: "text-primary",
    bg: "bg-primary/15",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  manual: {
    label: "Manual",
    color: "text-muted",
    bg: "bg-foreground/5",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
      </svg>
    ),
  },
  document_intake: {
    label: "Document Intake",
    color: "text-muted",
    bg: "bg-foreground/5",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.75h8.25L18 7.5v12.75A1.5 1.5 0 0 1 16.5 21.75h-9A1.5 1.5 0 0 1 6 20.25V3.75Zm8.25 0v3.75H18M9 11.25h6M9 14.25h6M9 17.25h4.5" />
      </svg>
    ),
  },
};

const INCOME_SOURCE_ORDER_BY_INDUSTRY: Record<IndustryType, HomeDashboardFinancialTx["source"][]> = {
  restaurant: ["godaddy_pos", "uber_eats", "doordash", "manual"],
  salon: ["godaddy_pos", "manual", "uber_eats", "doordash"],
  retail: ["godaddy_pos", "manual", "uber_eats", "doordash"],
  contractor: ["manual", "godaddy_pos", "uber_eats", "doordash"],
  general: ["godaddy_pos", "manual", "uber_eats", "doordash"],
};

export function formatSourceLabel(source: HomeDashboardFinancialTx["source"]): string {
  return SOURCE_META[source]?.label ?? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getOrderedIncomeBreakdown(
  industryType: IndustryType,
  entries: HomeIncomeBreakdownEntry[] | null | undefined,
): HomeIncomeBreakdownEntry[] {
  if (!entries?.length) return [];

  const positiveEntries = entries.filter((entry) => asNumber(entry.amount) > 0);
  const preferredOrder = INCOME_SOURCE_ORDER_BY_INDUSTRY[industryType] ?? INCOME_SOURCE_ORDER_BY_INDUSTRY.general;
  const rank = new Map(preferredOrder.map((source, index) => [source, index] as const));

  return [...positiveEntries].sort((a, b) => {
    const aRank = rank.get(a.source) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.source) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return asNumber(b.amount) - asNumber(a.amount);
  });
}
