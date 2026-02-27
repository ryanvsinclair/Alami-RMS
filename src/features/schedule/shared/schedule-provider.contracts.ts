import type { IndustryType } from "@/lib/generated/prisma/client";
import type { CalendarEventType } from "./schedule.contracts";

/**
 * Operational Calendar — calendar provider catalog contracts.
 *
 * Defines the canonical set of external calendar/scheduling providers that
 * can be connected to the Operational Calendar, along with their capabilities,
 * industry applicability, and connection metadata shape.
 *
 * Design rules:
 *  - Provider IDs are stable keys — never rename once shipped.
 *  - This file contains no DB schema — contracts and catalog only.
 *  - All provider-specific sync logic lives in server-side adapters, not here.
 *  - Follows the same catalog pattern as income-integrations (provider-catalog.contracts.ts).
 *
 * Relationship to other features:
 *  - Income integrations  →  src/features/integrations/shared/provider-catalog.contracts.ts
 *  - Calendar sync health →  ./schedule-sync.contracts.ts
 *  - UI display           →  src/features/schedule/ui/ScheduleClient.tsx
 */

// ---------------------------------------------------------------------------
// Provider ID catalog
// ---------------------------------------------------------------------------

/**
 * All recognized calendar / scheduling provider keys.
 *
 * Grouped by category:
 *  - General calendar platforms (sync from personal/work cal)
 *  - Scheduling / booking platforms (appointment-specific)
 *  - Hospitality / table reservation platforms
 */
export const CALENDAR_PROVIDER_IDS = [
  // General calendar platforms
  "google_calendar",
  "outlook_calendar",
  "apple_ics",
  // Appointment / booking platforms
  "square_appointments",
  "calendly",
  "mindbody",
  "fresha",
  "vagaro",
  // Hospitality / table reservation
  "opentable",
  "resy",
] as const;

export type CalendarProviderId = (typeof CALENDAR_PROVIDER_IDS)[number];

// ---------------------------------------------------------------------------
// Provider category
// ---------------------------------------------------------------------------

export const CALENDAR_PROVIDER_TYPES = [
  "general_calendar", // Google Calendar, Outlook, Apple ICS
  "booking_platform", // Square Appointments, Calendly, Mindbody, Fresha, Vagaro
  "reservation_platform", // OpenTable, Resy
] as const;

export type CalendarProviderType = (typeof CALENDAR_PROVIDER_TYPES)[number];

// ---------------------------------------------------------------------------
// Provider status (mirrors income integration pattern)
// ---------------------------------------------------------------------------

export const CALENDAR_PROVIDER_STATUSES = ["planned", "pilot", "active"] as const;

export type CalendarProviderStatus = (typeof CALENDAR_PROVIDER_STATUSES)[number];

// ---------------------------------------------------------------------------
// Provider connection method
// ---------------------------------------------------------------------------

export const CALENDAR_PROVIDER_AUTH_METHODS = [
  "oauth2",    // Full OAuth flow (Google, Outlook, Square Appointments)
  "ics_feed",  // Read-only ICS/iCal feed URL (Apple Calendar)
  "api_key",   // Direct API key (some booking platforms)
] as const;

export type CalendarProviderAuthMethod = (typeof CALENDAR_PROVIDER_AUTH_METHODS)[number];

// ---------------------------------------------------------------------------
// Provider definition shape
// ---------------------------------------------------------------------------

export interface CalendarProviderDefinition {
  id: CalendarProviderId;
  name: string;
  type: CalendarProviderType;
  authMethod: CalendarProviderAuthMethod;
  /** Which event types this provider can supply */
  supportsEventTypes: CalendarEventType[];
  /** Industries where this provider is commonly used */
  supportedIndustries: IndustryType[];
  /** Whether the provider supports incremental sync (vs full re-fetch) */
  canSyncIncremental: boolean;
  /** Whether the provider can send webhooks for real-time updates */
  canWebhook: boolean;
  /** Events synced from this provider are always read-only */
  alwaysReadOnly: boolean;
  status: CalendarProviderStatus;
}

// ---------------------------------------------------------------------------
// Provider catalog
// ---------------------------------------------------------------------------

