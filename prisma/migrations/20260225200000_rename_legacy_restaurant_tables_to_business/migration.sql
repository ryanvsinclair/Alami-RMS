-- Rename legacy physical table/type names so the database UI reflects the
-- business-level domain model used in the app code.
-- Safe to run on DBs where enum renames may already have happened.

-- ============================================================
-- 1) Enum types (legacy -> business)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'RestaurantRole'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'BusinessRole'
  ) THEN
    ALTER TYPE "RestaurantRole" RENAME TO "BusinessRole";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'RestaurantInviteStatus'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'BusinessInviteStatus'
  ) THEN
    ALTER TYPE "RestaurantInviteStatus" RENAME TO "BusinessInviteStatus";
  END IF;
END $$;

-- ============================================================
-- 2) Tables (legacy -> business)
-- ============================================================

ALTER TABLE IF EXISTS "restaurants" RENAME TO "businesses";
ALTER TABLE IF EXISTS "user_restaurants" RENAME TO "user_businesses";
ALTER TABLE IF EXISTS "restaurant_invites" RENAME TO "business_invites";

-- ============================================================
-- 3) Constraint/index names (cleanup for UI readability)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_pkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "businesses" RENAME CONSTRAINT "restaurants_pkey" TO "businesses_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_restaurants_pkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "user_businesses" RENAME CONSTRAINT "user_restaurants_pkey" TO "user_businesses_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_restaurants_business_id_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "user_businesses" RENAME CONSTRAINT "user_restaurants_business_id_fkey" TO "user_businesses_business_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname = 'user_restaurants_restaurant_id_idx'
  ) THEN
    ALTER INDEX "user_restaurants_restaurant_id_idx" RENAME TO "user_businesses_business_id_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_invites_pkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "business_invites" RENAME CONSTRAINT "restaurant_invites_pkey" TO "business_invites_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_invites_token_key'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "business_invites" RENAME CONSTRAINT "restaurant_invites_token_key" TO "business_invites_token_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_invites_business_id_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "business_invites" RENAME CONSTRAINT "restaurant_invites_business_id_fkey" TO "business_invites_business_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname = 'restaurant_invites_business_id_status_idx'
  ) THEN
    ALTER INDEX "restaurant_invites_business_id_status_idx" RENAME TO "business_invites_business_id_status_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname = 'restaurant_invites_email_idx'
  ) THEN
    ALTER INDEX "restaurant_invites_email_idx" RENAME TO "business_invites_email_idx";
  END IF;
END $$;
