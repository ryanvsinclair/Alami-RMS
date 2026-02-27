import type { CalendarProviderId } from "./schedule-provider.contracts";

/**
 * Operational Calendar — provider sync health contracts.
 *
 * Defines the shape of sync connection status, health indicators, and
 * source metadata used to display the SourceHealthBar in ScheduleClient.
 *
 * Design rules:
 *  - No DB-specific types here — normalized presentation contracts only.
 *  - Stale threshold mirrors the income-integrations pattern (24h).
 *  - Connected sources with no events are "empty", not "error".
 *  - Sync health is per-provider; aggregated health is derived in the UI.
 */

// ---------------------------------------------------------------------------
// Sync connection status
// ---------------------------------------------------------------------------

export const CALENDAR_SYNC_STATUSES = [
  "not_connected",  // Provider has never been linked
  "connected",      // Linked and last sync completed without error
  "syncing",        // Actively syncing right now
  "stale",          // Connected but last sync > stale threshold
  "error",          // Last sync resulted in an error
  "disconnected",   // Was connected but auth was revoked/expired
] as const;

export type CalendarSyncStatus = (typeof CALENDAR_SYNC_STATUSES)[number];

/** Stale sync threshold: connected provider with no sync in 24 hours. */
export const CALENDAR_SYNC_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Per-provider sync health shape
// ---------------------------------------------------------------------------

/**
 * Normalized sync health card for a single calendar provider.
 * Populated by the server data layer; consumed by SourceHealthBar.
 */
export interface CalendarProviderSyncCard {
  providerId: CalendarProviderId;
  /** Display name for the provider (from catalog) */
  providerName: string;
  /** Current connection/sync status */
  status: CalendarSyncStatus;
  /** ISO string of the last successful sync, null if never synced */
  lastSyncAt: string | null;
  /** True if status is connected but sync is stale (>CALENDAR_SYNC_STALE_THRESHOLD_MS) */
  syncStale: boolean;
  /** Number of events currently loaded from this provider (null = unknown) */
  eventCount: number | null;
  /** Last error message, populated when status is "error" or "disconnected" */
  lastErrorMessage: string | null;
  /** Accent color assigned to this provider's events (hex or Tailwind class) */
  accentColor: string;
}

// ---------------------------------------------------------------------------
// Aggregated source health (summary across all providers)
// ---------------------------------------------------------------------------

/**
 * Aggregated health summary for all connected calendar sources.
 * Shown in the SourceHealthBar badge.
 */
export interface CalendarSourceHealthSummary {
  /** Total providers with status "connected" or "syncing" */
  connectedCount: number;
  /** Total providers with status "error" or "disconnected" */
  errorCount: number;
  /** Total providers with status "stale" */
  staleCount: number;
  /** Overall health: "healthy" | "degraded" | "error" */
  overallHealth: "healthy" | "degraded" | "error";
}

// ---------------------------------------------------------------------------
// Sync health derivation utility
// ---------------------------------------------------------------------------

/**
 * Derives an aggregated health summary from a list of provider sync cards.
 * Can be called client-side without a DB hit.
 */
export function deriveCalendarSourceHealth(
  cards: CalendarProviderSyncCard[]
): CalendarSourceHealthSummary {
  const active = cards.filter(
    (c) => c.status === "connected" || c.status === "syncing"
  );
  const errors = cards.filter(
    (c) => c.status === "error" || c.status === "disconnected"
  );
  const stale = cards.filter((c) => c.status === "stale");

  let overallHealth: CalendarSourceHealthSummary["overallHealth"] = "healthy";
  if (errors.length > 0) overallHealth = "error";
  else if (stale.length > 0) overallHealth = "degraded";

  return {
    connectedCount: active.length,
    errorCount: errors.length,
    staleCount: stale.length,
    overallHealth,
  };
}

// ---------------------------------------------------------------------------
// Provider accent color assignment
// (static assignment — customizable by user in future phases)
// ---------------------------------------------------------------------------

/**
 * Default accent colors for each calendar provider.
 * Used for event color coding in the calendar grid and source health bar.
 * Values are Tailwind bg-* classes for consistency with the design system.
 */
export const CALENDAR_PROVIDER_ACCENT_COLORS: Partial<Record<CalendarProviderId, string>> = {
  google_calendar:    "bg-blue-500",
  outlook_calendar:   "bg-sky-500",
  apple_ics:          "bg-gray-400",
  square_appointments: "bg-emerald-500",
  calendly:           "bg-teal-500",
  mindbody:           "bg-indigo-500",
  fresha:             "bg-pink-500",
  vagaro:             "bg-rose-500",
  opentable:          "bg-red-500",
  resy:               "bg-orange-500",
};

/** Fallback accent color for unknown providers */
export const CALENDAR_PROVIDER_ACCENT_FALLBACK = "bg-violet-400";

export function getProviderAccentColor(providerId: CalendarProviderId): string {
  return CALENDAR_PROVIDER_ACCENT_COLORS[providerId] ?? CALENDAR_PROVIDER_ACCENT_FALLBACK;
}
