-- Backfill table_service module for existing restaurant businesses.
-- New restaurant businesses receive this module from industry presets.
INSERT INTO "business_modules" ("id", "business_id", "module_id", "enabled", "created_at")
SELECT
  gen_random_uuid()::text,
  b.id,
  'table_service',
  true,
  now()
FROM "businesses" b
WHERE b.industry_type = 'restaurant'
  AND NOT EXISTS (
    SELECT 1
    FROM "business_modules" bm
    WHERE bm.business_id = b.id
      AND bm.module_id = 'table_service'
  );
