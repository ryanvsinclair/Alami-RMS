import type {
  CalendarEventStatus,
  CalendarEventType,
} from "@/features/schedule/shared";
import type {
  NormalizedSchedulingEvent,
  SchedulingPlatformProviderId,
} from "@/features/schedule/shared/schedule-normalization.contracts";
import {
  SCHEDULING_PLATFORM_PROVIDER_IDS,
} from "@/features/schedule/shared/schedule-normalization.contracts";

type RawProviderEvent = Record<string, unknown>;

export interface SchedulingConnectorFetchInput {
  accessToken: string;
  since: Date;
  until: Date;
}

export interface SchedulingNormalizationContext {
  businessId: string;
  timezone?: string | null;
}

export interface SchedulingPlatformConnector {
  providerId: SchedulingPlatformProviderId;
  displayName: string;
  isConfigured: () => boolean;
  fetchEvents: (input: SchedulingConnectorFetchInput) => Promise<RawProviderEvent[]>;
  normalizeEvent: (
    payload: RawProviderEvent,
    context: SchedulingNormalizationContext
  ) => NormalizedSchedulingEvent | null;
}

interface ProviderNormalizationSpec {
  providerId: SchedulingPlatformProviderId;
  displayName: string;
  eventType: CalendarEventType;
  defaultTitle: string;
  defaultDurationMinutes: number;
  externalIdKeys: readonly string[];
  titleKeys: readonly string[];
  startAtKeys: readonly string[];
  endAtKeys: readonly string[];
  timezoneKeys: readonly string[];
  statusKeys: readonly string[];
  staffIdKeys: readonly string[];
  resourceIdKeys: readonly string[];
  linkedEntityIdKeys: readonly string[];
}

const PROVIDER_NORMALIZATION_SPECS: Record<
  SchedulingPlatformProviderId,
  ProviderNormalizationSpec
> = {
  square_appointments: {
    providerId: "square_appointments",
    displayName: "Square Appointments",
    eventType: "appointment",
    defaultTitle: "Square appointment",
    defaultDurationMinutes: 60,
    externalIdKeys: ["id", "appointment_id", "booking_id", "event_id"],
    titleKeys: ["title", "service_name", "service", "customer_name"],
    startAtKeys: ["start_at", "start_time", "starts_at", "scheduled_start"],
    endAtKeys: ["end_at", "end_time", "ends_at", "scheduled_end"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "state"],
    staffIdKeys: ["team_member_id", "staff_id", "provider_id"],
    resourceIdKeys: ["location_id", "calendar_id", "resource_id"],
    linkedEntityIdKeys: ["customer_id", "client_id", "contact_id"],
  },
  calendly: {
    providerId: "calendly",
    displayName: "Calendly",
    eventType: "appointment",
    defaultTitle: "Calendly appointment",
    defaultDurationMinutes: 60,
    externalIdKeys: ["id", "uri", "event_uuid", "uuid"],
    titleKeys: ["name", "event_type_name", "title", "invitee_name"],
    startAtKeys: ["start_time", "start_at", "starts_at", "scheduled_at"],
    endAtKeys: ["end_time", "end_at", "ends_at"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "event_status"],
    staffIdKeys: ["host_id", "user_id", "organizer_id"],
    resourceIdKeys: ["location_id", "calendar_id"],
    linkedEntityIdKeys: ["invitee_id", "contact_id", "customer_id"],
  },
  mindbody: {
    providerId: "mindbody",
    displayName: "Mindbody",
    eventType: "appointment",
    defaultTitle: "Mindbody appointment",
    defaultDurationMinutes: 60,
    externalIdKeys: ["id", "appointment_id", "class_id", "visit_id"],
    titleKeys: ["title", "service_name", "class_name", "customer_name"],
    startAtKeys: ["start_at", "start_time", "starts_at", "scheduled_start"],
    endAtKeys: ["end_at", "end_time", "ends_at", "scheduled_end"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "state"],
    staffIdKeys: ["staff_id", "provider_id", "trainer_id"],
    resourceIdKeys: ["location_id", "room_id"],
    linkedEntityIdKeys: ["client_id", "customer_id", "contact_id"],
  },
  fresha: {
    providerId: "fresha",
    displayName: "Fresha",
    eventType: "appointment",
    defaultTitle: "Fresha appointment",
    defaultDurationMinutes: 60,
    externalIdKeys: ["id", "appointment_id", "booking_id", "event_id"],
    titleKeys: ["title", "service_name", "customer_name"],
    startAtKeys: ["start_at", "start_time", "starts_at"],
    endAtKeys: ["end_at", "end_time", "ends_at"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "state"],
    staffIdKeys: ["staff_id", "provider_id"],
    resourceIdKeys: ["location_id", "resource_id"],
    linkedEntityIdKeys: ["customer_id", "client_id", "contact_id"],
  },
  vagaro: {
    providerId: "vagaro",
    displayName: "Vagaro",
    eventType: "appointment",
    defaultTitle: "Vagaro appointment",
    defaultDurationMinutes: 60,
    externalIdKeys: ["id", "appointment_id", "booking_id", "event_id"],
    titleKeys: ["title", "service_name", "customer_name"],
    startAtKeys: ["start_at", "start_time", "starts_at"],
    endAtKeys: ["end_at", "end_time", "ends_at"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "state"],
    staffIdKeys: ["staff_id", "provider_id"],
    resourceIdKeys: ["location_id", "resource_id"],
    linkedEntityIdKeys: ["customer_id", "client_id", "contact_id"],
  },
  opentable: {
    providerId: "opentable",
    displayName: "OpenTable",
    eventType: "reservation",
    defaultTitle: "OpenTable reservation",
    defaultDurationMinutes: 90,
    externalIdKeys: ["id", "reservation_id", "booking_id", "event_id"],
    titleKeys: ["title", "guest_name", "reservation_name"],
    startAtKeys: ["reservation_time", "start_at", "start_time", "starts_at"],
    endAtKeys: ["end_at", "end_time", "ends_at"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "reservation_status"],
    staffIdKeys: ["host_id", "staff_id"],
    resourceIdKeys: ["table_id", "section_id", "location_id"],
    linkedEntityIdKeys: ["guest_id", "customer_id", "contact_id"],
  },
  resy: {
    providerId: "resy",
    displayName: "Resy",
    eventType: "reservation",
    defaultTitle: "Resy reservation",
    defaultDurationMinutes: 90,
    externalIdKeys: ["id", "reservation_id", "booking_id", "event_id"],
    titleKeys: ["title", "guest_name", "reservation_name"],
    startAtKeys: ["reservation_time", "start_at", "start_time", "starts_at"],
    endAtKeys: ["end_at", "end_time", "ends_at"],
    timezoneKeys: ["timezone", "time_zone", "tz"],
    statusKeys: ["status", "reservation_status"],
    staffIdKeys: ["host_id", "staff_id"],
    resourceIdKeys: ["table_id", "section_id", "location_id"],
    linkedEntityIdKeys: ["guest_id", "customer_id", "contact_id"],
  },
};

