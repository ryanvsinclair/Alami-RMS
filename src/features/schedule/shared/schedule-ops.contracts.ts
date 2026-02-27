import type { CalendarViewMode } from "./schedule.contracts";

export interface CalendarOpsHealthSummary {
  syncReliabilityRate: number;
  staleSourceRate: number;
  duplicateSuppressionRate: number;
  overlapConflictRate: number;
  generatedAt: Date;
}

export const CALENDAR_EVENT_RENDER_CAP_BY_VIEW: Record<CalendarViewMode, number> = {
  day: 240,
  week: 900,
  month: 1600,
};

export interface CalendarLoadGuardResult<TEvent> {
  events: TEvent[];
  maxEvents: number;
  trimmedCount: number;
  hadTrim: boolean;
}

export const CALENDAR_AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "resolve_conflict",
] as const;

export type CalendarAuditAction = (typeof CALENDAR_AUDIT_ACTIONS)[number];

export const CALENDAR_AUDIT_OUTCOMES = ["allowed", "denied"] as const;

export type CalendarAuditOutcome = (typeof CALENDAR_AUDIT_OUTCOMES)[number];

export const CALENDAR_ACTOR_ROLES = ["owner", "manager", "staff"] as const;

export type CalendarActorRole = (typeof CALENDAR_ACTOR_ROLES)[number];

export interface CalendarPermissionDecision {
  allowed: boolean;
  reasonCode: string | null;
}

export interface CalendarAuditEntry {
  id: string;
  businessId: string;
  action: CalendarAuditAction;
  actorRole: CalendarActorRole;
  targetEventId: string | null;
  outcome: CalendarAuditOutcome;
  reasonCode: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

