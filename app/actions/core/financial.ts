// Transitional wrapper during app-structure refactor.
// Canonical dashboard summary implementation lives in: src/features/home/server/*

"use server";

import { prisma } from "@/core/prisma";
import { requireBusinessId } from "@/core/auth/tenant";
import { getHomeDashboardSummary } from "@/features/home/server";
import type { DashboardPeriod as HomeDashboardPeriod } from "@/features/home/server";
import type { NormalizedTransaction, SyncResult } from "@/modules/integrations/types";
export type DashboardPeriod = HomeDashboardPeriod;

export async function getDashboardSummary(period: DashboardPeriod = "month") {
  const businessId = await requireBusinessId();
  return getHomeDashboardSummary(businessId, period);
}

/**
 * Idempotent ingestion of normalized revenue/expense transactions.
 * Used by future API sync jobs (GoDaddy POS, Uber Eats, DoorDash).
 * Historical records are NEVER overwritten — upsert with update: {} guarantees this.
 */
export async function ingestFinancialTransactions(
  records: NormalizedTransaction[]
): Promise<SyncResult> {
  const businessId = await requireBusinessId();
  if (records.length === 0) {
    return {
      source: "manual",
      records_fetched: 0,
      records_created: 0,
      errors: [],
    };
  }

  const source = records[0].source;
  let created = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const result = await prisma.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: businessId,
            source: record.source,
            external_id: record.external_id,
          },
        },
        create: {
          business_id: businessId,
          type: record.type,
          source: record.source,
          amount: record.amount,
          description: record.description,
          occurred_at: record.occurred_at,
          external_id: record.external_id,
          metadata: record.metadata as never ?? undefined,
        },
        update: {}, // Never overwrite historical data
        select: { id: true, created_at: true },
      });
      // created_at === updated_at only on fresh inserts (Prisma upsert doesn't expose isNew)
      // We count based on whether the record was newly inserted by checking created_at proximity
      const ageMs = Date.now() - new Date(result.created_at as Date).getTime();
      if (ageMs < 5000) created++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    source,
    records_fetched: records.length,
    records_created: created,
    errors,
  };
}
