import type {
  SchedulingConflictResolutionResult,
  SchedulingPlatformProviderId,
} from "@/features/schedule/shared/schedule-normalization.contracts";
import type { SchedulingNormalizationContext } from "./scheduling-connectors";
import {
  getSchedulingPlatformConnector,
  normalizeSchedulingProviderEvent,
} from "./scheduling-connectors";
import { resolveSchedulingEventConflicts } from "./schedule-conflict.service";

type RawProviderEvent = Record<string, unknown>;

export interface RunSchedulingProviderSyncPreviewInput {
  providerId: SchedulingPlatformProviderId;
  businessId: string;
  accessToken: string;
  since: Date;
  until: Date;
  timezone?: string | null;
  /**
   * Optional test hook: bypass connector fetch and normalize this payload
   * collection directly.
   */
  rawEventsOverride?: RawProviderEvent[];
}

export interface RunSchedulingProviderSyncPreviewResult
  extends SchedulingConflictResolutionResult {
  providerId: SchedulingPlatformProviderId;
  fetchedCount: number;
  normalizedCount: number;
  droppedCount: number;
}

function normalizeFetchedEvents(
  providerId: SchedulingPlatformProviderId,
  rawEvents: RawProviderEvent[],
  context: SchedulingNormalizationContext
) {
  return rawEvents
    .map((payload) => normalizeSchedulingProviderEvent(providerId, payload, context))
    .filter((event) => event !== null);
}

export async function runSchedulingProviderSyncPreview(
  input: RunSchedulingProviderSyncPreviewInput
): Promise<RunSchedulingProviderSyncPreviewResult> {
  const connector = getSchedulingPlatformConnector(input.providerId);

  const rawEvents =
    input.rawEventsOverride ??
    (await connector.fetchEvents({
      accessToken: input.accessToken,
      since: input.since,
      until: input.until,
    }));

  const normalizedEvents = normalizeFetchedEvents(input.providerId, rawEvents, {
    businessId: input.businessId,
    timezone: input.timezone,
  });

  const conflictResolution = resolveSchedulingEventConflicts(normalizedEvents);
  return {
    providerId: input.providerId,
    fetchedCount: rawEvents.length,
    normalizedCount: normalizedEvents.length,
    droppedCount: rawEvents.length - normalizedEvents.length,
    ...conflictResolution,
  };
}

