import type {
  CalendarDuplicateSuppression,
  CalendarOverlapConflict,
  SchedulingConflictResolutionResult,
  NormalizedSchedulingEvent,
} from "@/features/schedule/shared/schedule-normalization.contracts";

function compareEventsForStability(
  a: NormalizedSchedulingEvent,
  b: NormalizedSchedulingEvent
): number {
  const byStart = a.startAt.getTime() - b.startAt.getTime();
  if (byStart !== 0) return byStart;
  return a.id.localeCompare(b.id);
}

function buildProviderExternalIdKey(event: NormalizedSchedulingEvent): string | null {
  if (!event.providerKey || !event.externalId) return null;
  return `${event.providerKey}:${event.externalId}`;
}

function buildLinkedEntityKey(event: NormalizedSchedulingEvent): string | null {
  if (!event.linkedEntityId) return null;
  return [
    event.eventType,
    event.linkedEntityId,
    event.startAt.toISOString(),
    event.endAt.toISOString(),
  ].join("|");
}

function eventsOverlap(a: NormalizedSchedulingEvent, b: NormalizedSchedulingEvent): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < a.endAt.getTime();
}

function detectOverlapReason(
  a: NormalizedSchedulingEvent,
  b: NormalizedSchedulingEvent
): CalendarOverlapConflict["reason"] {
  if (a.staffId && b.staffId && a.staffId === b.staffId) {
    return "staff_overlap";
  }
  if (a.resourceId && b.resourceId && a.resourceId === b.resourceId) {
    return "resource_overlap";
  }
  return "time_overlap";
}

function findDuplicateForEvent(
  event: NormalizedSchedulingEvent,
  providerExternalMap: Map<string, NormalizedSchedulingEvent>,
  linkedEntityMap: Map<string, NormalizedSchedulingEvent>,
  fingerprintMap: Map<string, NormalizedSchedulingEvent>
): { kept: NormalizedSchedulingEvent; reason: CalendarDuplicateSuppression["reason"] } | null {
  const providerExternalIdKey = buildProviderExternalIdKey(event);
  if (providerExternalIdKey) {
    const providerDuplicate = providerExternalMap.get(providerExternalIdKey);
    if (providerDuplicate) {
      return { kept: providerDuplicate, reason: "provider_external_id" };
    }
  }

  const linkedEntityKey = buildLinkedEntityKey(event);
  if (linkedEntityKey) {
    const linkedEntityDuplicate = linkedEntityMap.get(linkedEntityKey);
    if (linkedEntityDuplicate) {
      return { kept: linkedEntityDuplicate, reason: "linked_entity" };
    }
  }

  const fingerprintDuplicate = fingerprintMap.get(event.providerEventFingerprint);
  if (fingerprintDuplicate) {
    return { kept: fingerprintDuplicate, reason: "fingerprint" };
  }

  return null;
}

function indexEvent(
  event: NormalizedSchedulingEvent,
  providerExternalMap: Map<string, NormalizedSchedulingEvent>,
  linkedEntityMap: Map<string, NormalizedSchedulingEvent>,
  fingerprintMap: Map<string, NormalizedSchedulingEvent>
): void {
  const providerExternalIdKey = buildProviderExternalIdKey(event);
  if (providerExternalIdKey) {
    providerExternalMap.set(providerExternalIdKey, event);
  }

  const linkedEntityKey = buildLinkedEntityKey(event);
  if (linkedEntityKey) {
    linkedEntityMap.set(linkedEntityKey, event);
  }

  fingerprintMap.set(event.providerEventFingerprint, event);
}

export function resolveSchedulingEventConflicts(
  sourceEvents: NormalizedSchedulingEvent[]
): SchedulingConflictResolutionResult {
  const sortedEvents = [...sourceEvents].sort(compareEventsForStability);
  const providerExternalMap = new Map<string, NormalizedSchedulingEvent>();
  const linkedEntityMap = new Map<string, NormalizedSchedulingEvent>();
  const fingerprintMap = new Map<string, NormalizedSchedulingEvent>();

  const events: NormalizedSchedulingEvent[] = [];
  const duplicateSuppressions: CalendarDuplicateSuppression[] = [];

  for (const event of sortedEvents) {
    const duplicate = findDuplicateForEvent(
      event,
      providerExternalMap,
      linkedEntityMap,
      fingerprintMap
    );
    if (duplicate) {
      duplicateSuppressions.push({
        reason: duplicate.reason,
        keptEventId: duplicate.kept.id,
        suppressedEventId: event.id,
      });
      continue;
    }

    events.push(event);
    indexEvent(event, providerExternalMap, linkedEntityMap, fingerprintMap);
  }

  const overlapConflicts: CalendarOverlapConflict[] = [];
  for (let leftIndex = 0; leftIndex < events.length; leftIndex++) {
    const left = events[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex++) {
      const right = events[rightIndex];
      if (!eventsOverlap(left, right)) {
        if (right.startAt.getTime() >= left.endAt.getTime()) {
          break;
        }
        continue;
      }

      overlapConflicts.push({
        reason: detectOverlapReason(left, right),
        primaryEventId: left.id,
        secondaryEventId: right.id,
      });
    }
  }

  return {
    events,
    duplicateSuppressions,
    overlapConflicts,
  };
}

