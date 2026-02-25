-- CreateEnum
CREATE TYPE "BarcodeResolutionStatus" AS ENUM ('resolved', 'unresolved', 'needs_review');

-- CreateEnum
CREATE TYPE "BarcodeSourceProvider" AS ENUM (
  'internal_tenant_lookup',
  'open_food_facts',
  'open_beauty_facts',
  'upcdatabase',
  'upcitemdb',
  'manual'
);

-- CreateEnum
CREATE TYPE "BarcodeResolutionEventOutcome" AS ENUM ('hit', 'miss', 'error', 'throttled');

-- CreateTable
CREATE TABLE "global_barcode_catalog" (
    "id" TEXT NOT NULL,
    "barcode_normalized" TEXT NOT NULL,
    "gtin_format" TEXT,
    "resolution_status" "BarcodeResolutionStatus" NOT NULL DEFAULT 'unresolved',
    "canonical_title" TEXT,
    "brand" TEXT,
    "size_text" TEXT,
    "category_hint" TEXT,
    "image_url" TEXT,
    "confidence" "MatchConfidence" NOT NULL DEFAULT 'none',
    "source_provider" "BarcodeSourceProvider",
    "source_updated_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry_after_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "global_barcode_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_resolution_events" (
    "id" TEXT NOT NULL,
    "barcode_catalog_id" TEXT,
    "barcode_normalized" TEXT NOT NULL,
    "provider" "BarcodeSourceProvider" NOT NULL,
    "outcome" "BarcodeResolutionEventOutcome" NOT NULL,
    "confidence" "MatchConfidence" NOT NULL DEFAULT 'none',
    "normalized_fields_snapshot" JSONB,
    "error_code" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_resolution_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_barcode_catalog_barcode_normalized_key"
    ON "global_barcode_catalog"("barcode_normalized");

-- CreateIndex
CREATE INDEX "global_barcode_catalog_resolution_status_idx"
    ON "global_barcode_catalog"("resolution_status");

-- CreateIndex
CREATE INDEX "global_barcode_catalog_retry_after_at_idx"
    ON "global_barcode_catalog"("retry_after_at");

-- CreateIndex
CREATE INDEX "global_barcode_catalog_source_provider_idx"
    ON "global_barcode_catalog"("source_provider");

-- CreateIndex
CREATE INDEX "barcode_resolution_events_barcode_catalog_id_idx"
    ON "barcode_resolution_events"("barcode_catalog_id");

-- CreateIndex
CREATE INDEX "barcode_resolution_events_barcode_normalized_idx"
    ON "barcode_resolution_events"("barcode_normalized");

-- CreateIndex
CREATE INDEX "barcode_resolution_events_provider_outcome_idx"
    ON "barcode_resolution_events"("provider", "outcome");

-- CreateIndex
CREATE INDEX "barcode_resolution_events_created_at_idx"
    ON "barcode_resolution_events"("created_at");

-- AddForeignKey
ALTER TABLE "barcode_resolution_events"
    ADD CONSTRAINT "barcode_resolution_events_barcode_catalog_id_fkey"
    FOREIGN KEY ("barcode_catalog_id") REFERENCES "global_barcode_catalog"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
