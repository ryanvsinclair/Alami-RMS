-- Create industry type enum
CREATE TYPE "IndustryType" AS ENUM ('restaurant', 'salon', 'retail', 'contractor', 'general');

-- Add business industry type (table is still mapped to "restaurants")
ALTER TABLE "restaurants"
ADD COLUMN "industry_type" "IndustryType" NOT NULL DEFAULT 'general';

-- Create per-business module toggles
CREATE TABLE "business_modules" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "module_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_modules_business_id_module_id_key"
  ON "business_modules"("business_id", "module_id");

CREATE INDEX "business_modules_business_id_idx"
  ON "business_modules"("business_id");

ALTER TABLE "business_modules"
ADD CONSTRAINT "business_modules_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "restaurants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: preserve existing functionality for all current businesses
INSERT INTO "business_modules" ("id", "business_id", "module_id", "enabled", "created_at")
SELECT
  gen_random_uuid()::text,
  b.id,
  m.module_id,
  true,
  now()
FROM "restaurants" b
CROSS JOIN (VALUES ('shopping'), ('receipts'), ('integrations')) AS m(module_id);
