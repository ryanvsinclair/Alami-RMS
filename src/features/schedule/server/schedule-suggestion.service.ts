import type { CalendarEventSummary } from "@/features/schedule/shared";
import type {
  BookingInventoryHintSignal,
  CalendarOperationalSuggestion,
  JobMaterialGapSignal,
} from "@/features/schedule/shared/schedule-suggestions.contracts";

export interface DeriveScheduleSuggestionsInput {
  now?: Date;
  events: CalendarEventSummary[];
  bookingInventoryHints?: BookingInventoryHintSignal[];
  jobMaterialGapSignals?: JobMaterialGapSignal[];
}

const DELIVERY_INTAKE_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;

function isFutureScheduledEvent(event: CalendarEventSummary): boolean {
  return event.status !== "cancelled" && event.status !== "completed";
}

function eventsOverlap(left: CalendarEventSummary, right: CalendarEventSummary): boolean {
  return left.startAt.getTime() < right.endAt.getTime() &&
    right.startAt.getTime() < left.endAt.getTime();
}

function hasIntakeCoverage(
  deliveryEvent: CalendarEventSummary,
  events: CalendarEventSummary[]
): boolean {
  return events.some((event) =>
    event.eventType === "intake_session" && eventsOverlap(deliveryEvent, event)
  );
}

function summarizeBookingHints(hints: BookingInventoryHintSignal[]): {
  impactedItems: string[];
  deficitItems: BookingInventoryHintSignal[];
} {
  const deficitItems = hints.filter((hint) => hint.projectedUsageQty > hint.onHandQty);
  const impactedItems = deficitItems.map((hint) => hint.itemName);
  return { impactedItems, deficitItems };
}

function upsertSuggestion(
  suggestionsByKey: Map<string, CalendarOperationalSuggestion>,
  suggestion: CalendarOperationalSuggestion
): void {
  if (!suggestionsByKey.has(suggestion.id)) {
    suggestionsByKey.set(suggestion.id, suggestion);
    return;
  }

  const existing = suggestionsByKey.get(suggestion.id);
  if (!existing) return;

  const severityRank: Record<CalendarOperationalSuggestion["severity"], number> = {
    info: 1,
    warn: 2,
    critical: 3,
  };
  if (severityRank[suggestion.severity] > severityRank[existing.severity]) {
    suggestionsByKey.set(suggestion.id, suggestion);
  }
}

function deriveDeliveryToIntakeSuggestions(
  input: DeriveScheduleSuggestionsInput,
  suggestionsByKey: Map<string, CalendarOperationalSuggestion>
): void {
  const now = input.now ?? new Date();
  const lookAheadCutoff = new Date(now.getTime() + DELIVERY_INTAKE_LOOKAHEAD_MS);

  for (const event of input.events) {
    if (event.eventType !== "delivery_window") continue;
    if (!isFutureScheduledEvent(event)) continue;
    if (event.startAt.getTime() < now.getTime()) continue;
    if (event.startAt.getTime() > lookAheadCutoff.getTime()) continue;
    if (hasIntakeCoverage(event, input.events)) continue;

    upsertSuggestion(suggestionsByKey, {
      id: `delivery_to_intake:${event.id}`,
      type: "delivery_to_intake",
      eventId: event.id,
      title: "Delivery window has no intake coverage",
      description:
        "Create or align an intake session for this delivery window so receiving can happen on time.",
      severity: "warn",
      suggestedAction: "review_intake_plan",
      sourceEventStartAt: event.startAt,
      sourceEventEndAt: event.endAt,
      metadata: {
        providerKey: event.providerKey ?? null,
        resourceId: event.resourceId ?? null,
      },
    });
  }
}

function deriveBookingInventorySuggestions(
  input: DeriveScheduleSuggestionsInput,
  suggestionsByKey: Map<string, CalendarOperationalSuggestion>
): void {
  const hintsByEventId = new Map<string, BookingInventoryHintSignal[]>();
  for (const hint of input.bookingInventoryHints ?? []) {
    const bucket = hintsByEventId.get(hint.eventId);
    if (bucket) {
      bucket.push(hint);
    } else {
      hintsByEventId.set(hint.eventId, [hint]);
    }
  }

  for (const event of input.events) {
    if (event.eventType !== "appointment" && event.eventType !== "reservation") continue;
    if (!isFutureScheduledEvent(event)) continue;

    const eventHints = hintsByEventId.get(event.id) ?? [];
    if (eventHints.length === 0) continue;

    const summary = summarizeBookingHints(eventHints);
    if (summary.deficitItems.length === 0) continue;

    const impactedItemsList = summary.impactedItems.slice(0, 3).join(", ");
    upsertSuggestion(suggestionsByKey, {
      id: `booking_inventory_hint:${event.id}`,
      type: "booking_inventory_hint",
      eventId: event.id,
      title: "Upcoming booking may exceed inventory",
      description:
        summary.impactedItems.length > 3
          ? `${impactedItemsList}, and ${summary.impactedItems.length - 3} more item(s) are below projected demand.`
          : `${impactedItemsList} are below projected demand for this booking.`,
      severity: "warn",
      suggestedAction: "review_inventory_coverage",
      sourceEventStartAt: event.startAt,
      sourceEventEndAt: event.endAt,
      metadata: {
        impactedItems: summary.impactedItems,
      },
    });
  }
}

function deriveJobMaterialGapSuggestions(
  input: DeriveScheduleSuggestionsInput,
  suggestionsByKey: Map<string, CalendarOperationalSuggestion>
): void {
  const gapsByEventId = new Map<string, JobMaterialGapSignal>();
  for (const signal of input.jobMaterialGapSignals ?? []) {
    gapsByEventId.set(signal.eventId, signal);
  }

  for (const event of input.events) {
    if (event.eventType !== "job_assignment") continue;
    if (!isFutureScheduledEvent(event)) continue;

    const gapSignal = gapsByEventId.get(event.id);
    if (!gapSignal || gapSignal.missingItems.length === 0) continue;

    const items = gapSignal.missingItems.slice(0, 3);
    const suffix =
      gapSignal.missingItems.length > 3
        ? ` and ${gapSignal.missingItems.length - 3} more`
        : "";

    upsertSuggestion(suggestionsByKey, {
      id: `job_material_gap:${event.id}`,
      type: "job_material_gap",
      eventId: event.id,
      title: "Job assignment has material gaps",
      description: `Missing material coverage detected: ${items.join(", ")}${suffix}.`,
      severity: "critical",
      suggestedAction: "review_material_gaps",
      sourceEventStartAt: event.startAt,
      sourceEventEndAt: event.endAt,
      metadata: {
        missingItems: gapSignal.missingItems,
      },
    });
  }
}

export function deriveScheduleOperationalSuggestions(
  input: DeriveScheduleSuggestionsInput
): CalendarOperationalSuggestion[] {
  const suggestionsByKey = new Map<string, CalendarOperationalSuggestion>();

  deriveDeliveryToIntakeSuggestions(input, suggestionsByKey);
  deriveBookingInventorySuggestions(input, suggestionsByKey);
  deriveJobMaterialGapSuggestions(input, suggestionsByKey);

  return [...suggestionsByKey.values()].sort(
    (left, right) => left.sourceEventStartAt.getTime() - right.sourceEventStartAt.getTime()
  );
}

