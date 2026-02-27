import type { CalendarProviderId } from "./schedule-provider.contracts";
import type { CalendarEventSummary } from "./schedule.contracts";

export const SCHEDULING_PLATFORM_PROVIDER_IDS = [
  "square_appointments",
  "calendly",
  "mindbody",
  "fresha",
  "vagaro",
  "opentable",
  "resy",
] as const;

export type SchedulingPlatformProviderId =
  (typeof SCHEDULING_PLATFORM_PROVIDER_IDS)[number];

export function isSchedulingPlatformProviderId(
  providerId: CalendarProviderId
): providerId is SchedulingPlatformProviderId {
  return (SCHEDULING_PLATFORM_PROVIDER_IDS as readonly string[]).includes(providerId);
}

export interface NormalizedSchedulingEvent extends CalendarEventSummary {
  providerId: SchedulingPlatformProviderId;
  providerEventId: string;
  providerEventFingerprint: string;
  normalizationWarnings: string[];
}

export const CALENDAR_DUPLICATE_REASONS = [
  "provider_external_id",
  "linked_entity",
  "fingerprint",
] as const;

export type CalendarDuplicateReason = (typeof CALENDAR_DUPLICATE_REASONS)[number];

export interface CalendarDuplicateSuppression {
  reason: CalendarDuplicateReason;
  keptEventId: string;
  suppressedEventId: string;
}

export const CALENDAR_OVERLAP_REASONS = [
  "staff_overlap",
  "resource_overlap",
  "time_overlap",
] as const;

export type CalendarOverlapReason = (typeof CALENDAR_OVERLAP_REASONS)[number];

export interface CalendarOverlapConflict {
  reason: CalendarOverlapReason;
  primaryEventId: string;
  secondaryEventId: string;
}

export interface SchedulingConflictResolutionResult {
  events: NormalizedSchedulingEvent[];
  duplicateSuppressions: CalendarDuplicateSuppression[];
  overlapConflicts: CalendarOverlapConflict[];
}

