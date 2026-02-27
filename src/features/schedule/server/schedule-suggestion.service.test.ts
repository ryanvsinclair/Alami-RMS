import test from "node:test";
import assert from "node:assert/strict";

import type { CalendarEventSummary } from "@/features/schedule/shared";
import { deriveScheduleOperationalSuggestions } from "./schedule-suggestion.service";

function buildEvent(overrides: Partial<CalendarEventSummary>): CalendarEventSummary {
  return {
    id: "event_default",
    businessId: "biz_123",
    title: "Default event",
    eventType: "manual_block",
    source: "manual",
    editability: "editable",
    status: "scheduled",
    startAt: new Date("2026-03-10T12:00:00.000Z"),
    endAt: new Date("2026-03-10T13:00:00.000Z"),
    timezone: "America/Toronto",
    ...overrides,
  };
}

test("deriveScheduleOperationalSuggestions emits delivery->intake suggestion when uncovered", () => {
  const suggestions = deriveScheduleOperationalSuggestions({
    now: new Date("2026-03-10T00:00:00.000Z"),
    events: [
      buildEvent({
        id: "delivery_1",
        eventType: "delivery_window",
        source: "provider",
        editability: "read_only",
        startAt: new Date("2026-03-10T16:00:00.000Z"),
        endAt: new Date("2026-03-10T17:00:00.000Z"),
      }),
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].type, "delivery_to_intake");
});

test("deriveScheduleOperationalSuggestions suppresses delivery suggestion when intake overlaps", () => {
  const suggestions = deriveScheduleOperationalSuggestions({
    now: new Date("2026-03-10T00:00:00.000Z"),
    events: [
      buildEvent({
        id: "delivery_2",
        eventType: "delivery_window",
        source: "provider",
        editability: "read_only",
        startAt: new Date("2026-03-10T16:00:00.000Z"),
        endAt: new Date("2026-03-10T17:00:00.000Z"),
      }),
      buildEvent({
        id: "intake_covering",
        eventType: "intake_session",
        source: "internal",
        editability: "restricted",
        startAt: new Date("2026-03-10T16:15:00.000Z"),
        endAt: new Date("2026-03-10T16:45:00.000Z"),
      }),
    ],
  });

  assert.equal(suggestions.length, 0);
});

test("deriveScheduleOperationalSuggestions emits booking inventory hint when demand exceeds on-hand", () => {
  const suggestions = deriveScheduleOperationalSuggestions({
    now: new Date("2026-03-10T00:00:00.000Z"),
    events: [
      buildEvent({
        id: "booking_1",
        eventType: "reservation",
        source: "provider",
        editability: "read_only",
        startAt: new Date("2026-03-11T18:00:00.000Z"),
        endAt: new Date("2026-03-11T19:30:00.000Z"),
      }),
    ],
    bookingInventoryHints: [
      {
        eventId: "booking_1",
        itemName: "Atlantic Salmon",
        projectedUsageQty: 12,
        onHandQty: 6,
      },
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].type, "booking_inventory_hint");
  assert.equal(suggestions[0].severity, "warn");
});

test("deriveScheduleOperationalSuggestions emits job material gap warning", () => {
  const suggestions = deriveScheduleOperationalSuggestions({
    now: new Date("2026-03-10T00:00:00.000Z"),
    events: [
      buildEvent({
        id: "job_1",
        eventType: "job_assignment",
        source: "internal",
        editability: "restricted",
        startAt: new Date("2026-03-12T12:00:00.000Z"),
        endAt: new Date("2026-03-12T15:00:00.000Z"),
      }),
    ],
    jobMaterialGapSignals: [
      {
        eventId: "job_1",
        missingItems: ["Copper pipe", "Pipe sealant"],
      },
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].type, "job_material_gap");
  assert.equal(suggestions[0].severity, "critical");
});

test("deriveScheduleOperationalSuggestions deduplicates suggestions by type/event key", () => {
  const suggestions = deriveScheduleOperationalSuggestions({
    now: new Date("2026-03-10T00:00:00.000Z"),
    events: [
      buildEvent({
        id: "booking_dup",
        eventType: "appointment",
        source: "provider",
        editability: "read_only",
        startAt: new Date("2026-03-13T09:00:00.000Z"),
        endAt: new Date("2026-03-13T10:00:00.000Z"),
      }),
    ],
    bookingInventoryHints: [
      {
        eventId: "booking_dup",
        itemName: "Coffee Beans",
        projectedUsageQty: 25,
        onHandQty: 12,
      },
      {
        eventId: "booking_dup",
        itemName: "Milk",
        projectedUsageQty: 8,
        onHandQty: 4,
      },
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].type, "booking_inventory_hint");
});

