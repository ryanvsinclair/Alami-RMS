import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/core/prisma";
import { INCOME_SYNC_DEFAULT_HISTORICAL_DAYS } from "@/features/integrations/shared";
import { fetchGoDaddyPilotIncomeEvents } from "@/features/integrations/providers/godaddy-pos.provider";
import { fetchUberEatsIncomeEvents } from "@/features/integrations/providers/uber-eats.provider";
import { fetchDoorDashIncomeEvents } from "@/features/integrations/providers/doordash.provider";
import { decryptIncomeSecret } from "./oauth-crypto";
import {
  findIncomeConnectionByProvider,
  markIncomeConnectionError,
  markIncomeConnectionExpired,
  markIncomeConnectionSyncSuccess,
} from "./connections.repository";
import type { IncomeProvider, FinancialSource } from "@/lib/generated/prisma/client";

// ---------------------------------------------------------------------------
// Sync lock constants
// ---------------------------------------------------------------------------

/** Max age (ms) of a "running" ExternalSyncLog before we consider it stale and allow a new sync. */
const SYNC_LOCK_STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

export interface ManualSyncInput {
  businessId: string;
  trigger?: "manual" | "scheduled" | "initial";
}

export interface ManualSyncResult {
  recordsFetched: number;
  periodStart: Date;
  periodEnd: Date;
}

// ---------------------------------------------------------------------------
// Shared internal event shape used by the generic upsert path
// ---------------------------------------------------------------------------

interface NormalizedProviderEvent {
  externalId: string;
  occurredAt: Date;
  grossAmount: number;
  fees: number;
  netAmount: number;
  currency: string;
  description: string;
  eventType?: string | null;
  payoutStatus?: string | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function subtractDays(base: Date, days: number): Date {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Generic sync runner — shared by all providers
// ---------------------------------------------------------------------------

async function runProviderManualSync(params: {
  businessId: string;
  providerId: IncomeProvider;
  sourceName: string;
  financialSource: FinancialSource;
  fetchEvents: (opts: { accessToken: string; since: Date; until: Date }) => Promise<NormalizedProviderEvent[]>;
}): Promise<ManualSyncResult> {
  const { businessId, providerId, sourceName, financialSource, fetchEvents } = params;

  const connection = await findIncomeConnectionByProvider({
    businessId,
    providerId,
  });

  if (!connection) {
    throw new Error(`${sourceName} is not connected for this business`);
  }

  if (!connection.access_token_encrypted) {
    throw new Error(`${sourceName} connection has no stored access token`);
  }

  const now = new Date();

  // ---------------------------------------------------------------------------
  // Token expiry guard: if token_expires_at is set and has passed, mark the
  // connection as expired (requires reconnect) and abort sync cleanly.
  // ---------------------------------------------------------------------------
  if (connection.token_expires_at && connection.token_expires_at <= now) {
    await markIncomeConnectionExpired({
      connectionId: connection.id,
      errorMessage: `Access token expired at ${connection.token_expires_at.toISOString()}. Please reconnect.`,
    });
    throw new Error(`${sourceName} access token has expired. Please reconnect via the Integrations page.`);
  }

  // ---------------------------------------------------------------------------
  // Sync lock guard: reject if a non-stale "running" log already exists for
  // this business+source to prevent duplicate concurrent syncs.
  // ---------------------------------------------------------------------------
  const lockCutoff = new Date(now.getTime() - SYNC_LOCK_STALE_AFTER_MS);
  const inflightLog = await prisma.externalSyncLog.findFirst({
    where: {
      business_id: businessId,
      source: financialSource,
      status: "running",
      started_at: { gte: lockCutoff },
    },
    orderBy: { started_at: "desc" },
  });
  if (inflightLog) {
    throw new Error(
      `${sourceName} sync is already in progress (started ${inflightLog.started_at.toISOString()}). Try again in a few minutes.`
    );
  }

  const periodStart =
    connection.last_sync_at ?? subtractDays(now, INCOME_SYNC_DEFAULT_HISTORICAL_DAYS);
  const periodEnd = now;
  const isFullSync = !connection.last_sync_at;

  const syncLog = await prisma.externalSyncLog.create({
    data: {
      business_id: businessId,
      source: financialSource,
      status: "running",
      period_start: periodStart,
      period_end: periodEnd,
      records_fetched: 0,
    },
  });

  try {
    const accessToken = decryptIncomeSecret(connection.access_token_encrypted);
    const events = await fetchEvents({ accessToken, since: periodStart, until: periodEnd });

    for (const event of events) {
      const incomeEvent = await prisma.incomeEvent.upsert({
        where: {
          connection_id_external_id: {
            connection_id: connection.id,
            external_id: event.externalId,
          },
        },
        create: {
          business_id: businessId,
          connection_id: connection.id,
          provider_id: providerId,
          source_name: sourceName,
          external_id: event.externalId,
          event_type: event.eventType ?? null,
          gross_amount: event.grossAmount,
          fees: event.fees,
          net_amount: event.netAmount,
          currency: event.currency,
          occurred_at: event.occurredAt,
          payout_status: event.payoutStatus ?? "unknown",
          raw_payload: event.rawPayload as Prisma.InputJsonValue,
          normalized_payload: event.normalizedPayload as Prisma.InputJsonValue,
        },
        update: {
          event_type: event.eventType ?? null,
          gross_amount: event.grossAmount,
          fees: event.fees,
          net_amount: event.netAmount,
          currency: event.currency,
          occurred_at: event.occurredAt,
          payout_status: event.payoutStatus ?? "unknown",
          raw_payload: event.rawPayload as Prisma.InputJsonValue,
          normalized_payload: event.normalizedPayload as Prisma.InputJsonValue,
          updated_at_provider: now,
        },
      });

      await prisma.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: businessId,
            source: financialSource,
            external_id: event.externalId,
          },
        },
        create: {
          business_id: businessId,
          type: "income",
          source: financialSource,
          amount: event.netAmount,
          description: event.description,
          occurred_at: event.occurredAt,
          external_id: event.externalId,
          metadata: {
            connection_id: connection.id,
            income_event_id: incomeEvent.id,
            provider_id: providerId,
          },
        },
        update: {},
      });
    }

    await markIncomeConnectionSyncSuccess({
      connectionId: connection.id,
      syncedAt: now,
      fullSync: isFullSync,
    });

    await prisma.externalSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        records_fetched: events.length,
        completed_at: now,
      },
    });

    return { recordsFetched: events.length, periodStart, periodEnd };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await markIncomeConnectionError({
      businessId,
      providerId,
      errorCode: "sync_failed",
      errorMessage: message,
    });

    await prisma.externalSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "failed",
        error_message: message,
        completed_at: new Date(),
      },
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public provider-specific sync entry points
// ---------------------------------------------------------------------------

