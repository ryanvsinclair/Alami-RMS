-- Phase 1: Identity Refactor — restaurant → business
-- HAND-WRITTEN migration: renames only, zero data loss.

-- ============================================================
-- 1. Rename enums
-- ============================================================
ALTER TYPE "RestaurantRole" RENAME TO "BusinessRole";
ALTER TYPE "RestaurantInviteStatus" RENAME TO "BusinessInviteStatus";

-- ============================================================
-- 2. Rename restaurant_id → business_id on all child tables
-- ============================================================

-- categories
ALTER TABLE "categories" RENAME COLUMN "restaurant_id" TO "business_id";

-- suppliers
ALTER TABLE "suppliers" RENAME COLUMN "restaurant_id" TO "business_id";

-- inventory_items
ALTER TABLE "inventory_items" RENAME COLUMN "restaurant_id" TO "business_id";

-- item_barcodes
ALTER TABLE "item_barcodes" RENAME COLUMN "restaurant_id" TO "business_id";

-- receipts
ALTER TABLE "receipts" RENAME COLUMN "restaurant_id" TO "business_id";

-- inventory_transactions
ALTER TABLE "inventory_transactions" RENAME COLUMN "restaurant_id" TO "business_id";

-- shopping_sessions
ALTER TABLE "shopping_sessions" RENAME COLUMN "restaurant_id" TO "business_id";

-- item_price_history
ALTER TABLE "item_price_history" RENAME COLUMN "restaurant_id" TO "business_id";

-- financial_transactions
ALTER TABLE "financial_transactions" RENAME COLUMN "restaurant_id" TO "business_id";

-- external_sync_logs
ALTER TABLE "external_sync_logs" RENAME COLUMN "restaurant_id" TO "business_id";

-- contacts
ALTER TABLE "contacts" RENAME COLUMN "restaurant_id" TO "business_id";

-- user_restaurants
ALTER TABLE "user_restaurants" RENAME COLUMN "restaurant_id" TO "business_id";

-- restaurant_invites
ALTER TABLE "restaurant_invites" RENAME COLUMN "restaurant_id" TO "business_id";
