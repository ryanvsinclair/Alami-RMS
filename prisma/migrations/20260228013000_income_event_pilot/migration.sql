CREATE TABLE "income_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "connection_id" UUID NOT NULL,
  "provider_id" "IncomeProvider" NOT NULL,
  "source_name" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_parent_id" TEXT,
  "event_type" TEXT,
  "gross_amount" DECIMAL(10,2) NOT NULL,
  "fees" DECIMAL(10,2) NOT NULL,
  "net_amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "payout_status" TEXT,
  "raw_payload" JSONB,
  "normalized_payload" JSONB,
  "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at_provider" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "income_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "income_events_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "income_events_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "business_income_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "income_events_connection_id_external_id_key"
  ON "income_events"("connection_id", "external_id");

CREATE INDEX "income_events_business_id_occurred_at_idx"
  ON "income_events"("business_id", "occurred_at" DESC);

CREATE INDEX "income_events_provider_id_occurred_at_idx"
  ON "income_events"("provider_id", "occurred_at" DESC);

CREATE INDEX "income_events_payout_status_idx"
  ON "income_events"("payout_status");
