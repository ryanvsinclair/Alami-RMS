"use client";

/**
 * Operational Calendar — master calendar shell (OC-02/OC-03).
 *
 * Renders the primary Schedule surface with:
 *  - Day / Week / Month view toggle (Week is the default per plan)
 *  - Source visibility toggles (Manual, Internal, Provider)
 *  - Industry-aware section header derived from CALENDAR_EVENT_EMPHASIS_BY_INDUSTRY
 *  - SourceHealthBar: per-provider sync status summary (OC-03)
 *  - Empty event grid placeholder (populated in OC-04+ with real data)
 *  - "New Event" CTA stub (full creation flow in later phases)
 *
 * No DB queries or server actions in this component — pure UI shell.
 * All data fetching wired in OC-04 (Phase 3) once the event schema is defined.
 */

import { useState } from "react";
import { useBusinessConfig } from "@/lib/config/context";
import {
  CALENDAR_VIEW_MODES,
  DEFAULT_CALENDAR_VIEW,
  CALENDAR_EVENT_SOURCES,
  CALENDAR_EVENT_EMPHASIS_BY_INDUSTRY,
  type CalendarViewMode,
  type CalendarEventSource,
  type CalendarProviderSyncCard,
  type CalendarSourceHealthSummary,
  deriveCalendarSourceHealth,
} from "@/features/schedule/shared";

// ---------------------------------------------------------------------------
// View mode labels
// ---------------------------------------------------------------------------

const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = {
  day:   "Day",
  week:  "Week",
  month: "Month",
};

// ---------------------------------------------------------------------------
// Source labels and color accents
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<CalendarEventSource, string> = {
  manual:   "Manual",
  internal: "Internal",
  provider: "Connected",
};

