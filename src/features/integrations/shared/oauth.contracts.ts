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

// ---------------------------------------------------------------------------
// Provider scope audit (IN-07 security checklist)
// Least-privilege scopes requested per provider.
// ---------------------------------------------------------------------------

/**
 * Minimum OAuth scopes requested from each provider.
 * These are read-only / reporting scopes only — no write/refund/payout access.
 * Update this map if a provider adapter requests additional scopes.
 */
export const INCOME_PROVIDER_OAUTH_SCOPES: Readonly<Record<string, readonly string[]>> = {
  /** GoDaddy POS: read-only transaction and order history */
  godaddy_pos: ["openid", "profile", "commerce.transactions.read"],
  /** Uber Eats: read-only order and payout reporting */
  uber_eats: ["eats.report.deliveries.read", "eats.report.payments.read"],
  /** DoorDash: read-only delivery and financials reporting */
  doordash: ["delivery.read", "financials.read"],
} as const;

/**
 * Token key version prefix written into every encrypted token blob.
 * When rotating INCOME_TOKEN_ENCRYPTION_KEY:
 *   1. Introduce a new key env var (e.g., INCOME_TOKEN_ENCRYPTION_KEY_V2).
 *   2. Update oauth-crypto.ts TOKEN_PREFIX to "v2" and resolve from new env var.
 *   3. Re-encrypt all existing tokens by running a one-time migration script that
 *      reads with v1 key and re-writes with v2 key.
 *   4. Remove v1 key from env after all tokens are migrated.
 * The version prefix in each encrypted blob allows safe co-existence during migration.
 */
export const INCOME_TOKEN_KEY_VERSION = "v1";
