"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDashboardSummary, type DashboardPeriod } from "@/app/actions/core/financial";
import { getCurrentBusinessConfigAction } from "@/app/actions/core/modules";
import { BottomNav } from "@/components/nav/bottom-nav";
import { BusinessConfigProvider } from "@/lib/config/context";
import { getTerminology } from "@/lib/config/terminology";
import type { IndustryType } from "@/lib/generated/prisma/client";
import type { HomeDashboardSummary } from "@/features/home/shared/dashboard-summary.contracts";
import { TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY } from "@/features/table-service/shared";
import { HomeActivityList, type BalanceView } from "./HomeActivityList";
import { Skeleton } from "./home-financial-layer.shared";

type DashboardData = HomeDashboardSummary;

interface BusinessConfigData {
  industryType: IndustryType;
  enabledModules: string[];
}

const HOME_SNAPSHOT_PERIOD: DashboardPeriod = "month";
const BALANCE_VIEW_ORDER: BalanceView[] = ["balance", "income", "expenses"];

function cycleBalanceView(view: BalanceView): BalanceView {
  const currentIndex = BALANCE_VIEW_ORDER.indexOf(view);
  const nextIndex = (currentIndex + 1) % BALANCE_VIEW_ORDER.length;
  return BALANCE_VIEW_ORDER[nextIndex];
}

function formatHeroAmount(amount: number): string {
  const formatted = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Math.abs(amount))
    .replace(/,/g, " ");

  return `${amount < 0 ? "-" : ""}$${formatted}`;
}

function getBalanceViewLabel(view: BalanceView): string {
  if (view === "income") return "Income";
  if (view === "expenses") return "Expenses";
  return "Balance";
}

export function HomeDashboardClient() {
  const router = useRouter();
  const [balanceView, setBalanceView] = useState<BalanceView>("balance");
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
    getDashboardSummary(HOME_SNAPSHOT_PERIOD)
      .then((res) => setData(res as DashboardData))
      .catch(() => setError("Failed to load financial data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (industryType !== "restaurant") return;
    if (!enabledModules?.includes("table_service")) return;

    const mode = window.localStorage.getItem(TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY);
    if (mode === "kitchen") {
      router.replace("/service/kitchen");
    }
  }, [enabledModules, industryType, router]);

  const income = data?.income ?? 0;
  const expenses = data?.expenses ?? 0;
  const net = data?.net ?? 0;
  const allTransactions = data?.transactions ?? [];
  const terminology = getTerminology(industryType);

  const displayValue =
    balanceView === "balance" ? net : balanceView === "income" ? income : expenses;

  return (
    <BusinessConfigProvider
      config={{
        industryType,
        enabledModules: enabledModules ?? [],
        terminology,
      }}
    >
      <div className="layer-stack min-h-screen w-full">
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col">
          <div className="layer-balance relative px-5 pb-10 pt-5">
            <div className="pointer-events-none absolute inset-x-0 top-20 z-0 flex select-none justify-center">
              <Image
                src="/logotransparentbackground.svg"
                alt=""
                width={520}
                height={170}
                className="h-36 w-auto opacity-[0.18]"
                aria-hidden="true"
                priority
              />
            </div>

            <div className="relative z-10 mb-7">
              <div className="grid w-full grid-cols-20 items-center gap-2">
                <Link
                  href="/profile"
                  aria-label="Profile"
                  className="col-span-3 justify-self-center grid h-10 w-10 place-items-center rounded-full bg-background/50 text-foreground/75 transition-colors hover:bg-background/65"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 1 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </Link>

                <button
                  type="button"
                  disabled
                  aria-label="Search (coming soon)"
                  className="col-span-11 flex h-10 items-center gap-2 rounded-full bg-background/50 px-3.5 text-foreground/55"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                  </svg>
                  <span className="truncate text-xs font-medium">Search</span>
                </button>

                <Link
                  href="/reports"
                  aria-label="Reports"
                  className="col-span-3 justify-self-center grid h-10 w-10 place-items-center rounded-full bg-background/50 text-foreground/75 transition-colors hover:bg-background/65"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.6} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 16.5v-6m5.25 6v-9m5.25 9v-3" />
                  </svg>
                </Link>

                <Link
                  href="/contacts"
                  aria-label="Contacts"
                  className="col-span-3 justify-self-center grid h-10 w-10 place-items-center rounded-full bg-background/50 text-foreground/75 transition-colors hover:bg-background/65"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.75 1.03 8.966 8.966 0 0 1-4.5 1.252c-1.33 0-2.59-.291-3.72-.811M12 6.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm-9.75 12a9.02 9.02 0 0 1 6.22-8.568m7.06 8.568A9.02 9.02 0 0 0 9.31 10.182" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="relative z-10 mt-12 flex flex-col items-center text-center">
              <p className="text-[11px] font-semibold normal-case tracking-normal text-white/55">
                {getBalanceViewLabel(balanceView)}
              </p>
              <div className="mt-2 min-h-11">
                {loading ? (
                  <Skeleton className="mx-auto h-11 w-52 rounded-xl bg-white/20" />
                ) : (
                  <p className="text-[44px] font-bold leading-none tracking-tight text-white">
                    {formatHeroAmount(displayValue)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setBalanceView((prev) => cycleBalanceView(prev))}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/16 hover:text-white"
                aria-label="Toggle balance view"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 19.5-7.5-7.5 7.5-7.5" />
                </svg>
                <span>{getBalanceViewLabel(balanceView)}</span>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              <div className="mt-5 flex w-full gap-3">
                <Link
                  href="/receive/photo"
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-background/50 px-4 text-foreground/75 transition-colors hover:bg-background/65"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5m3.75 0h4.5m0 0-1.5-1.5m1.5 1.5-1.5 1.5" />
                  </svg>
                  <span className="text-xs font-semibold">Add Receipt</span>
                </Link>
                <Link
                  href="/receive/barcode"
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-background/50 px-4 text-foreground/75 transition-colors hover:bg-background/65"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25h2.25v13.5H4.5V5.25Zm4.5 0h1.5v13.5H9V5.25Zm3.75 0h1.5v13.5h-1.5V5.25Zm4.5 0h2.25v13.5h-2.25V5.25Z" />
                  </svg>
                  <span className="text-xs font-semibold">Scan Barcode</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 flex-col">
            <HomeActivityList
              loading={loading}
              error={error}
              transactions={allTransactions}
              view={balanceView}
              terminology={terminology}
            />
          </div>

          <BottomNav enabledModules={enabledModules ?? undefined} />
        </div>
      </div>
    </BusinessConfigProvider>
  );
}