export type RunGoDaddyPosManualSyncInput = ManualSyncInput;
export type RunGoDaddyPosManualSyncResult = ManualSyncResult;

export async function runGoDaddyPosManualSync(
  input: RunGoDaddyPosManualSyncInput
): Promise<RunGoDaddyPosManualSyncResult> {
  return runProviderManualSync({
    businessId: input.businessId,
    providerId: "godaddy_pos",
    sourceName: "GoDaddy POS",
    financialSource: "godaddy_pos",
    fetchEvents: fetchGoDaddyPilotIncomeEvents,
  });
}

export async function runUberEatsManualSync(
  input: ManualSyncInput
): Promise<ManualSyncResult> {
  return runProviderManualSync({
    businessId: input.businessId,
    providerId: "uber_eats",
    sourceName: "Uber Eats",
    financialSource: "uber_eats",
    fetchEvents: fetchUberEatsIncomeEvents,
  });
}

export async function runDoorDashManualSync(
  input: ManualSyncInput
): Promise<ManualSyncResult> {
  return runProviderManualSync({
    businessId: input.businessId,
    providerId: "doordash",
    sourceName: "DoorDash",
    financialSource: "doordash",
    fetchEvents: fetchDoorDashIncomeEvents,
  });
}

// ---------------------------------------------------------------------------
// Cron runner — incremental sync for all connected providers across all businesses
// ---------------------------------------------------------------------------

interface CronProviderConfig {
  providerId: IncomeProvider;
  financialSource: FinancialSource;
  sourceName: string;
  fetchEvents: (opts: { accessToken: string; since: Date; until: Date }) => Promise<NormalizedProviderEvent[]>;
}

const CRON_PROVIDER_CONFIGS: CronProviderConfig[] = [
  {
    providerId: "godaddy_pos",
    financialSource: "godaddy_pos",
    sourceName: "GoDaddy POS",
    fetchEvents: fetchGoDaddyPilotIncomeEvents,
  },
  {
    providerId: "uber_eats",
    financialSource: "uber_eats",
    sourceName: "Uber Eats",
    fetchEvents: fetchUberEatsIncomeEvents,
  },
  {
    providerId: "doordash",
    financialSource: "doordash",
    sourceName: "DoorDash",
    fetchEvents: fetchDoorDashIncomeEvents,
  },
];

export interface CronSyncResult {
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: number;
  details: Array<{
    businessId: string;
    providerId: string;
    status: "success" | "skipped" | "failed";
    recordsFetched?: number;
    error?: string;
  }>;
}

/**
 * Runs incremental sync for all connected providers across all businesses.
 * Intended to be triggered by an internal cron route (INCOME_SYNC_SCHEDULER_STRATEGY = "internal_cron_route").
 *
 * Each provider+business sync is attempted independently — failures are captured
 * in the result without stopping other syncs.
 */
export async function runAllProvidersCronSync(): Promise<CronSyncResult> {
  const result: CronSyncResult = {
    attempted: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const config of CRON_PROVIDER_CONFIGS) {
    // Find all connected connections for this provider across all businesses
    const connections = await prisma.businessIncomeConnection.findMany({
      where: {
        provider_id: config.providerId,
        status: "connected",
        access_token_encrypted: { not: null },
      },
      select: { business_id: true, id: true },
    });

    for (const conn of connections) {
      result.attempted++;
      try {
        const syncResult = await runProviderManualSync({
          businessId: conn.business_id,
          providerId: config.providerId,
          sourceName: config.sourceName,
          financialSource: config.financialSource,
          fetchEvents: config.fetchEvents,
        });
        result.succeeded++;
        result.details.push({
          businessId: conn.business_id,
          providerId: config.providerId,
          status: "success",
          recordsFetched: syncResult.recordsFetched,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Sync-in-progress lock errors are "skipped", not failures
        if (message.includes("already in progress")) {
          result.skipped++;
          result.details.push({
            businessId: conn.business_id,
            providerId: config.providerId,
            status: "skipped",
            error: message,
          });
        } else {
          result.failed++;
          result.details.push({
            businessId: conn.business_id,
            providerId: config.providerId,
            status: "failed",
            error: message,
          });
        }
      }
    }
  }

  return result;
}
