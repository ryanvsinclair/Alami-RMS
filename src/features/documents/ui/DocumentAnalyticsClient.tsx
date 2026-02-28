"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getCogsSummary,
  getPriceTrends,
  getReorderSignals,
  getTaxSummary,
  getVendorSpendSummary,
} from "@/app/actions/modules/documents";
import type {
  CogsSummaryResult,
  DocumentAnalyticsPeriodFilter,
  PriceTrendResult,
  ReorderSignalsResult,
  TaxSummaryResult,
  VendorSpendSummaryResult,
} from "@/features/documents/shared";

type PeriodPreset = 30 | 60 | 90 | "custom";

function formatMoney(value: number | null | undefined) {
  const amount = value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString();
}

function buildPeriodPayload(
  periodPreset: PeriodPreset,
  customStart: string,
  customEnd: string,
): DocumentAnalyticsPeriodFilter | null {
  if (periodPreset !== "custom") {
    return { days: periodPreset };
  }

  if (!customStart || !customEnd) {
    return null;
  }

  return {
    startDate: customStart,
    endDate: customEnd,
  };
}

function buildTrendPath(unitCosts: number[]) {
  const width = 520;
  const height = 180;
  const padding = 16;

  if (unitCosts.length === 0) {
    return { width, height, points: "", circles: [] as Array<{ x: number; y: number }> };
  }

  const min = Math.min(...unitCosts);
  const max = Math.max(...unitCosts);
  const range = Math.max(max - min, 1);
  const stepX = unitCosts.length > 1 ? (width - (padding * 2)) / (unitCosts.length - 1) : 0;

  const circles = unitCosts.map((value, index) => {
    const x = padding + (stepX * index);
    const normalized = (value - min) / range;
    const y = (height - padding) - (normalized * (height - (padding * 2)));
    return { x, y };
  });

  return {
    width,
    height,
    points: circles.map((point) => `${point.x},${point.y}`).join(" "),
    circles,
  };
}

