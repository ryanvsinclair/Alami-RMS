import test from "node:test";
import assert from "node:assert/strict";

import type { CalendarEventSummary } from "@/features/schedule/shared";
import {
  applyCalendarLoadGuard,
  buildCalendarAuditEntry,
  deriveScheduleOpsHealthSummary,
  evaluateCalendarPermission,
} from "./schedule-ops.service";

function makeEvent(overrides: Partial<CalendarEventSummary>): CalendarEventSummary {
  return {
    id: "event_default",
    businessId: "biz_123",
    title: "Event",
    eventType: "manual_block",
    source: "manual",
    editability: "editable",
    status: "scheduled",
    startAt: new Date("2026-03-10T10:00:00.000Z"),
    endAt: new Date("2026-03-10T11:00:00.000Z"),
    timezone: "America/Toronto",
    ...overrides,
  };
}

test("deriveScheduleOpsHealthSummary computes reliability and suppression rates", () => {
  const summary = deriveScheduleOpsHealthSummary({
    providerCards: [
      {
        providerId: "google_calendar",
        providerName: "Google Calendar",
        status: "connected",
        lastSyncAt: new Date().toISOString(),
        syncStale: false,
        eventCount: 10,
        lastErrorMessage: null,
        accentColor: "bg-blue-500",
      },
      {
        providerId: "resy",
        providerName: "Resy",
        status: "stale",
        lastSyncAt: new Date().toISOString(),
        syncStale: true,
        eventCount: 4,
        lastErrorMessage: null,
        accentColor: "bg-orange-500",
      },
    ],
    processedEvents: 20,
    duplicateSuppressions: 5,
    overlapConflicts: 2,
  });

  assert.equal(summary.syncReliabilityRate, 0.5);
  assert.equal(summary.staleSourceRate, 0.5);
  assert.equal(summary.duplicateSuppressionRate, 0.25);
  assert.equal(summary.overlapConflictRate, 0.1);
});

test("applyCalendarLoadGuard trims events deterministically by start time then id", () => {
  const events = [
    makeEvent({ id: "b", startAt: new Date("2026-03-10T12:00:00.000Z") }),
    makeEvent({ id: "a", startAt: new Date("2026-03-10T10:00:00.000Z") }),
    makeEvent({ id: "c", startAt: new Date("2026-03-10T11:00:00.000Z") }),
  ];

  const result = applyCalendarLoadGuard(events, {
    viewMode: "day",
    maxEventsOverride: 2,
  });

  assert.equal(result.hadTrim, true);
  assert.equal(result.trimmedCount, 1);
  assert.deepEqual(
    result.events.map((event) => event.id),
    ["a", "c"]
  );
});

test("evaluateCalendarPermission blocks provider updates", () => {
  const decision = evaluateCalendarPermission({
    actorRole: "owner",
    action: "update",
    event: makeEvent({
      source: "provider",
      editability: "read_only",
    }),
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "provider_read_only");
});

test("evaluateCalendarPermission blocks staff manual deletes but allows manager", () => {
  const event = makeEvent({
    source: "manual",
    editability: "editable",
  });

  const staffDecision = evaluateCalendarPermission({
    actorRole: "staff",
    action: "delete",
    event,
  });
  const managerDecision = evaluateCalendarPermission({
    actorRole: "manager",
    action: "delete",
    event,
  });

  assert.equal(staffDecision.allowed, false);
  assert.equal(staffDecision.reasonCode, "role_delete_forbidden");
  assert.equal(managerDecision.allowed, true);
});

test("buildCalendarAuditEntry records action outcome", () => {
  const deniedDecision = { allowed: false, reasonCode: "internal_restricted" } as const;

  const entry = buildCalendarAuditEntry({
    businessId: "biz_123",
    action: "resolve_conflict",
    actorRole: "staff",
    decision: deniedDecision,
    targetEventId: "evt_77",
    metadata: { attempted: true },
  });

  assert.equal(entry.businessId, "biz_123");
  assert.equal(entry.action, "resolve_conflict");
  assert.equal(entry.outcome, "denied");
  assert.equal(entry.reasonCode, "internal_restricted");
  assert.equal(entry.targetEventId, "evt_77");
});

