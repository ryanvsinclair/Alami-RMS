ALTER TABLE "shopping_session_items"
ADD COLUMN "scanned_barcode" TEXT;

CREATE INDEX "shopping_session_items_scanned_barcode_idx"
ON "shopping_session_items"("scanned_barcode");

-- Best-effort backfill for provisional quick-scan labels created before structured UPC storage.
UPDATE "shopping_session_items"
SET "scanned_barcode" = substring("raw_name" FROM '\[UPC:([0-9]{8,14})\]$')
WHERE "scanned_barcode" IS NULL
  AND "raw_name" ~ '\[UPC:[0-9]{8,14}\]$';