const SOURCE_COLOR: Record<CalendarEventSource, string> = {
  manual:   "bg-blue-400",
  internal: "bg-emerald-400",
  provider: "bg-violet-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScheduleClient() {
  const { industryType } = useBusinessConfig();

  const [viewMode, setViewMode] = useState<CalendarViewMode>(DEFAULT_CALENDAR_VIEW);
  const [visibleSources, setVisibleSources] = useState<Set<CalendarEventSource>>(
    new Set(CALENDAR_EVENT_SOURCES)
  );

  // Industry-aware emphasis label — pick the first emphasized event type as context hint.
  const emphasisTypes = CALENDAR_EVENT_EMPHASIS_BY_INDUSTRY[industryType] ??
    CALENDAR_EVENT_EMPHASIS_BY_INDUSTRY["general"];

  function toggleSource(source: CalendarEventSource) {
    setVisibleSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        // Always keep at least one source visible.
        if (next.size > 1) next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  // Phase shell: no providers connected yet — empty card list.
  // Real provider sync cards wired in OC-04 via server data layer.
  const providerSyncCards: CalendarProviderSyncCard[] = [];

  return (
    <div className="flex flex-col h-full">
      {/* ------------------------------------------------------------------ */}
      {/* Header row: title + New Event CTA                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Schedule</h1>
          <p className="text-xs text-muted capitalize">
            {emphasisTypes.slice(0, 2).map((t) => t.replace(/_/g, " ")).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-2xl bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-sm active:scale-[0.97] transition-transform"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Event
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* View mode toggle: Day | Week | Month                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-4 pb-3">
        <div
          className="inline-flex rounded-2xl p-1 gap-0.5"
          style={{ background: "var(--surface-nav-bg)", border: "1px solid var(--surface-nav-border)" }}
        >
          {CALENDAR_VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`
                px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                ${viewMode === mode
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted hover:text-foreground"}
              `}
            >
              {VIEW_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Source visibility toggles                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
        {CALENDAR_EVENT_SOURCES.map((source) => {
          const active = visibleSources.has(source);
          return (
            <button
              key={source}
              type="button"
              onClick={() => toggleSource(source)}
              className={`
                flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all shrink-0
                ${active
                  ? "border-border bg-card text-foreground"
                  : "border-border/40 bg-transparent text-muted/60"}
              `}
            >
              <span className={`w-2 h-2 rounded-full ${active ? SOURCE_COLOR[source] : "bg-muted/30"}`} />
              {SOURCE_LABELS[source]}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Source health bar — provider sync status summary (OC-03)           */}
      {/* ------------------------------------------------------------------ */}
      <SourceHealthBar providerCards={providerSyncCards} />

      {/* ------------------------------------------------------------------ */}
      {/* Calendar grid area — shell / populated in OC-04+                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 px-4 pb-4">
        <CalendarGridShell viewMode={viewMode} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceHealthBar — shows connected provider count and any sync errors.
// Phase shell: when no providers are connected, shows a quiet "no sources"
// prompt. Populated with real sync cards in OC-04.
// ---------------------------------------------------------------------------

function SourceHealthBar({ providerCards }: { providerCards: CalendarProviderSyncCard[] }) {
  if (providerCards.length === 0) {
    // No providers connected — show a quiet callout.
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl border border-border/40 px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-muted/40 shrink-0" />
        <span className="text-xs text-muted/70">
          No calendar sources connected. Events from connected providers will appear here.
        </span>
      </div>
    );
  }

  const health: CalendarSourceHealthSummary = deriveCalendarSourceHealth(providerCards);

  const healthColor =
    health.overallHealth === "error"    ? "bg-red-400"    :
    health.overallHealth === "degraded" ? "bg-amber-400"  :
                                          "bg-emerald-400";

  const healthLabel =
    health.overallHealth === "error"    ? "Sync error"    :
    health.overallHealth === "degraded" ? "Sync stale"    :
                                          "All sources up";

  return (
    <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl border border-border/40 px-3 py-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${healthColor}`} />
      <span className="text-xs text-foreground font-medium">{healthLabel}</span>
      <span className="text-xs text-muted">
        {health.connectedCount} source{health.connectedCount !== 1 ? "s" : ""} connected
      </span>
      {health.errorCount > 0 && (
        <span className="ml-auto text-xs text-red-500 font-medium">
          {health.errorCount} error{health.errorCount !== 1 ? "s" : ""}
        </span>
      )}
      {/* Individual provider accent dots */}
      <div className="ml-auto flex items-center gap-1">
        {providerCards.map((card) => (
          <span
            key={card.providerId}
            title={`${card.providerName}: ${card.status}`}
            className={`w-2 h-2 rounded-full ${card.accentColor} opacity-80`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar grid shell — renders time slots for the current view mode.
// Real event rendering wired in OC-04 once server data layer is available.
// ---------------------------------------------------------------------------

function CalendarGridShell({ viewMode }: { viewMode: CalendarViewMode }) {
  const today = new Date();

  if (viewMode === "month") {
    return <MonthGridShell today={today} />;
  }

  if (viewMode === "day") {
    return <DayColumnShell today={today} />;
  }

  // Default: week
  return <WeekGridShell today={today} />;
}

// ---------------------------------------------------------------------------
// Week grid shell
// ---------------------------------------------------------------------------

function WeekGridShell({ today }: { today: Date }) {
  // Build the 7-day window starting from Monday of the current week.
  const monday = new Date(today);
  const dayOfWeek = today.getDay(); // 0 = Sun
  const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(today.getDate() + distToMonday);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Day header row */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-medium text-muted">{DAY_LABELS[i]}</span>
              <span
                className={`
                  w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold
                  ${isToday ? "bg-foreground text-background" : "text-foreground"}
                `}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Time grid placeholder */}
      <div
        className="flex-1 rounded-2xl border border-border/50 overflow-hidden"
        style={{ background: "var(--surface-card-bg, var(--background))" }}
      >
        <div className="grid grid-cols-7 h-full divide-x divide-border/30">
          {days.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div
                key={i}
                className={`relative min-h-[320px] ${isToday ? "bg-foreground/[0.03]" : ""}`}
              >
                {/* Empty slot — events rendered here in OC-04 */}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-muted/60 pb-1">
        Events appear here once connected sources are configured.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day column shell
// ---------------------------------------------------------------------------

function DayColumnShell({ today }: { today: Date }) {
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Day header */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-muted">
            {today.toLocaleDateString("en-US", { weekday: "long" })}
          </span>
          <span className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
            {today.getDate()}
          </span>
        </div>
      </div>

      {/* Hour rows */}
      <div className="flex-1 rounded-2xl border border-border/50 overflow-auto"
        style={{ background: "var(--surface-card-bg, var(--background))" }}>
        {HOURS.map((h) => (
          <div key={h} className="flex items-start gap-2 border-b border-border/20 px-3 py-2 min-h-[44px]">
            <span className="text-[10px] text-muted/70 w-10 shrink-0 pt-0.5">
              {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </span>
            <div className="flex-1" />
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted/60 pb-1">
        Events appear here once connected sources are configured.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month grid shell
// ---------------------------------------------------------------------------

function MonthGridShell({ today }: { today: Date }) {
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Pad to Monday-start grid
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const totalCells = startPad + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="text-sm font-semibold text-foreground px-1">{monthLabel}</div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted py-1">{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {Array.from({ length: rows * 7 }, (_, idx) => {
          const dayNum = idx - startPad + 1;
          const valid = dayNum >= 1 && dayNum <= lastDay.getDate();
          const isToday = valid && dayNum === today.getDate();
          return (
            <div
              key={idx}
              className={`
                rounded-xl flex flex-col items-center justify-start pt-1.5 min-h-[44px]
                ${valid ? "border border-border/30" : ""}
                ${isToday ? "border-foreground/30 bg-foreground/[0.04]" : ""}
              `}
            >
              {valid && (
                <span
                  className={`
                    text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? "bg-foreground text-background" : "text-foreground"}
                  `}
                >
                  {dayNum}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted/60 pb-1">
        Events appear here once connected sources are configured.
      </p>
    </div>
  );
}
