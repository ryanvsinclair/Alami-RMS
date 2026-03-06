"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import type { DashboardPeriod } from "@/app/actions/core/financial";

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "today", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="p-5 md:col-span-2 xl:col-span-3">
        <p className="text-xs normal-case tracking-normal text-muted">Reports</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Reports</h1>
        <p className="mt-2 text-sm text-muted">
          Analytics controls live here. Home stays a snapshot.
        </p>
          </Card>

          <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold normal-case tracking-normal text-muted">Time Range</p>
            <p className="mt-1 text-sm text-foreground">Choose a reporting window</p>
          </div>
          <div
            className="inline-flex rounded-xl border border-border bg-card/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            role="tablist"
            aria-label="Report time range"
          >
            {PERIOD_OPTIONS.map((option) => {
              const active = period === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPeriod(option.id)}
                  className={`min-w-[60px] rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    active
                      ? "bg-primary text-white shadow-[0_4px_12px_rgba(0,127,255,0.22)]"
                      : "text-muted hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
          </Card>

          <Card className="p-5 md:col-span-2 xl:col-span-2">
        <p className="text-xs normal-case tracking-normal text-primary">Financial Breakdown</p>
        <p className="mt-1 text-sm text-muted">
          {period === "today" ? "Daily" : period === "week" ? "Weekly" : "Monthly"} analytics panels can be added here.
        </p>
          </Card>
        </div>
      </DashboardPageContainer>
    </main>
  );
}
