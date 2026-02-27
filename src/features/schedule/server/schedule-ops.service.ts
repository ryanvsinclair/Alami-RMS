import type {
  CalendarEventSummary,
  CalendarProviderSyncCard,
  CalendarViewMode,
} from "@/features/schedule/shared";
import {
  CALENDAR_EVENT_RENDER_CAP_BY_VIEW,
  type CalendarActorRole,
  type CalendarAuditAction,
  type CalendarAuditEntry,
  type CalendarLoadGuardResult,
  type CalendarOpsHealthSummary,
  type CalendarPermissionDecision,
} from "@/features/schedule/shared/schedule-ops.contracts";

function toRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export interface DeriveScheduleOpsHealthInput {
  providerCards: CalendarProviderSyncCard[];
  processedEvents: number;
  duplicateSuppressions: number;
  overlapConflicts: number;
}

export function deriveScheduleOpsHealthSummary(
  input: DeriveScheduleOpsHealthInput
): CalendarOpsHealthSummary {
  const totalSources = input.providerCards.length;
  const healthySources = input.providerCards.filter(
    (card) => card.status === "connected" || card.status === "syncing"
  ).length;
  const staleSources = input.providerCards.filter(
    (card) => card.status === "stale"
  ).length;

  return {
    syncReliabilityRate: toRate(healthySources, totalSources),
    staleSourceRate: toRate(staleSources, totalSources),
    duplicateSuppressionRate: toRate(
      input.duplicateSuppressions,
      input.processedEvents
    ),
    overlapConflictRate: toRate(input.overlapConflicts, input.processedEvents),
    generatedAt: new Date(),
  };
}

function compareEventsForLoadGuard(
  left: CalendarEventSummary,
  right: CalendarEventSummary
): number {
  const byStart = left.startAt.getTime() - right.startAt.getTime();
  if (byStart !== 0) return byStart;
  return left.id.localeCompare(right.id);
}

export function applyCalendarLoadGuard(
  events: CalendarEventSummary[],
  options: {
    viewMode: CalendarViewMode;
    maxEventsOverride?: number;
  }
): CalendarLoadGuardResult<CalendarEventSummary> {
  const maxEvents =
    options.maxEventsOverride ?? CALENDAR_EVENT_RENDER_CAP_BY_VIEW[options.viewMode];
  const sortedEvents = [...events].sort(compareEventsForLoadGuard);

  if (sortedEvents.length <= maxEvents) {
    return {
      events: sortedEvents,
      maxEvents,
      trimmedCount: 0,
      hadTrim: false,
    };
  }

  return {
    events: sortedEvents.slice(0, maxEvents),
    maxEvents,
    trimmedCount: sortedEvents.length - maxEvents,
    hadTrim: true,
  };
}

export interface EvaluateCalendarPermissionInput {
  actorRole: CalendarActorRole;
  action: CalendarAuditAction;
  event?: CalendarEventSummary | null;
}

export function evaluateCalendarPermission(
  input: EvaluateCalendarPermissionInput
): CalendarPermissionDecision {
  if (input.action === "create") {
    return { allowed: true, reasonCode: null };
  }

  const event = input.event;
  if (!event) {
    return { allowed: false, reasonCode: "missing_target_event" };
  }

  if (event.source === "provider" || event.editability === "read_only") {
    return { allowed: false, reasonCode: "provider_read_only" };
  }

  if (event.source === "internal" || event.editability === "restricted") {
    if (input.action === "resolve_conflict" && input.actorRole !== "staff") {
      return { allowed: true, reasonCode: null };
    }
    return { allowed: false, reasonCode: "internal_restricted" };
  }

  if (input.action === "delete" && input.actorRole === "staff") {
    return { allowed: false, reasonCode: "role_delete_forbidden" };
  }

  return { allowed: true, reasonCode: null };
}

export function buildCalendarAuditEntry(input: {
  businessId: string;
  action: CalendarAuditAction;
  actorRole: CalendarActorRole;
  decision: CalendarPermissionDecision;
  targetEventId?: string | null;
  metadata?: Record<string, unknown>;
}): CalendarAuditEntry {
  const targetEventId = input.targetEventId ?? null;
  return {
    id: `${input.businessId}:${input.action}:${targetEventId ?? "none"}:${Date.now()}`,
    businessId: input.businessId,
    action: input.action,
    actorRole: input.actorRole,
    targetEventId,
    outcome: input.decision.allowed ? "allowed" : "denied",
    reasonCode: input.decision.reasonCode,
    createdAt: new Date(),
    metadata: input.metadata,
  };
}

