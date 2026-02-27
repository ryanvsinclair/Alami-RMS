import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/core/prisma";
import { INCOME_SYNC_DEFAULT_HISTORICAL_DAYS } from "@/features/integrations/shared";
import { fetchGoDaddyPilotIncomeEvents } from "@/features/integrations/providers/godaddy-pos.provider";
import { decryptIncomeSecret } from "./oauth-crypto";
import {
  findIncomeConnectionByProvider,
  markIncomeConnectionError,
  markIncomeConnectionSyncSuccess,
} from "./connections.repository";

export interface RunGoDaddyPosManualSyncInput {
  businessId: string;
  trigger?: "manual" | "scheduled" | "initial";
}

export interface RunGoDaddyPosManualSyncResult {
  recordsFetched: number;
  periodStart: Date;
  periodEnd: Date;
}

function subtractDays(base: Date, days: number): Date {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function runGoDaddyPosManualSync(
  input: RunGoDaddyPosManualSyncInput
): Promise<RunGoDaddyPosManualSyncResult> {
  const connection = await findIncomeConnectionByProvider({
    businessId: input.businessId,
    providerId: "godaddy_pos",
  });

  if (!connection) {
    throw new Error("GoDaddy POS is not connected for this business");
  }

  if (!connection.access_token_encrypted) {
    throw new Error("GoDaddy POS connection has no stored access token");
  }

  const now = new Date();
  const periodStart =
    connection.last_sync_at ?? subtractDays(now, INCOME_SYNC_DEFAULT_HISTORICAL_DAYS);
  const periodEnd = now;
  const isFullSync = !connection.last_sync_at;

  const syncLog = await prisma.externalSyncLog.create({
    data: {
      business_id: input.businessId,
      source: "godaddy_pos",
      status: "running",
      period_start: periodStart,
      period_end: periodEnd,
      records_fetched: 0,
    },
  });

  try {
    const accessToken = decryptIncomeSecret(connection.access_token_encrypted);
    const events = await fetchGoDaddyPilotIncomeEvents({
      accessToken,
      since: periodStart,
      until: periodEnd,
    });

    for (const event of events) {
      const incomeEvent = await prisma.incomeEvent.upsert({
        where: {
          connection_id_external_id: {
            connection_id: connection.id,
            external_id: event.externalId,
          },
        },
        create: {
          business_id: input.businessId,
          connection_id: connection.id,
          provider_id: "godaddy_pos",
          source_name: "GoDaddy POS",
          external_id: event.externalId,
          gross_amount: event.grossAmount,
          fees: event.fees,
          net_amount: event.netAmount,
          currency: event.currency,
          occurred_at: event.occurredAt,
          payout_status: "unknown",
          raw_payload: event.rawPayload as Prisma.InputJsonValue,
          normalized_payload: event.normalizedPayload as Prisma.InputJsonValue,
        },
        update: {
          gross_amount: event.grossAmount,
          fees: event.fees,
          net_amount: event.netAmount,
          currency: event.currency,
          occurred_at: event.occurredAt,
          raw_payload: event.rawPayload as Prisma.InputJsonValue,
          normalized_payload: event.normalizedPayload as Prisma.InputJsonValue,
          updated_at_provider: now,
        },
      });

      await prisma.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: input.businessId,
            source: "godaddy_pos",
            external_id: event.externalId,
          },
        },
        create: {
          business_id: input.businessId,
          type: "income",
          source: "godaddy_pos",
          amount: event.netAmount,
          description: event.description,
          occurred_at: event.occurredAt,
          external_id: event.externalId,
          metadata: {
            connection_id: connection.id,
            income_event_id: incomeEvent.id,
            provider_id: "godaddy_pos",
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

    return {
      recordsFetched: events.length,
      periodStart,
      periodEnd,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await markIncomeConnectionError({
      businessId: input.businessId,
      providerId: "godaddy_pos",
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
