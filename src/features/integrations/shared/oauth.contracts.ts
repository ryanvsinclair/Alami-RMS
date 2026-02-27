import type { BusinessRole } from "@/lib/generated/prisma/client";

export interface IncomeTokenEncryptionContract {
  algorithm: "aes-256-gcm";
  keyEnvVar: string;
  keyBytes: number;
  ivBytes: number;
  authTagBytes: number;
}

export const INCOME_TOKEN_ENCRYPTION_CONTRACT: IncomeTokenEncryptionContract = {
  algorithm: "aes-256-gcm",
  keyEnvVar: "INCOME_TOKEN_ENCRYPTION_KEY",
  keyBytes: 32,
  ivBytes: 12,
  authTagBytes: 16,
};

export const INCOME_OAUTH_STATE_TTL_MINUTES = 10;

export const INCOME_SYNC_DEFAULT_HISTORICAL_DAYS = 90;

export const INCOME_SYNC_SCHEDULER_STRATEGY = "internal_cron_route";

export const INCOME_CONNECTION_ALLOWED_ROLES = [
  "owner",
  "manager",
] as const satisfies readonly BusinessRole[];
