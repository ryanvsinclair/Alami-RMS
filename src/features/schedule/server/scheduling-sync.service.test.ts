import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSchedulingProviderEvent } from "./scheduling-connectors";
import { resolveSchedulingEventConflicts } from "./schedule-conflict.service";
import { runSchedulingProviderSyncPreview } from "./scheduling-sync.service";

const BASE_CONTEXT = {
  businessId: "biz_123",
  timezone: "America/Toronto",
};

test("normalizeSchedulingProviderEvent maps Square appointment payload", () => {
  const event = normalizeSchedulingProviderEvent(
    "square_appointments",
    {
      appointment_id: "sq_appt_01",
      service_name: "Hair Color",
      start_at: "2026-03-01T15:00:00.000Z",
      end_at: "2026-03-01T16:00:00.000Z",
      status: "confirmed",
      team_member_id: "staff_1",
      location_id: "room_5",
      customer_id: "cust_1",
    },
    BASE_CONTEXT
  );

  assert.ok(event);
  assert.equal(event.id, "square_appointments:sq_appt_01");
  assert.equal(event.eventType, "appointment");
  assert.equal(event.status, "scheduled");
  assert.equal(event.staffId, "staff_1");
  assert.equal(event.resourceId, "room_5");
  assert.equal(event.linkedEntityId, "cust_1");
  assert.equal(event.normalizationWarnings.length, 0);
});

test("normalizeSchedulingProviderEvent applies default reservation duration", () => {
  const event = normalizeSchedulingProviderEvent(
    "opentable",
    {
      reservation_id: "ot_res_10",
      guest_name: "Walker Party",
      reservation_time: "2026-03-02T19:00:00.000Z",
      status: "booked",
    },
    BASE_CONTEXT
  );

  assert.ok(event);
  assert.equal(event.eventType, "reservation");
  assert.equal(event.normalizationWarnings.includes("missing_end_at_default_applied"), true);
  assert.equal(
    event.endAt.getTime() - event.startAt.getTime(),
    90 * 60 * 1000
  );
});

test("resolveSchedulingEventConflicts suppresses provider external-id duplicates first", () => {
  const first = normalizeSchedulingProviderEvent(
    "calendly",
    {
      id: "cal_event_1",
      title: "Consultation",
      start_time: "2026-03-03T10:00:00.000Z",
      end_time: "2026-03-03T10:30:00.000Z",
      host_id: "staff_alpha",
    },
    BASE_CONTEXT
  );
  const duplicate = normalizeSchedulingProviderEvent(
    "calendly",
    {
      id: "cal_event_1",
      title: "Consultation duplicate",
      start_time: "2026-03-03T10:01:00.000Z",
      end_time: "2026-03-03T10:30:00.000Z",
      host_id: "staff_alpha",
    },
    BASE_CONTEXT
  );

  assert.ok(first);
  assert.ok(duplicate);

  const result = resolveSchedulingEventConflicts([first, duplicate]);
  assert.equal(result.events.length, 1);
  assert.equal(result.duplicateSuppressions.length, 1);
  assert.equal(result.duplicateSuppressions[0].reason, "provider_external_id");
  assert.equal(result.duplicateSuppressions[0].keptEventId, first.id);
});

test("resolveSchedulingEventConflicts detects overlapping events sharing staff", () => {
  const left = normalizeSchedulingProviderEvent(
    "mindbody",
    {
      id: "mb_1",
      class_name: "Massage Session",
      start_time: "2026-03-04T13:00:00.000Z",
      end_time: "2026-03-04T14:00:00.000Z",
      staff_id: "staff_beta",
    },
    BASE_CONTEXT
  );
  const right = normalizeSchedulingProviderEvent(
    "fresha",
    {
      id: "fr_1",
      service_name: "Nails",
      start_time: "2026-03-04T13:30:00.000Z",
      end_time: "2026-03-04T14:30:00.000Z",
      staff_id: "staff_beta",
    },
    BASE_CONTEXT
  );

  assert.ok(left);
  assert.ok(right);

  const result = resolveSchedulingEventConflicts([left, right]);
  assert.equal(result.events.length, 2);
  assert.equal(result.overlapConflicts.length, 1);
  assert.equal(result.overlapConflicts[0].reason, "staff_overlap");
});

test("runSchedulingProviderSyncPreview returns fetched/normalized/dropped counts", async () => {
  const result = await runSchedulingProviderSyncPreview({
    providerId: "resy",
    businessId: "biz_123",
    accessToken: "token_unused_for_override",
    since: new Date("2026-03-01T00:00:00.000Z"),
    until: new Date("2026-03-07T00:00:00.000Z"),
    timezone: "America/Toronto",
    rawEventsOverride: [
      {
        reservation_id: "resy_01",
        reservation_time: "2026-03-05T18:00:00.000Z",
        end_time: "2026-03-05T19:30:00.000Z",
        guest_name: "Taylor Party",
      },
      {
        reservation_id: "resy_invalid",
        guest_name: "Invalid Party",
      },
    ],
  });

  assert.equal(result.providerId, "resy");
  assert.equal(result.fetchedCount, 2);
  assert.equal(result.normalizedCount, 1);
  assert.equal(result.droppedCount, 1);
  assert.equal(result.events.length, 1);
});