export const CALENDAR_PROVIDER_CATALOG: readonly CalendarProviderDefinition[] = [
  // -- General calendar platforms -------------------------------------------

  {
    id: "google_calendar",
    name: "Google Calendar",
    type: "general_calendar",
    authMethod: "oauth2",
    supportsEventTypes: ["appointment", "manual_block", "reservation", "delivery_window", "staff_shift"],
    supportedIndustries: ["restaurant", "retail", "salon", "contractor", "general"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: false, // user can grant write access
    status: "planned",
  },
  {
    id: "outlook_calendar",
    name: "Outlook / Microsoft 365",
    type: "general_calendar",
    authMethod: "oauth2",
    supportsEventTypes: ["appointment", "manual_block", "reservation", "delivery_window", "staff_shift"],
    supportedIndustries: ["restaurant", "retail", "salon", "contractor", "general"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: false,
    status: "planned",
  },
  {
    id: "apple_ics",
    name: "Apple Calendar (ICS)",
    type: "general_calendar",
    authMethod: "ics_feed",
    supportsEventTypes: ["appointment", "manual_block", "reservation"],
    supportedIndustries: ["restaurant", "retail", "salon", "contractor", "general"],
    canSyncIncremental: false, // ICS feeds are full re-fetch
    canWebhook: false,
    alwaysReadOnly: true,
    status: "planned",
  },

  // -- Booking / appointment platforms --------------------------------------

  {
    id: "square_appointments",
    name: "Square Appointments",
    type: "booking_platform",
    authMethod: "oauth2",
    supportsEventTypes: ["appointment", "staff_shift", "manual_block"],
    supportedIndustries: ["salon", "retail", "general"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: true,
    status: "planned",
  },
  {
    id: "calendly",
    name: "Calendly",
    type: "booking_platform",
    authMethod: "oauth2",
    supportsEventTypes: ["appointment", "manual_block"],
    supportedIndustries: ["salon", "contractor", "general"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: true,
    status: "planned",
  },
  {
    id: "mindbody",
    name: "Mindbody",
    type: "booking_platform",
    authMethod: "oauth2",
    supportsEventTypes: ["appointment", "staff_shift", "manual_block"],
    supportedIndustries: ["salon"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: true,
    status: "planned",
  },
  {
    id: "fresha",
    name: "Fresha",
    type: "booking_platform",
    authMethod: "api_key",
    supportsEventTypes: ["appointment", "staff_shift"],
    supportedIndustries: ["salon"],
    canSyncIncremental: false,
    canWebhook: false,
    alwaysReadOnly: true,
    status: "planned",
  },
  {
    id: "vagaro",
    name: "Vagaro",
    type: "booking_platform",
    authMethod: "api_key",
    supportsEventTypes: ["appointment", "staff_shift"],
    supportedIndustries: ["salon"],
    canSyncIncremental: false,
    canWebhook: false,
    alwaysReadOnly: true,
    status: "planned",
  },

  // -- Hospitality / table reservation platforms ----------------------------

  {
    id: "opentable",
    name: "OpenTable",
    type: "reservation_platform",
    authMethod: "oauth2",
    supportsEventTypes: ["reservation"],
    supportedIndustries: ["restaurant"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: true,
    status: "planned",
  },
  {
    id: "resy",
    name: "Resy",
    type: "reservation_platform",
    authMethod: "oauth2",
    supportsEventTypes: ["reservation"],
    supportedIndustries: ["restaurant"],
    canSyncIncremental: true,
    canWebhook: true,
    alwaysReadOnly: true,
    status: "planned",
  },
] as const;

// ---------------------------------------------------------------------------
// Provider recommendation map
// ---------------------------------------------------------------------------

/**
 * Which calendar providers are recommended (listed first) for each industry.
 * All providers remain connectable regardless of industry.
 */
export const CALENDAR_PROVIDER_RECOMMENDATIONS_BY_INDUSTRY: Record<
  IndustryType,
  readonly CalendarProviderId[]
> = {
  restaurant:  ["google_calendar", "outlook_calendar", "opentable", "resy", "apple_ics"],
  salon:       ["google_calendar", "square_appointments", "mindbody", "fresha", "vagaro", "outlook_calendar"],
  contractor:  ["google_calendar", "outlook_calendar", "calendly", "apple_ics"],
  retail:      ["google_calendar", "square_appointments", "outlook_calendar", "apple_ics"],
  general:     ["google_calendar", "outlook_calendar", "calendly", "apple_ics"],
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function listCalendarProvidersForIndustry(
  industryType: IndustryType
): CalendarProviderDefinition[] {
  return CALENDAR_PROVIDER_CATALOG.filter((p) =>
    p.supportedIndustries.includes(industryType)
  );
}

export function isCalendarProviderRecommendedForIndustry(
  industryType: IndustryType,
  providerId: CalendarProviderId
): boolean {
  return CALENDAR_PROVIDER_RECOMMENDATIONS_BY_INDUSTRY[industryType].includes(providerId);
}

export function getCalendarProviderById(
  id: CalendarProviderId
): CalendarProviderDefinition | undefined {
  return CALENDAR_PROVIDER_CATALOG.find((p) => p.id === id);
}