function asRecord(value: unknown): RawProviderEvent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as RawProviderEvent;
}

function pickString(payload: RawProviderEvent, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function toProviderEventId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function pickDate(payload: RawProviderEvent, keys: readonly string[]): Date | null {
  for (const key of keys) {
    const value = payload[key];
    const parsed = parseDate(value);
    if (parsed) return parsed;
  }
  return null;
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function normalizeStatus(rawValue: string | null): CalendarEventStatus {
  if (!rawValue) return "scheduled";
  const normalized = rawValue.trim().toLowerCase();

  if (
    normalized.includes("cancel") ||
    normalized.includes("no_show") ||
    normalized.includes("no-show")
  ) {
    return "cancelled";
  }

  if (
    normalized.includes("complete") ||
    normalized.includes("fulfilled") ||
    normalized.includes("done")
  ) {
    return "completed";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("hold") ||
    normalized.includes("tentative")
  ) {
    return "tentative";
  }

  return "scheduled";
}

function normalizeTimezone(value: string | null, fallback: string | null | undefined): string {
  if (value && value.trim().length > 0) return value.trim();
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  return "UTC";
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildProviderEventFingerprint(event: {
  providerId: SchedulingPlatformProviderId;
  title: string;
  startAt: Date;
  endAt: Date;
  staffId?: string | null;
  resourceId?: string | null;
  linkedEntityId?: string | null;
}): string {
  return [
    event.providerId,
    normalizeTitle(event.title),
    event.startAt.toISOString(),
    event.endAt.toISOString(),
    event.staffId ?? "-",
    event.resourceId ?? "-",
    event.linkedEntityId ?? "-",
  ].join("|");
}

function normalizeProviderEventWithSpec(
  spec: ProviderNormalizationSpec,
  payload: RawProviderEvent,
  context: SchedulingNormalizationContext
): NormalizedSchedulingEvent | null {
  const providerEventIdRaw = pickString(payload, spec.externalIdKeys);
  if (!providerEventIdRaw) return null;

  const providerEventId = toProviderEventId(providerEventIdRaw);
  if (!providerEventId) return null;

  const startAt = pickDate(payload, spec.startAtKeys);
  if (!startAt) return null;

  const warnings: string[] = [];
  let endAt = pickDate(payload, spec.endAtKeys);
  if (!endAt) {
    endAt = addMinutes(startAt, spec.defaultDurationMinutes);
    warnings.push("missing_end_at_default_applied");
  }

  if (endAt.getTime() <= startAt.getTime()) {
    endAt = addMinutes(startAt, spec.defaultDurationMinutes);
    warnings.push("invalid_end_at_default_applied");
  }

  const title = pickString(payload, spec.titleKeys) ?? spec.defaultTitle;
  const timezone = normalizeTimezone(
    pickString(payload, spec.timezoneKeys),
    context.timezone
  );
  const status = normalizeStatus(pickString(payload, spec.statusKeys));
  const staffId = pickString(payload, spec.staffIdKeys);
  const resourceId = pickString(payload, spec.resourceIdKeys);
  const linkedEntityId = pickString(payload, spec.linkedEntityIdKeys);
  const id = `${spec.providerId}:${providerEventId}`;

  return {
    id,
    businessId: context.businessId,
    title,
    eventType: spec.eventType,
    source: "provider",
    editability: "read_only",
    status,
    startAt,
    endAt,
    timezone,
    staffId,
    resourceId,
    linkedEntityId,
    providerKey: spec.providerId,
    externalId: providerEventId,
    providerId: spec.providerId,
    providerEventId,
    providerEventFingerprint: buildProviderEventFingerprint({
      providerId: spec.providerId,
      title,
      startAt,
      endAt,
      staffId,
      resourceId,
      linkedEntityId,
    }),
    normalizationWarnings: warnings,
  };
}

function readSchedulingConnectorEventsUrl(providerId: SchedulingPlatformProviderId): string | null {
  const key = providerId.toUpperCase();
  return process.env[`SCHEDULE_SYNC_${key}_EVENTS_URL`] ?? null;
}

async function fetchEventsForProvider(
  providerId: SchedulingPlatformProviderId,
  input: SchedulingConnectorFetchInput
): Promise<RawProviderEvent[]> {
  const eventsUrl = readSchedulingConnectorEventsUrl(providerId);
  if (!eventsUrl) {
    return [];
  }

  const url = new URL(eventsUrl);
  url.searchParams.set("since", input.since.toISOString());
  url.searchParams.set("until", input.until.toISOString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Schedule sync fetch failed for "${providerId}" (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const arrayPayload = Array.isArray(payload)
    ? payload
    : asRecord(payload)?.events;

  if (!Array.isArray(arrayPayload)) return [];

  return arrayPayload
    .map((entry) => asRecord(entry))
    .filter((entry): entry is RawProviderEvent => entry !== null);
}

function createSchedulingPlatformConnector(
  providerId: SchedulingPlatformProviderId
): SchedulingPlatformConnector {
  const spec = PROVIDER_NORMALIZATION_SPECS[providerId];
  return {
    providerId,
    displayName: spec.displayName,
    isConfigured() {
      return Boolean(readSchedulingConnectorEventsUrl(providerId));
    },
    async fetchEvents(input) {
      return fetchEventsForProvider(providerId, input);
    },
    normalizeEvent(payload, context) {
      return normalizeProviderEventWithSpec(spec, payload, context);
    },
  };
}

const CONNECTOR_REGISTRY: Record<SchedulingPlatformProviderId, SchedulingPlatformConnector> =
  Object.fromEntries(
    SCHEDULING_PLATFORM_PROVIDER_IDS.map((providerId) => [
      providerId,
      createSchedulingPlatformConnector(providerId),
    ])
  ) as Record<SchedulingPlatformProviderId, SchedulingPlatformConnector>;

export function listSchedulingPlatformConnectors(): SchedulingPlatformConnector[] {
  return SCHEDULING_PLATFORM_PROVIDER_IDS.map((providerId) => CONNECTOR_REGISTRY[providerId]);
}

export function getSchedulingPlatformConnector(
  providerId: SchedulingPlatformProviderId
): SchedulingPlatformConnector {
  return CONNECTOR_REGISTRY[providerId];
}

export function normalizeSchedulingProviderEvent(
  providerId: SchedulingPlatformProviderId,
  payload: RawProviderEvent,
  context: SchedulingNormalizationContext
): NormalizedSchedulingEvent | null {
  const connector = getSchedulingPlatformConnector(providerId);
  return connector.normalizeEvent(payload, context);
}

