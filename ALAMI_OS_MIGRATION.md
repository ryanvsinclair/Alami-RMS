# Alami OS Migration Guide

> Transforming AlamirMS from a restaurant-specific app into a modular, industry-agnostic small business operating system.

**Last updated:** 2026-02-24
**Current status:** Phase 1 COMPLETE. Phases 2-4 pending.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Current Architecture (post-Phase 1)](#current-architecture-post-phase-1)
4. [Phase 1 — Identity Refactor (COMPLETE)](#phase-1--identity-refactor-complete)
5. [Phase 2 — Core vs Module Separation](#phase-2--core-vs-module-separation)
6. [Phase 3 — Capability Flag System](#phase-3--capability-flag-system)
7. [Phase 4 — Industry Preset Layer](#phase-4--industry-preset-layer)
8. [Risk Assessment](#risk-assessment)
9. [Phase Summary Table](#phase-summary-table)

---

## Project Overview

**Goal:** Industries are presets. Modules are building blocks. The engine is unified.

AlamirMS currently handles inventory, shopping, receipts, financial tracking, and staff management for restaurants. The migration renames all "restaurant" terminology to "business" (Phase 1), separates core logic from optional modules (Phase 2), adds per-business module toggling (Phase 3), and introduces industry presets so salons, retail, contractors etc. get tailored experiences from the same codebase (Phase 4).

**Key constraint:** Zero breakage. Every phase must pass `npx tsc --noEmit` and `npx next build` before deployment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL on Supabase |
| Auth | Supabase Auth (cookie-based sessions) |
| Storage | Supabase Storage (receipt images) |
| OCR | TabScanner API (receipts), Google Vision (labels) |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |

---

## Current Architecture (post-Phase 1)

### Database

17 Prisma models, all scoped by `business_id`. The `Business` model is the central tenant. Every query is guarded by `requireBusinessId()` from `lib/auth/tenant.ts`.

**DB table names are unchanged** from the original schema — Prisma `@@map` annotations map the new model names to the old table names (e.g. `Business` maps to `restaurants` table, `business_id` column was renamed via migration). This means Supabase dashboard, RLS policies, and storage paths all continue to work.

**Exception:** The `restaurant_id` column was physically renamed to `business_id` on all 13 tables via `ALTER TABLE ... RENAME COLUMN`. The `RestaurantRole` and `RestaurantInviteStatus` enums were renamed to `BusinessRole` and `BusinessInviteStatus` at the PostgreSQL level.

### Folder Structure

```
alamirms/
  app/
    (dashboard)/              # Route group — all authed dashboard pages
      contacts/page.tsx
      inventory/page.tsx, [id]/page.tsx
      receive/page.tsx, barcode/, manual/, photo/, receipt/
      shopping/page.tsx, orders/, orders/[id]/
      staff/page.tsx
      layout.tsx              # Dashboard shell (wraps all dashboard routes)
    auth/
      login/page.tsx
      signup/page.tsx
      accept-invite/page.tsx
      layout.tsx
    actions/                  # Server actions (all "use server")
      auth.ts                 # signIn, signUp, signOut
      categories.ts           # getCategories, createCategory, getSuppliers, createSupplier
      contacts.ts             # CRUD for contacts
      financial.ts            # getDashboardSummary, ingestFinancialTransactions
      ingestion.ts            # ingestByBarcode, ingestByPhoto, ingestManual, ingestByReceipt
      inventory.ts            # CRUD for inventory items, barcodes, aliases
      ocr.ts                  # ocrImage (Google Vision), scanReceiptImage (TabScanner)
      receipts.ts             # receipt CRUD, processReceiptText, processReceiptImage
      shopping.ts             # shopping session lifecycle (start, add items, reconcile, commit)
      staff.ts                # staff members, invites, accept invite
      transactions.ts         # createTransaction, commitReceiptTransactions, queries
      upload.ts               # uploadReceiptImageAction
    page.tsx                  # Financial dashboard (home page)
    layout.tsx                # Root layout (fonts, metadata, PWA)
  components/
    nav/bottom-nav.tsx        # Bottom navigation bar
    nav/page-header.tsx       # Reusable page header
    pwa/                      # Service worker registration
    ui/                       # Shared UI components
  lib/
    auth/
      tenant.ts               # requireBusinessId(), ensureBusinessForUser(), requireBusinessMembership()
      server.ts               # requireSupabaseUser(), cookie management
    matching/
      engine.ts               # matchText(), learnAlias() — fuzzy inventory matching
      fuzzy.ts                # similarity(), normalizeText(), wordOverlap()
      confidence.ts           # scoreToConfidence()
    parsers/
      receipt.ts              # parseReceiptText() — text-based receipt parsing
      shelf-label.ts          # parseShelfLabel()
      product-name.ts         # extractProductName(), extractProductInfo()
    ocr/
      tabscanner.ts           # scanReceipt() — TabScanner API client (receipts)
      google-vision.ts        # extractTextFromImage() — Google Vision (labels, photos)
    integrations/
      types.ts                # NormalizedTransaction, SyncResult interfaces
      godaddy-pos.ts          # GoDaddy POS sync (stub)
      uber-eats.ts            # Uber Eats sync (stub)
      doordash.ts             # DoorDash sync (stub)
    google/
      places.ts               # Google Places autocomplete
    supabase/
      storage.ts              # uploadReceiptImage()
    utils/
      serialize.ts            # serialize() — Prisma Decimal/Date serialization
      compress-image.ts       # compressImage() — client-side image compression
    types/                    # Shared TypeScript types
    generated/prisma/         # Auto-generated Prisma client (DO NOT EDIT)
    prisma.ts                 # Singleton Prisma client instance
  prisma/
    schema.prisma             # Database schema (source of truth)
    prisma.config.ts          # Prisma config (adapter setup)
    migrations/               # 8 migrations (all deployed)
```

### Key Patterns

**Tenant isolation:** Every server action calls `const businessId = await requireBusinessId()` at the top, then passes `business_id: businessId` to every Prisma query. This is the multi-tenant guard.

**Shopping session lifecycle:** `draft` -> `reconciling` -> `ready` -> `committed`. TabScanner handles receipt OCR. Committing a session creates `InventoryTransaction` records and bridges to the `FinancialTransaction` ledger.

**Financial ledger:** Idempotent upserts using `business_id_source_external_id` compound unique key. Shopping session commits auto-create expense records. Integration syncs (GoDaddy, Uber, DoorDash) create income records.

---

## Phase 1 -- Identity Refactor (COMPLETE)

**Status:** Deployed to production on 2026-02-24.

### What was done

All "restaurant" references renamed to "business" across the entire codebase and database.

### Database migration

**File:** `prisma/migrations/20260224200000_identity_refactor_business/migration.sql`

Hand-written SQL (no Prisma auto-generation — that would drop and recreate tables):

```sql
-- Enum renames
ALTER TYPE "RestaurantRole" RENAME TO "BusinessRole";
ALTER TYPE "RestaurantInviteStatus" RENAME TO "BusinessInviteStatus";

-- Column renames on all 13 tables
ALTER TABLE "categories" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "suppliers" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "inventory_items" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "item_barcodes" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "receipts" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "inventory_transactions" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "shopping_sessions" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "item_price_history" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "financial_transactions" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "external_sync_logs" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "contacts" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "user_restaurants" RENAME COLUMN "restaurant_id" TO "business_id";
ALTER TABLE "restaurant_invites" RENAME COLUMN "restaurant_id" TO "business_id";
```

**Note:** Table names were NOT renamed (e.g. `restaurants` table stays `restaurants`). Prisma `@@map` annotations handle the mapping. This avoids breaking Supabase RLS policies or storage bucket references.

### Schema changes

**File:** `prisma/schema.prisma`

| Change | Before | After |
|---|---|---|
| Model names | `Restaurant`, `UserRestaurant`, `RestaurantInvite` | `Business`, `UserBusiness`, `BusinessInvite` |
| Enum names | `RestaurantRole`, `RestaurantInviteStatus` | `BusinessRole` (@@map "RestaurantRole"), `BusinessInviteStatus` (@@map "RestaurantInviteStatus") |
| Field on 13 models | `restaurant_id` | `business_id` |
| Relation fields | `restaurant Restaurant` | `business Business` |
| Unique constraints | `[restaurant_id, name]` etc. | `[business_id, name]` etc. |
| Compound keys | `@@id([user_id, restaurant_id])` | `@@id([user_id, business_id])` |

### Backend files changed

| File | What changed |
|---|---|
| `lib/auth/tenant.ts` | `ensureRestaurantForUser()` -> `ensureBusinessForUser()`, `requireRestaurantId()` -> `requireBusinessId()`, `requireRestaurantMembership()` -> `requireBusinessMembership()`, `RestaurantRole` -> `BusinessRole`, all Prisma calls updated |
| `lib/matching/engine.ts` | `restaurantId` param -> `businessId`, all `restaurant_id:` -> `business_id:` in Prisma queries |
| `app/actions/shopping.ts` | ~51 occurrences: all `restaurantId` -> `businessId`, all `restaurant_id:` -> `business_id:`, `restaurant_id_source_external_id` -> `business_id_source_external_id` |
| `app/actions/staff.ts` | ~24 occurrences: `requireRestaurantMembership` -> `requireBusinessMembership`, `prisma.userRestaurant` -> `prisma.userBusiness`, `prisma.restaurantInvite` -> `prisma.businessInvite`, `RestaurantRole` -> `BusinessRole`, `user_id_restaurant_id` -> `user_id_business_id` |
| `app/actions/inventory.ts` | ~20 occurrences: standard pattern |
| `app/actions/transactions.ts` | ~17 occurrences: standard pattern |
| `app/actions/receipts.ts` | ~16 occurrences: includes nested `receipt: { business_id }` filters |
| `app/actions/financial.ts` | ~12 occurrences: `prisma.restaurant` -> `prisma.business`, `restaurantName` -> `businessName`, `"My Restaurant"` -> `"My Business"`, `restaurant_id_source_external_id` -> `business_id_source_external_id` |
| `app/actions/contacts.ts` | ~10 occurrences: standard pattern |
| `app/actions/categories.ts` | ~8 occurrences: standard pattern |
| `app/actions/auth.ts` | `ensureRestaurantForUser` -> `ensureBusinessForUser`, `restaurant_name` field -> `business_name` |
| `app/actions/upload.ts` | ~2 occurrences: standard pattern |

**Standard pattern:** `import { requireRestaurantId }` -> `import { requireBusinessId }`, `const restaurantId = await requireRestaurantId()` -> `const businessId = await requireBusinessId()`, all `restaurant_id: restaurantId` -> `business_id: businessId` in Prisma where/data clauses.

### Frontend files changed

| File | What changed |
|---|---|
| `app/page.tsx` | Interface field `restaurantName` -> `businessName`, header label "Restaurant" -> "Business" |
| `app/layout.tsx` | Metadata description: "restaurant operations" -> "business operations" |
| `app/auth/signup/page.tsx` | "Create your restaurant account" -> "Create your account", "Restaurant name" -> "Business name", field `restaurant_name` -> `business_name` |
| `app/auth/accept-invite/page.tsx` | "Restaurant invite" -> "Team invite", `invite.restaurant?.name` -> `invite.business?.name`, "this restaurant" -> "this business" |

### Verification

- `npx prisma generate` -- generated successfully
- `npx tsc --noEmit` -- zero type errors
- `npx next build` -- all 17 routes compiled, zero errors
- `npx prisma migrate deploy` -- migration applied to production database

---

## Phase 2 -- Core vs Module Separation

**Status:** NOT STARTED
**Database changes:** None
**Risk level:** Low (pure code reorganization)

### Goal

Restructure the codebase into a core engine and optional modules. This is a prerequisite for Phase 3 (module toggling) but can be skipped if you want to jump straight to Phase 3 and just add the module guard layer on top of the flat structure.

### 2.1 Define module boundaries

**Core Engine** (always present for any business type):
- Auth/tenant (`lib/auth/`)
- Inventory CRUD (`app/actions/inventory.ts`)
- Categories & Suppliers (`app/actions/categories.ts`)
- Transactions (`app/actions/transactions.ts`)
- Financial ledger (`app/actions/financial.ts`)
- Staff & Invites (`app/actions/staff.ts`)
- Contacts (`app/actions/contacts.ts`)
- Matching engine (`lib/matching/`)
- Parsers (`lib/parsers/`)
- Utils (`lib/utils/`)
- Ingestion (`app/actions/ingestion.ts`)
- Upload (`app/actions/upload.ts`)

**Optional Modules:**
- `shopping` -- ShoppingSession, ShoppingSessionItem, ItemPriceHistory, shelf label scanning
- `receipts` -- Receipt, ReceiptLineItem, OCR pipeline (TabScanner + Google Vision)
- `integrations` -- GoDaddy POS, Uber Eats, DoorDash sync

### 2.2 Target folder restructuring

Move files from their current flat locations into nested `core/` and `modules/` directories:

```
lib/
  core/                           # NEW directory
    auth/tenant.ts, server.ts     # MOVED from lib/auth/
    matching/engine.ts, fuzzy.ts, confidence.ts  # MOVED from lib/matching/
    parsers/product-name.ts, shelf-label.ts, receipt.ts  # MOVED from lib/parsers/
    types/database.ts             # MOVED from lib/types/
    types/module.ts               # NEW — ModuleDefinition interface
    utils/serialize.ts, compress-image.ts  # MOVED from lib/utils/
    prisma.ts                     # MOVED from lib/prisma.ts
  modules/                        # NEW directory
    shopping/
      index.ts                    # NEW — ModuleDefinition export
    receipts/
      index.ts                    # NEW — ModuleDefinition export
      ocr/tabscanner.ts           # MOVED from lib/ocr/tabscanner.ts
      ocr/google-vision.ts        # MOVED from lib/ocr/google-vision.ts
    integrations/
      index.ts                    # NEW — ModuleDefinition export
      types.ts                    # MOVED from lib/integrations/types.ts
      godaddy-pos.ts              # MOVED from lib/integrations/
      uber-eats.ts                # MOVED
      doordash.ts                 # MOVED
  google/places.ts                # Stays (external API, not core or module)

app/actions/
  core/                           # NEW directory
    auth.ts                       # MOVED from app/actions/auth.ts
    categories.ts                 # MOVED
    contacts.ts                   # MOVED
    financial.ts                  # MOVED
    ingestion.ts                  # MOVED
    inventory.ts                  # MOVED
    staff.ts                      # MOVED
    transactions.ts               # MOVED
    upload.ts                     # MOVED
  modules/                        # NEW directory
    shopping.ts                   # MOVED from app/actions/shopping.ts
    receipts.ts                   # MOVED from app/actions/receipts.ts
    ocr.ts                        # MOVED from app/actions/ocr.ts
```

### 2.3 Create ModuleDefinition interface

**New file:** `lib/core/types/module.ts`

```typescript
export interface ModuleDefinition {
  id: string;              // "shopping", "receipts", "integrations"
  name: string;            // Human-readable name
  description: string;
  navItems?: {
    href: string;
    label: string;
    icon: string;          // Icon component name or SVG path
    position: number;      // Sort order in nav
  }[];
  dependencies?: string[]; // Other module IDs this depends on
}
```

**New files** exporting a `ModuleDefinition`:
- `lib/modules/shopping/index.ts`
- `lib/modules/receipts/index.ts`
- `lib/modules/integrations/index.ts`

### 2.4 Update all imports (~25+ files)

After moving files, every import path that references the old locations must be updated. Add path aliases to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./lib/*", "./*"],
      "@/core/*": ["./lib/core/*"],
      "@/modules/*": ["./lib/modules/*"]
    }
  }
}
```

All page components, server actions, and lib files that import from moved locations must be updated.

### 2.5 Verification

```bash
npx tsc --noEmit   # Must pass with zero errors
npx next build     # Must compile all routes
```

No functional changes. Every feature must work identically before and after.

### Notes for the implementer

- This phase is optional. If you want to skip it, Phase 3 can be built on top of the current flat folder structure. You would just create the new files (module guard, registry, etc.) alongside the existing flat structure.
- If you do Phase 2, use your IDE's "Move File" refactoring feature to auto-update imports, then verify with `tsc`.
- The `lib/generated/prisma/` directory must NOT be moved — it's output from `prisma generate` and referenced in `prisma/schema.prisma`.

---

## Phase 3 -- Capability Flag System

**Status:** NOT STARTED
**Database changes:** 1 new enum, 1 new column, 1 new table, 1 backfill
**Risk level:** Medium
**Depends on:** Phase 1 (complete). Phase 2 is optional.

### Goal

Add per-business module enablement. Each business can have different modules turned on/off. This is the foundation for selling different tiers or letting businesses customize their feature set.

### 3.1 Schema additions

Add to `prisma/schema.prisma`:

```prisma
enum IndustryType {
  restaurant
  salon
  retail
  contractor
  general
}

// Add these two fields to the existing Business model:
//   industry_type  IndustryType @default(general)
//   modules        BusinessModule[]

model BusinessModule {
  id          String   @id @default(uuid())
  business_id String
  module_id   String   // "shopping", "receipts", "integrations"
  enabled     Boolean  @default(true)
  config      Json?    // Optional per-module config (future use)
  created_at  DateTime @default(now())
  business    Business @relation(fields: [business_id], references: [id], onDelete: Cascade)

  @@unique([business_id, module_id])
  @@index([business_id])
  @@map("business_modules")
}
```

### 3.2 Migration SQL

**IMPORTANT:** Use `prisma migrate dev --create-only` to generate the migration file, then **review and edit** the SQL before applying. Prisma should handle this one correctly since it's purely additive (new enum, new column, new table), but always verify.

After Prisma generates, **manually add the backfill** at the bottom:

```sql
-- Backfill: give all existing businesses all modules enabled
INSERT INTO "business_modules" (id, business_id, module_id, enabled, created_at)
  SELECT
    gen_random_uuid(),
    b.id,
    m.module_id,
    true,
    now()
  FROM "restaurants" b  -- Note: table is still named "restaurants" due to @@map
  CROSS JOIN (VALUES ('shopping'), ('receipts'), ('integrations')) AS m(module_id);
```

This ensures existing businesses lose no functionality.

### 3.3 Create module guard functions

**New file:** `lib/auth/modules.ts` (or `lib/core/modules/guard.ts` if Phase 2 was done)

```typescript
import { prisma } from "@/lib/prisma";
import { requireBusinessId } from "@/lib/auth/tenant";

/**
 * Throws if the given module is not enabled for the current business.
 * Call at the top of any server action that belongs to an optional module.
 */
export async function requireModule(moduleId: string): Promise<void> {
  const businessId = await requireBusinessId();
  const mod = await prisma.businessModule.findUnique({
    where: { business_id_module_id: { business_id: businessId, module_id: moduleId } },
    select: { enabled: true },
  });
  if (!mod?.enabled) {
    throw new Error(`Module "${moduleId}" is not enabled for this business`);
  }
}

/**
 * Returns the list of enabled module IDs for the current business.
 */
export async function getEnabledModules(): Promise<string[]> {
  const businessId = await requireBusinessId();
  const modules = await prisma.businessModule.findMany({
    where: { business_id: businessId, enabled: true },
    select: { module_id: true },
  });
  return modules.map((m) => m.module_id);
}

/**
 * Boolean check — does the current business have this module enabled?
 */
export async function isModuleEnabled(moduleId: string): Promise<boolean> {
  const businessId = await requireBusinessId();
  const mod = await prisma.businessModule.findUnique({
    where: { business_id_module_id: { business_id: businessId, module_id: moduleId } },
    select: { enabled: true },
  });
  return mod?.enabled ?? false;
}
```

**Performance note:** Each `requireModule()` call hits the database. For production, consider caching enabled modules per-request (e.g. in a `Map` stored on the request context) or using a short-TTL cache.

### 3.4 Add guards to module server actions

Add `await requireModule("shopping")` at the top of every exported function in `app/actions/shopping.ts`. These are the functions to guard:

- `startShoppingSession`
- `getActiveShoppingSession`
- `getShoppingSession`
- `addShoppingSessionItem`
- `updateShoppingSessionItem`
- `removeShoppingSessionItem`
- `reconcileShoppingSessionReceipt`
- `scanAndReconcileReceipt`
- `resolveShoppingSessionItem`
- `commitShoppingSession`
- `getItemPriceHistory`
- `scanShelfLabel`
- `addShelfLabelItem`
- `getCommittedShoppingSessions`
- `reorderShoppingSession`

Add `await requireModule("receipts")` to receipt-specific functions in `app/actions/receipts.ts`:

- `createReceipt`
- `parseAndMatchReceipt`
- `processReceiptText`
- `processReceiptImage`
- `getReceiptWithLineItems`
- `getReceipts`

### 3.5 Module registry

**New file:** `lib/modules/registry.ts`

A central map of all available module definitions:

```typescript
import type { ModuleDefinition } from "@/lib/types/module"; // or wherever it lives

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  shopping: {
    id: "shopping",
    name: "Shopping",
    description: "Shopping sessions, shelf label scanning, receipt reconciliation",
    navItems: [
      { href: "/shopping", label: "Shopping", icon: "ShoppingCart", position: 3 },
    ],
  },
  receipts: {
    id: "receipts",
    name: "Receipts",
    description: "Receipt scanning, OCR, and line item matching",
    navItems: [
      { href: "/receive", label: "Receive", icon: "Inbox", position: 2 },
    ],
  },
  integrations: {
    id: "integrations",
    name: "Integrations",
    description: "GoDaddy POS, Uber Eats, DoorDash revenue sync",
    navItems: [],
  },
};
```

### 3.6 Dynamic navigation

**File:** `components/nav/bottom-nav.tsx`

Currently the bottom nav has hardcoded tabs. Change it to:

1. Accept an `enabledModules: string[]` prop
2. Always show core tabs (Home, Inventory, Staff)
3. Conditionally show module tabs (Shopping, Receive) based on `enabledModules`

**File:** `app/(dashboard)/layout.tsx`

Call `getEnabledModules()` server-side and pass the result to `<BottomNav>`.

### 3.7 Route-level protection

**New file:** `app/(dashboard)/shopping/layout.tsx`

```typescript
import { redirect } from "next/navigation";
import { isModuleEnabled } from "@/lib/auth/modules";

export default async function ShoppingLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isModuleEnabled("shopping");
  if (!enabled) redirect("/");
  return <>{children}</>;
}
```

Create similar layouts for other module routes as needed.

### 3.8 Module management actions

**New file:** `app/actions/modules.ts`

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireBusinessMembership, requireRole } from "@/lib/auth/tenant";
import { serialize } from "@/lib/utils/serialize";

export async function enableModule(moduleId: string) {
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);
  // upsert to handle both new and existing records
  const mod = await prisma.businessModule.upsert({
    where: { business_id_module_id: { business_id: business.id, module_id: moduleId } },
    create: { business_id: business.id, module_id: moduleId, enabled: true },
    update: { enabled: true },
  });
  return serialize(mod);
}

export async function disableModule(moduleId: string) {
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);
  const mod = await prisma.businessModule.upsert({
    where: { business_id_module_id: { business_id: business.id, module_id: moduleId } },
    create: { business_id: business.id, module_id: moduleId, enabled: false },
    update: { enabled: false },
  });
  return serialize(mod);
}

export async function getBusinessModules() {
  const { business } = await requireBusinessMembership();
  const modules = await prisma.businessModule.findMany({
    where: { business_id: business.id },
    orderBy: { module_id: "asc" },
  });
  return serialize(modules);
}
```

### 3.9 Verification checklist

- [ ] `npx prisma generate` succeeds
- [ ] `npx tsc --noEmit` passes
- [ ] `npx next build` passes
- [ ] Migration deployed with backfill (all existing businesses get all modules enabled)
- [ ] Disable shopping module for a test business -> Shopping tab disappears from nav
- [ ] Navigate to `/shopping` with module disabled -> redirects to `/`
- [ ] Call `startShoppingSession()` with module disabled -> throws error
- [ ] Re-enable module -> everything works again
- [ ] All existing businesses unaffected (backfill gave them all modules)

---

## Phase 4 -- Industry Preset Layer

**Status:** NOT STARTED
**Database changes:** None (uses `industry_type` column from Phase 3)
**Risk level:** Low
**Depends on:** Phase 3

### Goal

Industry presets are configuration bundles. When a user signs up and picks "Salon" instead of "Restaurant", they get salon-appropriate module defaults, categories, terminology, and dashboard KPIs. No conditionals in the codebase -- purely data-driven.

### 4.1 Terminology abstraction

**New file:** `lib/config/terminology.ts`

A data map keyed by `IndustryType`. Components call `useTerm("supplier")` and get back "Vendor" for salons, "Supplier" for restaurants, etc.

```typescript
import type { IndustryType } from "@/lib/generated/prisma/client";

type TermKey =
  | "business"
  | "item"
  | "supplier"
  | "shopping"
  | "receive"
  | "moneyIn"
  | "moneyOut"
  | "category";

const TERMINOLOGY: Record<IndustryType, Record<TermKey, string>> = {
  restaurant: {
    business: "Restaurant",
    item: "Item",
    supplier: "Supplier",
    shopping: "Shopping",
    receive: "Receive",
    moneyIn: "Revenue",
    moneyOut: "Expenses",
    category: "Category",
  },
  salon: {
    business: "Salon",
    item: "Product",
    supplier: "Vendor",
    shopping: "Ordering",
    receive: "Check In",
    moneyIn: "Income",
    moneyOut: "Costs",
    category: "Category",
  },
  retail: {
    business: "Store",
    item: "Product",
    supplier: "Vendor",
    shopping: "Purchasing",
    receive: "Intake",
    moneyIn: "Sales",
    moneyOut: "Costs",
    category: "Department",
  },
  contractor: {
    business: "Company",
    item: "Material",
    supplier: "Provider",
    shopping: "Procurement",
    receive: "Log Delivery",
    moneyIn: "Revenue",
    moneyOut: "Expenses",
    category: "Category",
  },
  general: {
    business: "Business",
    item: "Item",
    supplier: "Supplier",
    shopping: "Shopping",
    receive: "Receive",
    moneyIn: "Income",
    moneyOut: "Expenses",
    category: "Category",
  },
};

export function getTerminology(industryType: IndustryType) {
  return TERMINOLOGY[industryType] ?? TERMINOLOGY.general;
}

export function getTerm(industryType: IndustryType, key: TermKey): string {
  return TERMINOLOGY[industryType]?.[key] ?? TERMINOLOGY.general[key];
}
```

### 4.2 Industry presets

**New file:** `lib/config/presets.ts`

Each preset defines what a new business of that industry type gets on signup:

```typescript
import type { IndustryType } from "@/lib/generated/prisma/client";

export interface IndustryPreset {
  defaultModules: string[];
  defaultCategories: string[];
  preferredUnits: string[];
  relevantSources: string[];
}

export const INDUSTRY_PRESETS: Record<IndustryType, IndustryPreset> = {
  restaurant: {
    defaultModules: ["shopping", "receipts", "integrations"],
    defaultCategories: ["Produce", "Meat & Seafood", "Dairy", "Dry Goods", "Beverages", "Cleaning"],
    preferredUnits: ["kg", "lb", "each", "case_unit", "box", "dozen"],
    relevantSources: ["godaddy_pos", "uber_eats", "doordash", "shopping", "manual"],
  },
  salon: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["Hair Care", "Skin Care", "Nails", "Tools", "Cleaning"],
    preferredUnits: ["each", "box", "pack", "ml", "l"],
    relevantSources: ["shopping", "manual"],
  },
  retail: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["Electronics", "Clothing", "Home", "Food", "Health"],
    preferredUnits: ["each", "case_unit", "box", "pack", "dozen"],
    relevantSources: ["shopping", "manual"],
  },
  contractor: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["Lumber", "Hardware", "Electrical", "Plumbing", "Paint", "Tools"],
    preferredUnits: ["each", "box", "bag", "lb", "kg"],
    relevantSources: ["shopping", "manual"],
  },
  general: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["General"],
    preferredUnits: ["each", "box", "pack"],
    relevantSources: ["shopping", "manual"],
  },
};
```

### 4.3 Business config React context

**New file:** `lib/config/context.tsx`

```typescript
"use client";

import { createContext, useContext } from "react";
import type { IndustryType } from "@/lib/generated/prisma/client";

interface BusinessConfig {
  industryType: IndustryType;
  enabledModules: string[];
  terminology: Record<string, string>;
}

const BusinessConfigContext = createContext<BusinessConfig>({
  industryType: "general",
  enabledModules: [],
  terminology: {},
});

export function BusinessConfigProvider({
  config,
  children,
}: {
  config: BusinessConfig;
  children: React.ReactNode;
}) {
  return (
    <BusinessConfigContext.Provider value={config}>
      {children}
    </BusinessConfigContext.Provider>
  );
}

export function useBusinessConfig() {
  return useContext(BusinessConfigContext);
}

export function useTerm(key: string): string {
  const { terminology } = useContext(BusinessConfigContext);
  return terminology[key] ?? key;
}
```

### 4.4 Wire up the dashboard layout

**File:** `app/(dashboard)/layout.tsx`

Server-side: fetch the business's `industry_type` and enabled modules, look up terminology, pass to `<BusinessConfigProvider>`.

```typescript
import { getTerminology } from "@/lib/config/terminology";
import { BusinessConfigProvider } from "@/lib/config/context";
// ... existing imports

export default async function DashboardLayout({ children }) {
  const business = await getCurrentBusiness(); // however you fetch it
  const enabledModules = await getEnabledModules();
  const terminology = getTerminology(business.industry_type);

  return (
    <BusinessConfigProvider config={{
      industryType: business.industry_type,
      enabledModules,
      terminology,
    }}>
      {children}
    </BusinessConfigProvider>
  );
}
```

### 4.5 Update signup flow

**File:** `app/auth/signup/page.tsx`

Add an industry type selector (radio buttons or dropdown) with options: Restaurant, Salon, Store, Contractor, Other.

**File:** `app/actions/auth.ts`

In `signUpAction`:
1. Read `industry_type` from form data (default to `"general"`)
2. Pass it to `ensureBusinessForUser()` (update that function to accept and store `industry_type`)
3. After creating the business, seed default modules and categories from the preset

```typescript
import { INDUSTRY_PRESETS } from "@/lib/config/presets";

// Inside signUpAction, after ensureBusinessForUser:
const preset = INDUSTRY_PRESETS[industryType] ?? INDUSTRY_PRESETS.general;

// Seed modules
await Promise.all(
  preset.defaultModules.map((moduleId) =>
    prisma.businessModule.create({
      data: { business_id: business.id, module_id: moduleId, enabled: true },
    })
  )
);

// Seed categories
await Promise.all(
  preset.defaultCategories.map((name) =>
    prisma.category.create({
      data: { business_id: business.id, name },
    })
  )
);
```

### 4.6 Replace hardcoded labels with `useTerm()`

Go through all frontend files and replace hardcoded strings:

| Current | Replace with |
|---|---|
| `"Business"` (header label in `app/page.tsx`) | `useTerm("business")` |
| `"Shopping"` (nav label) | `useTerm("shopping")` |
| `"Receive"` (nav label) | `useTerm("receive")` |
| `"Suppliers"` (contacts description) | `useTerm("supplier") + "s"` |
| etc. | etc. |

### 4.7 Verification checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npx next build` passes
- [ ] Sign up as "Restaurant" -> gets restaurant categories, all modules, "Supplier" terminology
- [ ] Sign up as "Salon" -> gets salon categories, shopping+receipts modules, "Vendor" terminology
- [ ] Dashboard header shows "Salon" instead of "Business" for salon businesses
- [ ] Nav labels adapt to industry type
- [ ] Existing businesses unaffected (default to `restaurant` industry type from Phase 3 migration)

---

## Risk Assessment

| Risk | Phase | Severity | Mitigation |
|---|---|---|---|
| Prisma auto-generates DROP + CREATE instead of RENAME | 1 | **CRITICAL** | Always `--create-only`, hand-write rename SQL. **Already mitigated -- Phase 1 is done.** |
| Missed `restaurant_id` reference causes runtime error | 1 | Medium | TypeScript compiler catches all. `grep -r "restaurant_id" --include="*.ts"` finds stragglers. **Already mitigated -- Phase 1 verified clean.** |
| Import path changes break builds after folder move | 2 | Low | `npx tsc --noEmit` catches everything. No runtime changes. |
| Module guard adds DB query per server action call | 3 | Medium | Cache enabled modules per-request, or use short-TTL in-memory cache. |
| Backfill migration misses existing businesses | 3 | Medium | Run `SELECT count(*) FROM restaurants` before and after to verify row count. |
| Terminology key missing for an industry type | 4 | Low | Fallback to `general` terminology for any missing key. |
| Signup preset fails to seed categories/modules | 4 | Low | Wrap in try-catch, log errors, don't block signup. |

---

## Phase Summary Table

| Phase | Status | DB Migration | Files Modified | Files Created | Complexity |
|---|---|---|---|---|---|
| 1 - Identity Refactor | **COMPLETE** | 1 (column renames) | ~20 | 0 | Large |
| 2 - Module Separation | Not started | 0 | ~25 (import paths) | ~5 | Medium |
| 3 - Capability Flags | Not started | 1 (new table + enum) | ~8 | ~5 | Medium |
| 4 - Industry Presets | Not started | 0 | ~5 | ~4 | Medium |

**Execution order:** Phase 1 -> Phase 2 (optional) -> Phase 3 -> Phase 4. Each phase should pass full build verification before moving to the next.
