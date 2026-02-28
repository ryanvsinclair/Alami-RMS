ALTER TABLE "businesses"
  ADD COLUMN "google_place_id" TEXT,
  ADD COLUMN "formatted_address" TEXT,
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);

CREATE INDEX "businesses_google_place_id_idx" ON "businesses"("google_place_id");
