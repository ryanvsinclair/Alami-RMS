CREATE TYPE "IncomeProvider" AS ENUM (
  'godaddy_pos',
  'uber_eats',
  'doordash',
  'square',
  'stripe',
  'toast',
  'skip_the_dishes'
);

CREATE TYPE "IncomeConnectionStatus" AS ENUM (
  'pending',
  'connected',
  'expired',
  'error',
  'disconnected'
);

CREATE TABLE "business_income_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "provider_id" "IncomeProvider" NOT NULL,
  "provider_type" TEXT,
  "display_name" TEXT,
  "external_account_id" TEXT,
  "external_location_id" TEXT,
  "status" "IncomeConnectionStatus" NOT NULL DEFAULT 'pending',
  "access_token_encrypted" TEXT,
  "refresh_token_encrypted" TEXT,
  "token_expires_at" TIMESTAMP(3),
  "scopes" JSONB,
  "sync_cursor" JSONB,
  "last_sync_at" TIMESTAMP(3),
  "last_full_sync_at" TIMESTAMP(3),
  "last_webhook_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_income_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_income_connections_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "business_income_connections_business_id_provider_id_key"
  ON "business_income_connections"("business_id", "provider_id");

CREATE INDEX "business_income_connections_business_id_status_idx"
  ON "business_income_connections"("business_id", "status");

CREATE INDEX "business_income_connections_provider_id_status_idx"
  ON "business_income_connections"("provider_id", "status");

CREATE TABLE "income_oauth_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider_id" "IncomeProvider" NOT NULL,
  "state_hash" TEXT NOT NULL,
  "pkce_verifier_encrypted" TEXT,
  "redirect_uri" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "income_oauth_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "income_oauth_states_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "income_oauth_states_state_hash_key"
  ON "income_oauth_states"("state_hash");

CREATE INDEX "income_oauth_states_business_id_provider_id_idx"
  ON "income_oauth_states"("business_id", "provider_id");

CREATE INDEX "income_oauth_states_user_id_idx"
  ON "income_oauth_states"("user_id");

CREATE INDEX "income_oauth_states_expires_at_idx"
  ON "income_oauth_states"("expires_at");
