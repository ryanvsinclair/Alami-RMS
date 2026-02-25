-- CreateTable
CREATE TABLE "receipt_item_aliases" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "google_place_id" TEXT NOT NULL,
    "alias_text" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "confidence" "MatchConfidence" NOT NULL DEFAULT 'high',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_item_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_item_aliases_business_id_google_place_id_alias_text_key"
    ON "receipt_item_aliases"("business_id", "google_place_id", "alias_text");

-- CreateIndex
CREATE INDEX "receipt_item_aliases_business_id_google_place_id_idx"
    ON "receipt_item_aliases"("business_id", "google_place_id");

-- CreateIndex
CREATE INDEX "receipt_item_aliases_inventory_item_id_idx"
    ON "receipt_item_aliases"("inventory_item_id");

-- AddForeignKey
ALTER TABLE "receipt_item_aliases"
    ADD CONSTRAINT "receipt_item_aliases_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "restaurants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_item_aliases"
    ADD CONSTRAINT "receipt_item_aliases_inventory_item_id_fkey"
    FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
