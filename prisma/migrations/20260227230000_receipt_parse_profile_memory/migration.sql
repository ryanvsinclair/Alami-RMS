CREATE TABLE "receipt_parse_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "supplier_id" UUID,
  "google_place_id" TEXT,
  "profile_key" TEXT NOT NULL,
  "signals" JSONB,
  "stats" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "receipt_parse_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipt_parse_profiles_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "receipt_parse_profiles_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "receipt_parse_profiles_business_id_profile_key_key"
  ON "receipt_parse_profiles"("business_id", "profile_key");

CREATE INDEX "receipt_parse_profiles_business_id_last_seen_at_idx"
  ON "receipt_parse_profiles"("business_id", "last_seen_at" DESC);

CREATE INDEX "receipt_parse_profiles_supplier_id_idx"
  ON "receipt_parse_profiles"("supplier_id");

CREATE INDEX "receipt_parse_profiles_google_place_id_idx"
  ON "receipt_parse_profiles"("google_place_id");
