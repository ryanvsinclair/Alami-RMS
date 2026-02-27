export const CALENDAR_SUGGESTION_TYPES = [
  "delivery_to_intake",
  "booking_inventory_hint",
  "job_material_gap",
] as const;

export type CalendarSuggestionType = (typeof CALENDAR_SUGGESTION_TYPES)[number];

export const CALENDAR_SUGGESTION_SEVERITIES = ["info", "warn", "critical"] as const;

export type CalendarSuggestionSeverity =
  (typeof CALENDAR_SUGGESTION_SEVERITIES)[number];

export const CALENDAR_SUGGESTED_ACTIONS = [
  "review_intake_plan",
  "review_inventory_coverage",
  "review_material_gaps",
] as const;

export type CalendarSuggestedAction = (typeof CALENDAR_SUGGESTED_ACTIONS)[number];

export interface CalendarOperationalSuggestion {
  id: string;
  type: CalendarSuggestionType;
  eventId: string;
  title: string;
  description: string;
  severity: CalendarSuggestionSeverity;
  suggestedAction: CalendarSuggestedAction;
  sourceEventStartAt: Date;
  sourceEventEndAt: Date;
  metadata?: Record<string, unknown>;
}

export interface BookingInventoryHintSignal {
  eventId: string;
  itemName: string;
  projectedUsageQty: number;
  onHandQty: number;
}

export interface JobMaterialGapSignal {
  eventId: string;
  missingItems: string[];
}

