"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDashboardSummary, type DashboardPeriod } from "@/app/actions/core/financial";
import { getCurrentBusinessConfigAction } from "@/app/actions/core/modules";
import { BottomNav } from "@/components/nav/bottom-nav";
import { DashboardSideNav } from "@/components/nav/dashboard-side-nav";
import { BusinessConfigProvider } from "@/lib/config/context";
import { getTerminology } from "@/lib/config/terminology";
import type { IndustryType } from "@/lib/generated/prisma/client";
import type { HomeDashboardSummary } from "@/features/home/shared/dashboard-summary.contracts";
import { TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY } from "@/features/table-service/shared";
import {
  HOME_QUICK_ACTION_DEFINITIONS,
  getHomeQuickActionSnapshotKey,
  parseHomeQuickActionSnapshotKey,
  subscribeToHomeQuickActions,
  type HomeQuickActionAvailabilityContext,
  type HomeQuickActionId,
} from "@/shared/utils/home-quick-actions";
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

function QuickActionIcon({ actionId }: { actionId: HomeQuickActionId }) {
  if (actionId === "scan_barcode") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25h2.25v13.5H4.5V5.25Zm4.5 0h1.5v13.5H9V5.25Zm3.75 0h1.5v13.5h-1.5V5.25Zm4.5 0h2.25v13.5h-2.25V5.25Z" />
      </svg>
    );
  }

  if (actionId === "reports") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 16.5v-6m5.25 6v-9m5.25 9v-3" />
      </svg>
    );
  }

  if (actionId === "contacts" || actionId === "staff") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.75 1.03 8.966 8.966 0 0 1-4.5 1.252c-1.33 0-2.59-.291-3.72-.811M12 6.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm-9.75 12a9.02 9.02 0 0 1 6.22-8.568m7.06 8.568A9.02 9.02 0 0 0 9.31 10.182" />
      </svg>
    );
  }

  if (actionId === "schedule") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75" />
      </svg>
    );
  }

  if (actionId === "inventory") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25" />
      </svg>
    );
  }

  if (actionId === "shopping_session" || actionId === "shopping_orders") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386a1.125 1.125 0 0 1 1.09.848l.383 1.527m0 0h14.64a1.125 1.125 0 0 1 1.092 1.394l-1.2 4.8a1.125 1.125 0 0 1-1.092.856H7.5m-2.39-6.05L6.75 12.75m0 0A2.25 2.25 0 1 0 9 15m-2.25-2.25h10.5M9 15a2.25 2.25 0 1 0 4.5 0" />
      </svg>
    );
  }

  if (
    actionId === "service_tables" ||
    actionId === "service_kitchen" ||
    actionId === "service_menu"
  ) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25h15M6 5.25v11.5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5.25M9.75 10.5h4.5m-4.5 3h4.5" />
      </svg>
    );
  }

  if (actionId === "documents_inbox" || actionId === "documents_analytics") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5m3.75 0h4.5m0 0-1.5-1.5m1.5 1.5-1.5 1.5" />
      </svg>
    );
  }

  if (actionId === "integrations") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5m-7.5 9h7.5M6 12h12m-9.75 6.75h7.5a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-7.5A2.25 2.25 0 0 0 6 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    );
  }

  if (actionId === "intake_hub") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664" />
    </svg>
  );
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

  function loadDashboard() {
    getDashboardSummary(HOME_SNAPSHOT_PERIOD)
      .then((res) => setData(res as DashboardData))
      .catch(() => setError("Failed to load financial data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const pendingBills = data?.pendingBills ?? [];
  const terminology = getTerminology(industryType);
  const quickActionContext = useMemo<HomeQuickActionAvailabilityContext>(
    () => ({
      enabledModules: enabledModules ?? [],
      industryType,
    }),
    [enabledModules, industryType],
  );

  const quickActionSnapshotKey = useSyncExternalStore(
    subscribeToHomeQuickActions,
    () => getHomeQuickActionSnapshotKey(quickActionContext),
    () => getHomeQuickActionSnapshotKey(quickActionContext),
  );

  const quickActionIds = useMemo(
    () => parseHomeQuickActionSnapshotKey(quickActionSnapshotKey, quickActionContext),
    [quickActionSnapshotKey, quickActionContext],
  );

  const quickActions = useMemo(() => {
    const definitionMap = new Map(
      HOME_QUICK_ACTION_DEFINITIONS.map((action) => [action.id, action]),
    );

    return quickActionIds
      .map((id) => definitionMap.get(id))
      .filter((action): action is (typeof HOME_QUICK_ACTION_DEFINITIONS)[number] =>
        Boolean(action),
      );
  }, [quickActionIds]);

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
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-[1920px]">
          <DashboardSideNav enabledModules={enabledModules ?? []} />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-24 md:pb-0">
            <div className="layer-stack min-h-screen w-full">
              <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col xl:max-w-7xl">
                <div className="flex flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="layer-balance relative px-5 pb-10 pt-5 xl:pb-6">
                    <div className="relative z-10 mb-7">
                      <div className="grid w-full grid-cols-20 items-center gap-2">
                        <Link
                          href="/settings"
                          aria-label="Settings"
                          className="col-span-3 justify-self-center grid h-10 w-10 place-items-center rounded-full bg-background/50 text-foreground/75 transition-colors hover:bg-background/65 md:hidden"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                            />
                          </svg>
                        </Link>

                        <button
                          type="button"
                          disabled
                          aria-label="Search (coming soon)"
                          className="col-span-11 flex h-10 items-center gap-2 rounded-full bg-background/50 px-3.5 text-foreground/55 md:col-span-20"
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                          </svg>
                          <span className="truncate text-xs font-medium">Search</span>
                        </button>

                        <Link
                          href="/reports"
                          aria-label="Reports"
                          className="col-span-3 justify-self-center grid h-10 w-10 place-items-center rounded-full bg-background/50 text-foreground/75 transition-colors hover:bg-background/65 md:hidden"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.6} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 16.5v-6m5.25 6v-9m5.25 9v-3" />
                          </svg>
                        </Link>

                        <Link
                          href="/contacts"
                          aria-label="Contacts"
                          className="col-span-3 justify-self-center grid h-10 w-10 place-items-center rounded-full bg-background/50 text-foreground/75 transition-colors hover:bg-background/65 md:hidden"
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
                          <p className="text-[34px] font-normal leading-none tracking-tight text-white">
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

                      <div className="mt-5 grid w-full grid-cols-2 gap-3 md:grid-cols-4">
                        {quickActions.map((action) => (
                          <Link
                            key={action.id}
                            href={action.href}
                            className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/22"
                          >
                            <QuickActionIcon actionId={action.id} />
                            <span className="truncate">{action.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="relative flex flex-1 flex-col">
                    <HomeActivityList
                      loading={loading}
                      error={error}
                      transactions={allTransactions}
                      pendingBills={pendingBills}
                      view={balanceView}
                      terminology={terminology}
                      onBillConfirmed={loadDashboard}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomNav enabledModules={enabledModules ?? undefined} />
      </div>
    </BusinessConfigProvider>
  );
}
