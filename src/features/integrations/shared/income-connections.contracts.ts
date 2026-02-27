import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderDefinition } from "./provider-catalog.contracts";

export const INCOME_CONNECTION_STATUSES = [
  "not_connected",
  "connected",
  "error",
] as const;

export type IncomeConnectionStatus = (typeof INCOME_CONNECTION_STATUSES)[number];

/** Stale sync threshold: connected provider with no sync in 24 hours. */
export const SYNC_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface IncomeProviderConnectionCard {
  provider: IncomeProviderDefinition;
  industryType: IndustryType;
  recommended: boolean;
  status: IncomeConnectionStatus;
  connectionId: string | null;
  lastSyncAt: string | null;
  /** True if provider is connected but last sync was >24h ago or has never synced. */
  syncStale: boolean;
  /** Last error message from provider, populated when status is "error". */
  lastErrorMessage: string | null;
  connectLabel: string;
  connectEnabled: boolean;
  connectHref: string | null;
  syncEnabled: boolean;
  syncHref: string | null;
}
