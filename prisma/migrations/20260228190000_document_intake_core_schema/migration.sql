-- CreateEnum
CREATE TYPE "DocumentInboundChannel" AS ENUM ('email', 'webhook', 'manual_upload');

-- CreateEnum
CREATE TYPE "DocumentDraftStatus" AS ENUM ('received', 'parsing', 'draft', 'pending_review', 'posted', 'rejected');

-- CreateEnum
CREATE TYPE "VendorTrustState" AS ENUM ('unverified', 'learning', 'trusted', 'blocked');

-- AlterEnum
ALTER TYPE "FinancialSource" ADD VALUE 'document_intake';

-- CreateTable
CREATE TABLE "inbound_addresses" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "address_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "vendor_aliases" JSONB NOT NULL DEFAULT '[]',
    "supplier_id" TEXT,
    "default_category_id" TEXT,
    "trust_state" "VendorTrustState" NOT NULL DEFAULT 'unverified',
    "total_posted" INTEGER NOT NULL DEFAULT 0,
    "trust_threshold_override" INTEGER,
    "auto_post_enabled" BOOLEAN NOT NULL DEFAULT false,
    "trust_threshold_met_at" TIMESTAMP(3),
    "last_document_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_drafts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "vendor_profile_id" TEXT,
    "inbound_channel" "DocumentInboundChannel" NOT NULL,
    "raw_storage_path" TEXT NOT NULL,
    "raw_content_type" TEXT NOT NULL,
    "raw_content_hash" TEXT NOT NULL,
    "postmark_message_id" TEXT,
    "status" "DocumentDraftStatus" NOT NULL DEFAULT 'received',
    "parsed_vendor_name" TEXT,
    "parsed_date" TIMESTAMP(3),
    "parsed_total" DECIMAL(10,2),
    "parsed_tax" DECIMAL(10,2),
    "parsed_line_items" JSONB,
    "confidence_score" DECIMAL(4,3),
    "confidence_band" "MatchConfidence",
    "parse_flags" JSONB,
    "anomaly_flags" JSONB,
    "financial_transaction_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "posted_by_user_id" TEXT,
    "auto_posted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_vendor_item_mappings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "raw_line_item_name" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_vendor_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_addresses_address_token_key" ON "inbound_addresses"("address_token");

-- CreateIndex
CREATE INDEX "inbound_addresses_business_id_idx" ON "inbound_addresses"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_addresses_business_id_key" ON "inbound_addresses"("business_id");

-- CreateIndex
CREATE INDEX "vendor_profiles_business_id_idx" ON "vendor_profiles"("business_id");

-- CreateIndex
CREATE INDEX "vendor_profiles_supplier_id_idx" ON "vendor_profiles"("supplier_id");

-- CreateIndex
CREATE INDEX "vendor_profiles_default_category_id_idx" ON "vendor_profiles"("default_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_business_id_vendor_name_key" ON "vendor_profiles"("business_id", "vendor_name");

-- CreateIndex
CREATE UNIQUE INDEX "document_drafts_financial_transaction_id_key" ON "document_drafts"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "document_drafts_business_id_idx" ON "document_drafts"("business_id");

-- CreateIndex
CREATE INDEX "document_drafts_status_idx" ON "document_drafts"("status");

-- CreateIndex
CREATE INDEX "document_drafts_vendor_profile_id_idx" ON "document_drafts"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "document_drafts_business_id_created_at_idx" ON "document_drafts"("business_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "document_drafts_postmark_message_id_idx" ON "document_drafts"("postmark_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_drafts_business_id_raw_content_hash_key" ON "document_drafts"("business_id", "raw_content_hash");

-- CreateIndex
CREATE INDEX "document_vendor_item_mappings_business_id_idx" ON "document_vendor_item_mappings"("business_id");

-- CreateIndex
CREATE INDEX "document_vendor_item_mappings_vendor_profile_id_idx" ON "document_vendor_item_mappings"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "document_vendor_item_mappings_inventory_item_id_idx" ON "document_vendor_item_mappings"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_vendor_item_mappings_business_id_vendor_profile_id_key" ON "document_vendor_item_mappings"("business_id", "vendor_profile_id", "raw_line_item_name");

-- AddForeignKey
ALTER TABLE "inbound_addresses" ADD CONSTRAINT "inbound_addresses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_financial_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_vendor_item_mappings" ADD CONSTRAINT "document_vendor_item_mappings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_vendor_item_mappings" ADD CONSTRAINT "document_vendor_item_mappings_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_vendor_item_mappings" ADD CONSTRAINT "document_vendor_item_mappings_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

