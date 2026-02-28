-- IMG-00 additive schema changes for item image enrichment.
-- Contains additive-only DDL to satisfy launch constraints.

ALTER TABLE "inventory_items"
ADD COLUMN "image_url" TEXT;

ALTER TABLE "global_barcode_catalog"
ADD COLUMN "image_storage_path" TEXT;

CREATE TABLE "produce_item_images" (
    "plu_code" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "source_provider" TEXT NOT NULL,
    "enriched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produce_item_images_pkey" PRIMARY KEY ("plu_code")
);