export function DocumentAnalyticsClient() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [error, setError] = useState("");

  const [vendorSpend, setVendorSpend] = useState<VendorSpendSummaryResult | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryResult | null>(null);
  const [cogsSummary, setCogsSummary] = useState<CogsSummaryResult | null>(null);
  const [reorderSignals, setReorderSignals] = useState<ReorderSignalsResult | null>(null);
  const [priceTrend, setPriceTrend] = useState<PriceTrendResult | null>(null);

  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");

  const periodPayload = useMemo(
    () => buildPeriodPayload(periodPreset, customStart, customEnd),
    [periodPreset, customEnd, customStart],
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    if (!periodPayload) {
      setLoading(false);
      setError("Select both custom start and end dates to load analytics.");
      return;
    }

    try {
      const spend = await getVendorSpendSummary({ period: periodPayload }) as VendorSpendSummaryResult;
      setVendorSpend(spend);

      setSelectedVendorId((currentVendorId) => {
        if (currentVendorId && spend.summary.some((entry) => entry.vendorId === currentVendorId)) {
          return currentVendorId;
        }
        return spend.summary[0]?.vendorId ?? "";
      });

      if (!spend.minimumDataSatisfied) {
        setTaxSummary(null);
        setCogsSummary(null);
        setReorderSignals(null);
        setPriceTrend(null);
        setLoading(false);
        return;
      }

      const [tax, cogs, reorder] = await Promise.all([
        getTaxSummary({ period: periodPayload }) as Promise<TaxSummaryResult>,
        getCogsSummary({ period: periodPayload }) as Promise<CogsSummaryResult>,
        getReorderSignals() as Promise<ReorderSignalsResult>,
      ]);

      setTaxSummary(tax);
      setCogsSummary(cogs);
      setReorderSignals(reorder);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load document analytics.");
      setVendorSpend(null);
      setTaxSummary(null);
      setCogsSummary(null);
      setReorderSignals(null);
      setPriceTrend(null);
    } finally {
      setLoading(false);
    }
  }, [periodPayload]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    setSelectedItemName("");
  }, [selectedVendorId]);

  useEffect(() => {
    if (!periodPayload || !selectedVendorId || !vendorSpend?.minimumDataSatisfied) {
      setPriceTrend(null);
      return;
    }

    let active = true;
    setLoadingTrend(true);

    getPriceTrends(selectedVendorId, {
      period: periodPayload,
      rawLineItemName: selectedItemName || undefined,
    })
      .then((result) => {
        if (!active) return;
        setPriceTrend(result as PriceTrendResult);
      })
      .catch((loadError) => {
        if (!active) return;
        setPriceTrend(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load price trend data.");
      })
      .finally(() => {
        if (!active) return;
        setLoadingTrend(false);
      });

    return () => {
      active = false;
    };
  }, [periodPayload, selectedItemName, selectedVendorId, vendorSpend?.minimumDataSatisfied]);

  const topVendorMaxSpend = useMemo(() => {
    const values = (vendorSpend?.summary ?? []).slice(0, 10).map((entry) => entry.totalSpend);
    return values.length ? Math.max(...values, 1) : 1;
  }, [vendorSpend?.summary]);

  const trendUnitCosts = useMemo(
    () => (priceTrend?.points ?? [])
      .map((point) => point.unitCost)
      .filter((value): value is number => value != null),
    [priceTrend?.points],
  );

  const trendPath = useMemo(
    () => buildTrendPath(trendUnitCosts),
    [trendUnitCosts],
  );

  const selectedVendorName = useMemo(
    () => vendorSpend?.summary.find((entry) => entry.vendorId === selectedVendorId)?.vendorName ?? "Unknown Vendor",
    [selectedVendorId, vendorSpend?.summary],
  );

  const supportsAnalytics = vendorSpend?.minimumDataSatisfied ?? false;

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--surface-card-shadow)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Documents</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Analytics</h1>
            <p className="mt-2 text-sm text-muted">
              Vendor spend, price trends, reorder risk, tax totals, and COGS from posted document drafts.
            </p>
          </div>
          <Link href="/documents" className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80 hover:text-foreground">
            Inbox
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[30, 60, 90].map((days) => (
            <Button
              key={days}
              size="sm"
              variant={periodPreset === days ? "primary" : "secondary"}
              onClick={() => setPeriodPreset(days as 30 | 60 | 90)}
            >
              {days}d
            </Button>
          ))}
          <Button
            size="sm"
            variant={periodPreset === "custom" ? "primary" : "secondary"}
            onClick={() => setPeriodPreset("custom")}
          >
            Custom
          </Button>
        </div>

        {periodPreset === "custom" ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              Start date
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              End date
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`analytics-skeleton-${index}`}
              className="h-28 animate-pulse rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
      ) : null}

      {!loading && vendorSpend && !supportsAnalytics ? (
        <section className="rounded-2xl border border-border bg-card px-4 py-5 text-sm text-muted">
          Analytics requires at least
          {" "}
          <span className="font-semibold text-foreground">
            {vendorSpend.minimumPostedDraftsRequired}
          </span>
          {" "}
          posted drafts.
          Current total posted drafts:
          {" "}
          <span className="font-semibold text-foreground">
            {vendorSpend.totalPostedDraftCount}
          </span>
          .
        </section>
      ) : null}

      {!loading && vendorSpend && supportsAnalytics ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vendor Spend (Top 10)</p>
              <p className="text-xs text-muted">
                Period drafts:
                {" "}
                <span className="font-semibold text-foreground">{vendorSpend.postedDraftCount}</span>
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {vendorSpend.summary.slice(0, 10).map((entry) => {
                const widthPercent = Math.max(6, (entry.totalSpend / topVendorMaxSpend) * 100);
                const active = selectedVendorId === entry.vendorId;

                return (
                  <button
                    key={entry.vendorId}
                    type="button"
                    onClick={() => setSelectedVendorId(entry.vendorId)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      active ? "border-foreground/25 bg-foreground/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{entry.vendorName}</span>
                      <span className="text-sm text-foreground">{formatMoney(entry.totalSpend)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${widthPercent}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Price Trend</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedVendorId}
                  onChange={(event) => setSelectedVendorId(event.target.value)}
                  className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground"
                >
                  {vendorSpend.summary.map((entry) => (
                    <option key={entry.vendorId} value={entry.vendorId}>
                      {entry.vendorName}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedItemName}
                  onChange={(event) => setSelectedItemName(event.target.value)}
                  className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground"
                >
                  <option value="">All items</option>
                  {(priceTrend?.availableItemNames ?? []).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-2 text-sm text-muted">Vendor: {selectedVendorName}</p>

            {loadingTrend ? (
              <div className="mt-3 h-36 animate-pulse rounded-xl border border-border" />
            ) : null}

            {!loadingTrend && trendPath.points ? (
              <div className="mt-3 rounded-xl border border-border p-3">
                <svg viewBox={`0 0 ${trendPath.width} ${trendPath.height}`} className="h-40 w-full" role="img" aria-label="Price trend">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    points={trendPath.points}
                    className="text-primary"
                  />
                  {trendPath.circles.map((circle, index) => (
                    <circle
                      key={`point-${index}`}
                      cx={circle.x}
                      cy={circle.y}
                      r="3"
                      className="fill-current text-primary"
                    />
                  ))}
                </svg>
                <p className="mt-2 text-xs text-muted">
                  {trendUnitCosts.length} unit-cost points in selected window.
                </p>
              </div>
            ) : null}

            {!loadingTrend && !trendPath.points ? (
              <p className="mt-3 text-sm text-muted">No trend points for this vendor/item in the selected period.</p>
            ) : null}

            {!loadingTrend && (priceTrend?.points.length ?? 0) > 0 ? (
              <div className="mt-3 space-y-1">
                {priceTrend?.points.slice(-6).map((point, index) => (
                  <div key={`${point.date}-${point.description}-${index}`} className="flex items-center justify-between rounded-lg border border-border px-2 py-1 text-xs">
                    <span className="text-foreground">{point.description}</span>
                    <span className="text-muted">
                      {formatDate(point.date)} | unit {formatMoney(point.unitCost)} | qty {point.quantity ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tax Summary</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Total Tax: {formatMoney(taxSummary?.totalTax)}</p>
            <div className="mt-3 space-y-2">
              {(taxSummary?.byVendor ?? []).slice(0, 10).map((entry) => (
                <div key={entry.vendorId} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">{entry.vendorName}</span>
                  <span className="text-foreground">{formatMoney(entry.taxTotal)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">COGS By Category</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Total Expense: {formatMoney(cogsSummary?.totalExpense)}</p>
            <div className="mt-3 space-y-2">
              {(cogsSummary?.byCategory ?? []).map((entry) => (
                <div key={entry.categoryName} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{entry.categoryName}</span>
                    <span className="text-foreground">{formatMoney(entry.totalExpense)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Reorder Signals (7 days or less)</p>
            <div className="mt-3 space-y-2">
              {(reorderSignals?.signals ?? []).map((signal) => (
                <div key={signal.inventoryItemId} className="rounded-xl border border-border px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{signal.inventoryItemName}</p>
                  <p className="text-xs text-muted">
                    Reorder in {signal.estimatedDaysUntilReorder}d | Last purchase {formatDate(signal.lastPurchaseAt)} | Avg interval {signal.avgPurchaseIntervalDays}d
                  </p>
                </div>
              ))}
              {(reorderSignals?.signals.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">No reorder signals in this window.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default DocumentAnalyticsClient;
