/**
 * Operational Calendar — shared exports.
 * Public API surface for the schedule feature's shared vocabulary.
 */
export type {
  CalendarEventType,
  CalendarEventSource,
  CalendarEventEditability,
  CalendarEventStatus,
  CalendarViewMode,
  CalendarEventSummary,
} from "./schedule.contracts";

export {
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_SOURCES,
  CALENDAR_EVENT_EDITABILITY,
  CALENDAR_EVENT_STATUSES,
  CALENDAR_VIEW_MODES,
  DEFAULT_CALENDAR_VIEW,
  DEFAULT_EDITABILITY_BY_SOURCE,
  CALENDAR_EVENT_EMPHASIS_BY_INDUSTRY,
} from "./schedule.contracts";

// Provider catalog (OC-03)
export type {
  CalendarProviderId,
  CalendarProviderType,
  CalendarProviderStatus,
  CalendarProviderAuthMethod,
  CalendarProviderDefinition,
} from "./schedule-provider.contracts";

export {
  CALENDAR_PROVIDER_IDS,
  CALENDAR_PROVIDER_TYPES,
  CALENDAR_PROVIDER_STATUSES,
  CALENDAR_PROVIDER_AUTH_METHODS,
  CALENDAR_PROVIDER_CATALOG,
  CALENDAR_PROVIDER_RECOMMENDATIONS_BY_INDUSTRY,
  listCalendarProvidersForIndustry,
  isCalendarProviderRecommendedForIndustry,
  getCalendarProviderById,
} from "./schedule-provider.contracts";

// Sync health (OC-03)
export type {
  CalendarSyncStatus,
  CalendarProviderSyncCard,
  CalendarSourceHealthSummary,
} from "./schedule-sync.contracts";

export {
  CALENDAR_SYNC_STATUSES,
  CALENDAR_SYNC_STALE_THRESHOLD_MS,
  CALENDAR_PROVIDER_ACCENT_COLORS,
  CALENDAR_PROVIDER_ACCENT_FALLBACK,
  getProviderAccentColor,
  deriveCalendarSourceHealth,
} from "./schedule-sync.contracts";

// Scheduling provider normalization + conflict contracts (OC-04)
export type {
  SchedulingPlatformProviderId,
  NormalizedSchedulingEvent,
  CalendarDuplicateReason,
  CalendarDuplicateSuppression,
  CalendarOverlapReason,
  CalendarOverlapConflict,
  SchedulingConflictResolutionResult,
} from "./schedule-normalization.contracts";

export {
  SCHEDULING_PLATFORM_PROVIDER_IDS,
  CALENDAR_DUPLICATE_REASONS,
  CALENDAR_OVERLAP_REASONS,
  isSchedulingPlatformProviderId,
} from "./schedule-normalization.contracts";

// Cross-feature suggestion contracts (OC-05)
export type {
  CalendarSuggestionType,
  CalendarSuggestionSeverity,
  CalendarSuggestedAction,
  CalendarOperationalSuggestion,
  BookingInventoryHintSignal,
  JobMaterialGapSignal,
} from "./schedule-suggestions.contracts";

export {
  CALENDAR_SUGGESTION_TYPES,
  CALENDAR_SUGGESTION_SEVERITIES,
  CALENDAR_SUGGESTED_ACTIONS,
} from "./schedule-suggestions.contracts";

// Ops hardening contracts (OC-06)
export type {
  CalendarOpsHealthSummary,
  CalendarLoadGuardResult,
  CalendarAuditAction,
  CalendarAuditOutcome,
  CalendarActorRole,
  CalendarPermissionDecision,
  CalendarAuditEntry,
} from "./schedule-ops.contracts";

export {
  CALENDAR_EVENT_RENDER_CAP_BY_VIEW,
  CALENDAR_AUDIT_ACTIONS,
  CALENDAR_AUDIT_OUTCOMES,
  CALENDAR_ACTOR_ROLES,
} from "./schedule-ops.contracts";
