# Inventory Intake Plan

Last updated: February 25, 2026

## How To Use This Plan

This is a living handoff + execution document. Update it as you work.

Rules for every change made from this plan:

1. After completing a step or instruction, update the matching line in this file with a status (`[x]` completed, `[~]` partial, `[ ]` not started).
2. Add any problems, blockers, or unexpected behavior under that step/phase so the next engineer can continue without re-discovering issues.
3. Update the `Latest Update` section after each meaningful change with what was done, what remains, and any important caveats.
4. Keep the `Pick Up Here (Next Continuation)` section current so it always points to the next concrete task.
5. Do not erase useful historical notes; append short progress notes instead.

Recommended progress note format (short and repeatable):

- `Status:` `[x]` / `[~]` / `[ ]`
- `Changed:` files/modules touched
- `Issues:` blockers, lint/test failures, migration status, behavior risks
- `Next:` exact next step

## Latest Update

- **Shopping quick-shop barcode loop added (internal-only lookup; deferred fallback)** (February 25, 2026):
  - Added `addShoppingSessionItemByBarcodeQuick(...)` to `app/actions/modules/shopping.ts` for in-session barcode adds during Shopping Mode.
  - Quick-shop barcode behavior now:
    - normalizes UPC/EAN
    - performs **internal tenant DB lookup only** (no external provider/web fallback during active shopping)
    - immediately saves a staged shopping cart item
    - returns resolved vs provisional status for UI feedback
  - Added Shopping UI quick-scan flow to `app/(dashboard)/shopping/page.tsx`:
    - scan/type UPC/EAN input with Enter-to-scan
    - `Scan & Save` loop for repeated scans (`scan -> save -> next scan`)
    - visible `Conclude Quick Shop` button that jumps the user to the receipt scan phase
    - immediate feedback card showing resolved item name or provisional unresolved item
  - Added provisional unresolved item display support in shopping UI:
    - unresolved quick scans are labeled as `Unresolved Item`
    - scanned UPC is surfaced on the cart row badge for local shopping context
  - Authoritative-phase UX copy now explicitly marks receipt scan as the final matching/deferred fallback phase.
  - Important limitation (temporary):
    - unresolved quick-scan UPCs are currently persisted via a provisional shopping item label suffix (`[UPC:...]`) for local session visibility only
    - a dedicated structured `shopping_session_items` barcode field is still recommended for clean authoritative-phase UPC reuse
  - Validation:
    - Code changes applied; typecheck/runtime verification still pending
  - Next:
    - add structured shopping-session UPC persistence (schema field) and use it in post-receipt authoritative reconciliation
    - implement constrained web query fallback only in the post-receipt low-confidence path (not during live shopping)

- **Phase C -- store receipt line-code alias learning added (place-scoped)** (February 25, 2026):
  - Added extraction of likely store line codes from receipt line text (example: `5523795 TERRA DATES $9.49` -> `5523795`) in `lib/core/matching/receipt-line-core.ts`.
  - Receipt line resolution now checks a place-scoped code alias before the existing place-scoped text alias and fuzzy fallback.
  - `learnReceiptItemAlias(...)` now saves both:
    - the normalized receipt text alias
    - the extracted store line code alias (when present and distinct)
  - This reuses the existing `ReceiptItemAlias` table (no new migration required) while improving future exact matches for stores that print stable item codes.
  - Validation:
    - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -- 10/10 pass
    - `npx tsc --noEmit` -- 0 errors

- **Shopping receipt reconciliation hardening -- incomplete scans are now rescan-only** (February 25, 2026):
  - Tightened shopping receipt commit gating in `app/actions/modules/shopping.ts`:
    - sessions with scanned receipts must be fully `ready` to commit
    - incomplete scanned receipts now return a rescan-required error (`"Receipt scan is not 100% complete..."`)
    - commit still blocks on subtotal/total mismatch against scanned receipt totals
  - Disabled manual mismatch resolution for scanned receipts that are not fully reconciled:
    - `resolveShoppingSessionItem(...)` now rejects and instructs the user to rescan
    - shopping UI replaces `Keep Staged / Use Receipt / Skip` buttons with a `Rescan Receipt` prompt when the scanned receipt is incomplete
  - Receipt viewer title now prefers the shopping session's Google Places store name over OCR establishment text:
    - `getReceiptDetail(...)` includes `shopping_session.store_name`
    - `app/(dashboard)/receive/receipt/[id]/page.tsx` uses that preferred store name for header + digital receipt title
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Notes:
    - This enforces rescan-first behavior for incomplete shopping receipt scans and prevents commit/manual discrepancy resolution from papering over missed OCR lines.

- **Phase C -- receipt alias resolver hardened + targeted core tests added** (February 25, 2026):
  - Extracted pure receipt-line core helpers into `lib/core/matching/receipt-line-core.ts` so place-scoped alias behavior can be tested without Prisma/Next runtime wiring.
  - Refactored `lib/core/matching/receipt-line.ts` to use the shared core helpers for:
    - place-scoped alias lookup query-building
    - alias upsert payload-building
    - alias-first -> fuzzy fallback resolution status mapping (`receipt` vs `shopping`)
  - Added targeted `node:test` coverage in `lib/core/matching/receipt-line-core.test.mjs` for:
    - alias normalization and place-scoped lookup/upsert payload generation
    - alias precedence over fuzzy matching
    - profile-specific handling of medium-confidence matches (`receipt => suggested`, `shopping => unresolved`)
    - unresolved fallback when no matches exist
  - Validation:
    - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -- 7/7 pass
  - Notes:
    - Runtime/UI verification is still pending (receipt review + shopping reconciliation flows).

- **Infrastructure cleanup -- physical DB naming now matches business model** (February 25, 2026):
  - Applied migration `20260225200000_rename_legacy_restaurant_tables_to_business` to rename legacy database objects:
    - tables: `restaurants` -> `businesses`, `user_restaurants` -> `user_businesses`, `restaurant_invites` -> `business_invites`
    - enums: `RestaurantRole` -> `BusinessRole`, `RestaurantInviteStatus` -> `BusinessInviteStatus`
  - Updated Prisma schema mappings so `Business`, `UserBusiness`, and `BusinessInvite` point to the new physical table names.
  - Validation:
    - `npx prisma migrate deploy` -- succeeds
    - `npx prisma generate` -- succeeds
    - `npx prisma migrate status` -- database schema is up to date
    - `npx tsc --noEmit` -- 0 errors
  - Notes:
    - This is a naming/alignment cleanup only (no phase scope change).
    - Restart the local Next.js dev server if it was running before `prisma generate` so the in-memory Prisma client picks up the renamed DB objects.

- **Phase C -- place-scoped receipt aliasing (partial implementation)** (February 25, 2026):
  - Added additive Prisma model for `ReceiptItemAlias` in `prisma/schema.prisma` with:
    - `business_id`, `google_place_id`, normalized `alias_text`, `inventory_item_id`, `confidence`, `created_at`
    - unique constraint on `(business_id, google_place_id, alias_text)`
  - Added SQL migration `prisma/migrations/20260225180000_receipt_item_aliases_phase_c/migration.sql` and applied it to the configured PostgreSQL database with `npx prisma migrate deploy`.
  - Ran `npx prisma generate`; generated client now includes `receiptItemAlias` delegate.
  - Updated `lib/core/matching/receipt-line.ts`:
    - exact place-scoped alias lookup runs before fuzzy matching
    - falls back to existing `matchText(...)` pipeline
    - unresolved behavior preserved
    - added `learnReceiptItemAlias(...)` helper (fail-open until Prisma client/migration are applied)
  - Wired `google_place_id` into receipt line resolution in:
    - `app/actions/modules/receipts.ts` (receipt parse + TabScanner receipt image flow)
    - `app/actions/modules/shopping.ts` (shopping receipt reconciliation flows)
  - Added place-scoped alias learning on user confirmation paths:
    - `updateLineItemMatch(...)` in receipts module
    - `resolveShoppingSessionItem(...)` in shopping module when a receipt-linked line is resolved
  - Added explicit receipt commit idempotency guard in `commitReceiptTransactions(...)`:
    - checks `receipt.status === "committed"` before processing and returns existing transactions only when the requested line set is already committed
  - Validation:
    - `npx prisma validate --schema prisma/schema.prisma` -- succeeds
    - `npx prisma migrate status` -- database schema is up to date
    - `npx tsc --noEmit` -- 0 errors
  - Remaining Phase C work:
    - runtime verification in receipt + shopping UI flows (confirm alias is learned, then auto-resolves on next receipt from same `google_place_id`)
    - add/execute targeted tests for place-scoped alias matching/learning if desired
    - restart local Next.js dev server if it was already running before `prisma generate` (to refresh in-memory Prisma client)

- **Phase B -- external barcode provider integrations complete** (February 25, 2026):
  - Implemented all four external provider adapters with real API calls:
    - **Open Food Facts** (`open-food-facts.ts`): Calls OFF API v2, extracts product_name, brands, quantity, categories, image_front_url. No auth required.
    - **Open Beauty Facts** (`open-beauty-facts.ts`): Same API shape as OFF, different domain. No auth required.
    - **UPCDatabase** (`upcdatabase.ts`): Calls `api.upcdatabase.org/product/{barcode}` with `Authorization: Bearer` token from `UPCDATABASE_API_KEY` env var. Returns `no_api_key` error gracefully when env var is not set.
    - **UPCitemdb** (`upcitemdb.ts`): Uses free trial endpoint `/prod/trial/lookup?upc=`. Includes in-memory daily throttle (95/day with 5-request buffer under 100/day limit).
  - Introduced `ExternalProductMetadata` type and `hit_external` outcome for external providers (product found in external DB but not in tenant inventory).
  - Introduced `resolved_external` result variant in `BarcodeResolutionResult` so consumers can distinguish internal inventory matches from external product discoveries.
  - Updated `resolver-core.ts` with `hit_external` handling, `upsertResolvedExternalGlobalBarcodeCatalog` callback, and `buildExternalHitSnapshot` for event metadata.
  - Updated `barcode-resolver-cache.ts` with `buildResolvedExternalGlobalBarcodeCatalogUpsertArgs` -- populates `canonical_title`, `brand`, `size_text`, `category_hint`, `image_url` in the global catalog.
  - Enabled the fallback chain: `getBarcodeProviders()` now returns all 5 providers (internal + 4 external).
  - Added 4-second per-provider timeout (`AbortSignal.timeout(PROVIDER_TIMEOUT_MS)`).
  - Confidence scoring per plan: OFF/OBF with name+brand = `high`; UPCDatabase/UPCitemdb or incomplete fields = `medium`; unresolved = `none`.
  - Updated consumers:
    - `ingestion.ts` (`ingestByBarcode`): returns `external_match` error with metadata when `resolved_external`, so UI can offer item creation.
    - Barcode scan page (`receive/barcode/page.tsx`): added `external_found` step that shows product image, name, brand, size, category from external provider, then feeds into `ItemNotFound` with pre-filled suggested name.
    - `ItemNotFound` component: added optional `suggestedName` prop to pre-fill the new item name from external metadata.
  - Added 2 new resolver-core tests:
    - `hit_external` returns `resolved_external` with metadata, upserts external catalog, records 2 events (internal miss + external hit)
    - Fallback chain: error on first external provider falls through to next provider which returns `hit_external`
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
    - `node --test barcode-resolver-cache.test.mjs` -- 5/5 pass
    - `npx next build` -- succeeds
  - Next concrete task: **Phase C -- place-scoped receipt aliasing** or **runtime verification of external provider lookups**.

- Root cause of the Layer-0 cache/event persistence failure confirmed (February 25, 2026):
  - Ran direct Prisma write diagnostics against `global_barcode_catalog` and `barcode_resolution_events` -- **all writes succeed** when using the correct Prisma client instance and the exact same builder functions the resolver uses.
  - Confirmed the generated Prisma client exposes `globalBarcodeCatalog` and `barcodeResolutionEvent` delegates correctly.
  - The failure was exclusively caused by a **stale in-memory Prisma client** in the Next.js dev server. The previous agent ran `prisma generate` but did not restart the dev server, so the runtime's cached `PrismaClient` instance (in `globalForPrisma`) predated the schema additions. `getBarcodeCacheDelegates()` correctly returned `null` because the old instance didn't have the new model delegates.
  - **Resolution: no code bug. Restarting the dev server after `prisma generate` is all that is needed.** The code, builders, DB schema, and migration are all correct and functional.
- Improved delegate-unavailable logging: replaced one-shot `hasLoggedBarcodeCacheDelegatesUnavailable` flag with a counting approach that logs on the 1st occurrence and every 10th thereafter, making it harder to miss in the dev console.
- Expanded `BarcodeResolutionResult` return payload with a `confidence` field (`high` / `medium` / `low` / `none`):
  - Internal tenant lookups return `"high"` confidence on hit.
  - External providers (Phase B) will return `"medium"` by default, with per-provider tuning.
  - Unresolved results return `"none"`.
  - The `source` (provenance) field was already present; `confidence` completes the Phase A payload expansion.
- Validation (February 25, 2026):
  - `npx tsc --noEmit` -- 0 errors
  - `node --test --experimental-transform-types app\\actions\\core\\barcode-resolver-cache.test.mjs` -- 5/5 pass
  - `npx next build` -- succeeds
- Phase A is now **complete**. All items are done: resolver seam, cache/event integration, confidence + provenance in return payload, targeted test coverage, and DB migration applied.
- Next concrete task: **Phase B -- implement external provider integrations** (Open Food Facts, Open Beauty Facts, UPCDatabase, UPCitemdb).

Previous updates (retained for history):

- Static/runtime debugging of the Layer-0 cache persistence issue identified two likely causes and shipped a guard/fix on February 25, 2026:
  - `getBarcodeCacheDelegates()` could return `null` silently when the running Next.js dev server was still using an older in-memory Prisma client instance (for example after `prisma generate` without a server restart), which would disable cache/event writes with no log output
  - `buildBarcodeResolutionEventCreateArgs(...)` was sending `normalized_fields_snapshot: null` for miss/error events; Prisma nullable JSON fields may reject raw `null` in create payloads, so the builder now omits the field when no snapshot exists
- Added a one-time local-dev warning in `app/actions/core/barcode-resolver.ts` when cache delegates are unavailable, with an explicit restart hint for the Next.js server after Prisma client regeneration.
- Updated resolver cache helper tests for the event-payload change and revalidated targeted cache helper coverage.
- Validation (February 25, 2026):
  - `node --test --experimental-transform-types app\\actions\\core\\barcode-resolver-cache.test.mjs` ✅
  - `npx eslint app/actions/core/barcode-resolver.ts app/actions/core/barcode-resolver-cache.ts app/actions/core/barcode-resolver-cache.test.mjs` ✅
  - Running `app\\actions\\core\\barcode-resolver-core.test.mjs` directly with `node --test` still hits an existing local Node ESM extensionless-import resolution issue in this repo context (not caused by the cache payload patch)
- Next concrete task is now runtime re-verification after restarting the local Next.js server (to refresh the Prisma client in memory), then checking whether cache/event rows persist and whether any new resolver cache logs appear.
- Runtime app-flow verification was performed in the local UI on February 25, 2026:
  - barcode receive flow successfully linked barcodes to inventory items and subsequent barcode lookups resolved correctly via the existing tenant-scoped item lookup path
  - `item_barcodes` rows were confirmed in the dev DB after manual testing
- DB verification immediately after the app-flow check shows `global_barcode_catalog` and `barcode_resolution_events` are still empty (`0` rows each), so the new resolver cache/event persistence path is not currently writing records despite the lookup flow succeeding.
- Added local-dev cache-layer error logging in `app/actions/core/barcode-resolver.ts` (still fail-open) so hidden Prisma/cache write failures surface in the Next.js server console during the next barcode lookup.
- Important behavior clarification (confirmed by manual test): cross-account barcode matches do **not** resolve to another user/business inventory item today, which is expected under tenant isolation. The planned global barcode layer is for shared barcode knowledge/provenance, not cross-tenant inventory item reuse.
- Added targeted resolver cache/event metadata coverage for Layer-0 side effects (hit/miss/error) by extracting shared payload builders into `app/actions/core/barcode-resolver-cache.ts` and reusing them in `app/actions/core/barcode-resolver.ts`.
- Added `node:test` coverage in `app/actions/core/barcode-resolver-cache.test.mjs` for:
  - resolved cache upsert metadata reset
  - unresolved miss/error failure-count + retry-backoff updates
  - resolved-row preservation on later misses
  - event payload generation and hit snapshot fields
- Validation (February 25, 2026):
  - `node --test --experimental-transform-types app\\actions\\core\\barcode-resolver-cache.test.mjs` ✅
  - `npx eslint app/actions/core/barcode-resolver.ts app/actions/core/barcode-resolver-cache.ts app/actions/core/barcode-resolver-cache.test.ts` ✅
- Runtime app-flow verification of cache/event writes has started and exposed a persistence issue (rows not writing while lookup succeeds); capturing the hidden cache-layer error and fixing the Prisma write path is now the next concrete task before external providers.
- Added `How To Use This Plan` guidance at the top so engineers update statuses, issues, and the `Latest Update` section after each plan-driven change.
- Imported implementation progress from `docs/inventoryintakeplan.progress-handoff.md` (dated February 25, 2026).
- Latest completed change (from handoff): additive Prisma schema updates and a draft SQL migration for the global barcode cache/provenance prerequisite (`GlobalBarcodeCatalog` and `BarcodeResolutionEvent`), not applied yet.
- This document now includes a current status snapshot, exact pickup point, and a structured index.
- Implemented Layer-0 resolver cache integration in `app/actions/core/barcode-resolver.ts`:
  - reads `GlobalBarcodeCatalog` (when Prisma client + DB schema support it)
  - updates cache metadata for internal lookup `hit` / `miss` / `error`
  - writes `BarcodeResolutionEvent` records for internal outcomes
- Preserved current barcode UX behavior:
  - tenant-scoped `lookupBarcode(...)` remains the active match source
  - external providers remain disabled (`getBarcodeProviders()` still internal-only)
  - cache/event writes fail open (no-op) if Prisma client generation or DB migration is not yet applied
- Ran `npx prisma generate` and confirmed the generated Prisma client now includes `GlobalBarcodeCatalog`, `BarcodeResolutionEvent`, and the barcode cache/provenance enums.
- Applied `20260225133000_global_barcode_cache_prereq` to the configured PostgreSQL dev database on February 25, 2026 using `npx prisma migrate deploy`; follow-up `npx prisma migrate status` reports the schema is up to date.
- Next immediate follow-up: validate resolver cache/event writes in app flow (or targeted tests) and add resolver coverage for cache/event side effects.

## Current Status

- [x] Phase 0 (mandatory audit) completed and documented in `docs/inventoryintakeplan.phase0-audit.md`.
- [x] Phase A (safe internal layer) complete. Resolver seam, cache/event integration, confidence + provenance in return payload, targeted test coverage, DB migration applied, and runtime verified.
- [x] Phase B (external provider integrations) complete. All four providers (OFF, OBF, UPCDatabase, UPCitemdb) implemented with real API calls, fallback chain enabled, 4s timeouts, confidence scoring, `resolved_external` result type, UI support in barcode page, and 7 total resolver tests passing.
- [~] Phase C (place-scoped receipt aliasing) partially implemented in code; migration apply/generate + verification still pending.
- [ ] Phase D (enrichment queue) not started.
- [ ] Phase E (observability/hardening) not started.

## Pick Up Here (Next Continuation)

Primary continuation task: **Phase C -- runtime verification of place-scoped receipt aliasing**.

Phases A and B are complete. The barcode resolver supports internal inventory lookups and 4 external providers (OFF, OBF, UPCDatabase, UPCitemdb) with fallback chain, timeouts, confidence scoring, and global barcode catalog caching.

Do this next:

1. `[x]` Add `ReceiptItemAlias` model to Prisma schema (done).
2. `[x]` Create and apply the migration:
   - SQL migration file created: `prisma/migrations/20260225180000_receipt_item_aliases_phase_c/migration.sql`
   - Applied with `npx prisma migrate deploy`
   - Prisma client regenerated with `npx prisma generate`
3. `[x]` Build receipt alias resolution pipeline in `lib/core/matching/receipt-line.ts` (exact place alias -> fuzzy -> unresolved).
4. `[x]` Integrate alias lookup into `resolveReceiptLineMatch()` and pass `google_place_id` from receipt/shopping flows.
5. `[~]` Add alias creation on user confirmation:
   - Implemented in receipt line confirmation and shopping item resolution for receipt-linked lines.
   - Still needs runtime verification in UI flows.
6. `[x]` Add receipt idempotency guard (`receipt.status === "committed"`) before processing.
7. `[~]` Verify and test end-to-end (receipt parse/review/commit + shopping reconcile paths):
   - Static validation completed (`prisma validate`, `migrate status`, `tsc`)
   - Added and ran targeted core tests for receipt alias resolution/learning payloads (`lib/core/matching/receipt-line-core.test.mjs`) -- 7/7 pass
   - Runtime/UI verification still pending

Notes:

- The `Supplier` model already has `google_place_id` and `ShoppingSession` has `google_place_id`. These are the store context identifiers.
- `ItemAlias` is the existing general-purpose alias table (not store-scoped). `ReceiptItemAlias` is the new store-scoped table for receipt-specific mappings.
- Chain-level alias fallback is a future enhancement -- start with strict `place_id` scoping.
- The receipt matching pipeline currently only uses the fuzzy engine. The alias layer adds a fast exact-match first step.
- Phase B external providers now work: `resolved_external` result type, UI support in barcode page, and confidence scoring are all in place.

## Index

- [How To Use This Plan](#how-to-use-this-plan)
- [Latest Update](#latest-update)
- [Current Status](#current-status)
- [Pick Up Here (Next Continuation)](#pick-up-here-next-continuation)
- [Progress Imported From Handoff (2026-02-25)](#progress-imported-from-handoff-2026-02-25)
- [Goal](#goal)
- [Phase 0 - Mandatory Initial Evaluation](#phase-0---mandatory-initial-evaluation)
- [Target System Design (High-Level Behavior)](#target-system-design-high-level-behavior)
- [Data Model Design Principles](#data-model-design-principles)
- [Confidence and Matching Rules](#confidence-and-matching-rules)
- [Implementation Plan (Step-by-Step)](#implementation-plan-step-by-step)
- [Constraints](#constraints)
- [Expected Deliverables](#expected-deliverables)
- [Conclusion](#conclusion)

## Progress Imported From Handoff (2026-02-25)

Source: `docs/inventoryintakeplan.progress-handoff.md`

### Completed Work Recorded in Handoff

1. Phase 0 audit completed and documented in `docs/inventoryintakeplan.phase0-audit.md`.
2. Added a Layer-0 barcode resolver seam (`app/actions/core/barcode-resolver.ts`) with typed `resolved` / `unresolved` results and normalized barcode handling.
3. Routed barcode ingest action through the resolver seam (`app/actions/core/ingestion.ts`).
4. Routed barcode receive UI preview lookup through the same resolver seam (`app/(dashboard)/receive/barcode/page.tsx`).
5. Added provider adapter contract + registry seam (`app/actions/core/barcode-providers.ts`), but runtime remains internal-only.
6. Added external provider adapter stubs (OFF / OBF / UPCDatabase / UPCitemdb), all returning `not_implemented`.
7. Added additive Prisma schema models/enums for global barcode cache + provenance (`prisma/schema.prisma`).
8. Added draft SQL migration for the barcode cache/provenance prerequisite (`prisma/migrations/20260225133000_global_barcode_cache_prereq/migration.sql`) and did not apply it.

### Validation Performed in Handoff

- Targeted ESLint passed for barcode resolver/provider files and barcode receive page.
- Prisma schema validation passed (`npx prisma validate --schema prisma/schema.prisma`).

### Known Unrelated Repo Issues (Observed During Handoff Validation)

Full `npm run lint` fails on existing unrelated hook lint errors in:

- `app/(dashboard)/receive/receipt/[id]/page.tsx`
- `app/page.tsx`
- `components/theme/theme-toggle.tsx`

### Not Done Yet (Carried Forward)

- Resolver does not yet read/write `GlobalBarcodeCatalog`.
- Resolver does not yet create `BarcodeResolutionEvent` records.
- Unresolved caching/backoff behavior is not implemented.
- Provider throttling/retry/circuit-breaker behavior is not implemented.
- External adapters are stubs only (no live API calls/auth/normalization mappings).
- Prisma migration was drafted but not executed in app integration flow.

## Goal

Design and implement a production-grade, multi-industry inventory intelligence system that supports:

- Multi-tenant, multi-location businesses (stores, salons, barbershops, restaurants).
- Barcode-first product identity resolution with layered external provider fallback.
- Shopping mode tied to Google Places (`place_id`) for store-context-aware receipt mapping.
- Receipt ingestion that progressively "learns" store-specific aliases and reduces future manual work.
- Optional product photo enrichment without blocking core intake workflows.
- Safe, auditable, and step-by-step rollout.

The system must:

- Minimize friction for small business users.
- Avoid duplicate work and repeated API costs.
- Improve automation over time via structured learning.
- Maintain strict tenant isolation.
- Be implemented incrementally and safely.

The agent MUST first evaluate the existing database schema and codebase before proposing or implementing any structural changes.

## Phase 0 - Mandatory Initial Evaluation

Status (as of February 25, 2026): Completed and documented in `docs/inventoryintakeplan.phase0-audit.md`.

Before making any changes:

1. Audit the current database
   - Identify all inventory-related entities.
   - Identify how items, locations, and organizations are modeled.
   - Identify how receipt data is stored (if already implemented).
   - Identify whether barcode data is currently stored and how.
   - Identify whether there is any global vs organization-specific product separation.
   - Identify constraints, indexes, and RLS/authorization boundaries.
2. Audit the codebase
   - Locate barcode scanning flow.
   - Locate receipt parsing (Tabscanner) flow.
   - Identify where inventory updates are written.
   - Identify whether background jobs / queues exist.
   - Identify where Google Places is integrated.
   - Identify where product images are stored (if anywhere).
   - Identify caching patterns.
3. Document:
   - What can be reused.
   - What must be refactored.
   - What is missing entirely.
   - Risks of modifying existing logic.

Only after this evaluation may structural changes be proposed.

## Target System Design (High-Level Behavior)

### Barcode Resolution Pipeline

Resolution order:

- Layer 0: Internal database lookup (cache/mappings).
- Layer 1: Open Food Facts lookup (food/grocery oriented, no API key; requires clean User-Agent).
- Layer 2: Open Beauty Facts lookup (cosmetics/personal care oriented, no API key; requires clean User-Agent).
- Layer 3: UPCDatabase.org lookup (general fallback; requires account + bearer token; enforce rate limits).
- Layer 4: UPCitemdb lookup (general fallback; free explorer/trial endpoint with daily limits; enforce throttling).
- If no hit: mark as unresolved and avoid re-query spam via retry scheduling/backoff.

Provider usage requirements (implementation notes):

- Open Food Facts:
  - No token required for read access.
  - Call: `world.openfoodfacts.org` product-by-barcode endpoint.
  - Set a descriptive `User-Agent` for requests.
- Open Beauty Facts:
  - No token required for read access.
  - Call: `world.openbeautyfacts.org` product-by-barcode endpoint.
  - Set a descriptive `User-Agent` for requests.
- UPCDatabase.org:
  - Requires creating an account and obtaining an API token.
  - Send token as `Authorization: Bearer <token>` header.
  - Call: their product-by-barcode endpoint.
- UPCitemdb:
  - Free plan uses their "trial" lookup endpoint with strict daily quota.
  - Paid plans use headers; free trial does not (but still enforce internal throttling).
  - Call: their trial lookup endpoint with barcode query string.

Behavior:

- Normalize barcode format before lookup (strip spaces, validate UPC/EAN format/check digit when applicable).
- Cache all results (including unresolved) to minimize external requests and cost.
- Assign confidence score to resolved items (source reliability + field completeness).
- If low confidence, prompt user confirmation (edit name/brand/size/category).
- If no image returned, enqueue optional image enrichment task (do not block the main flow).
- If external providers fail, allow user to name the item and optionally add a photo to seed your internal mapping.

Expected outcome:

- Each unique barcode becomes known once.
- Subsequent scans are instant and cost-free.
- Data quality improves over time and external calls become rare.

### Shopping Mode (Google Places Context)

Shopping sessions are tied to:

- `place_id` (specific store)
- Optional merchant chain identity (derived from store brand/chain grouping when safe)

Behavior:

- When a user shops at a store, session context includes `place_id`.
- Once a shopping session is started for a store, the user can use a quick-shop loop:
  - scan item barcode
  - save item to cart
  - scan next item barcode
  - conclude quick shop via an explicit on-screen action/button
- Support scanning the **product barcode (UPC/EAN) directly from packaging** during shopping.
- For non-integrated stores (for example Costco, Walmart), product barcode scanning is the **primary identifier** for packaged items.
- Product barcode scanning builds and reuses a **store-independent canonical product database**.
- Persist `UPC -> Canonical Product` mappings so future receipt resolution can reuse the same product identity without re-learning.
- Receipt alias mappings are scoped to `place_id` first (store-specific).
- When the same item is purchased at a different store:
  - Barcode resolves globally via internal cache.
  - Receipt alias mapping is new for that store context (`place_id`) unless chain-level reuse is safe.
- Consider chain-level alias reuse as a fallback if you can reliably identify the chain and item-number stability.

Product barcode scan architecture (primary signal for packaged goods):

```text
Scan Product Barcode
-> Lookup internal DB
-> If exists: return canonical product
-> If not: trigger resolution pipeline
-> Save UPC -> Canonical Product mapping
```

During active shopping (quick-shop phase), use a fast path and defer expensive fallback work:

```text
During Shopping

Scan UPC

Attempt quick DB lookup

If found -> show clean name

If not found -> show provisional label (e.g., "Unresolved Item")

Do NOT trigger expensive web query yet

Store UPC locally (shopping session/cart)

Repeat scan -> save to cart -> next item until user selects Conclude Quick Shop
```

Note: while the user is actively shopping, the system may attempt lightweight barcode decoding/normalization and internal lookup, but expensive web-query fallback should be deferred until the receipt-backed reconciliation phase.

### Receipt Ingestion Intelligence

For each parsed receipt line (including shopping-session receipt reconciliation):

Attempt resolution in this order (item resolution flow):

1. Store-specific alias match (`place_id` + receipt item identifier).
2. Chain-level alias match (if applicable and proven safe).
3. Heuristic match (description similarity + price proximity + quantity).
4. Prompt user to scan product barcode (UPC/EAN) from packaging (photo optional; primary signal for packaged goods in non-integrated stores).
5. Final failsafe only: constrained web query resolution when UPC lookup fails, fuzzy match confidence is low, and the internal DB has no strong match.

When barcode is scanned:

- Resolve via the Barcode Resolution Pipeline (Layer 0-4).
- Create alias mapping between store receipt identifier and resolved barcode mapping.
- Persist mapping for future automation at that store (and optionally chain).

Final web query fallback (last-resort failsafe, not primary):

- Trigger only when all of the following are true:
  - UPC lookup fails.
  - Receipt fuzzy match confidence is low.
  - Internal DB has no strong match.
- Perform a constrained, structured web query using:
  - parsed item text
  - store name
  - brand (if available)
  - pack size (if parsed)
- Use structured search and field extraction (not raw scraping) to return candidate product names and normalized fields:
  - brand
  - size
  - unit
  - pack count
- AI proposes a canonical item name and assigns a confidence score.
- Auto-save only if confidence exceeds the defined threshold; otherwise require user confirmation before saving.
- Any web-derived resolution must be validated before permanent storage.

Shopping mode phased resolution (receipt-backed authoritative phase):

```text
After Receipt Scan (Authoritative Phase)

Resolution hierarchy:

UPC exact match

Store SKU previously mapped

Fuzzy match using receipt text + price

Only if still low confidence -> web query fallback

If web confidence high -> save canonical mapping

Otherwise -> request user confirmation
```

Design requirement:

- Receipt line identifiers must be treated as store/chain context aliases, not global product IDs.
- Receipt scanning must become more automated over time.

### Optional Enrichment Queue

If:

- No image exists
- Metadata confidence is low
- Product lacks normalization

Create non-blocking enrichment tasks:

- "Add product photo"
- "Confirm product size"
- "Confirm category"
- "Confirm brand / title cleanup"

User may complete later; never block intake.

## Data Model Design Principles

Do NOT hardcode schema changes immediately.

Instead:

- Propose minimal new logical entities needed to support:
  - Global barcode knowledge (cross-tenant reuse where appropriate)
  - Store-context receipt alias mapping (`place_id`-scoped with optional chain fallback)
  - Confidence + enrichment tracking
  - Audit history and source attribution (which provider produced the data)
- Ensure multi-tenant isolation.
- Avoid duplicating product identity per organization unless necessary.
- Keep receipt-to-product mapping distinct from inventory transaction records.
- Ensure idempotency protections for repeated scans or duplicate receipt ingestion.
- Store provider raw responses only if necessary; prefer normalized fields + provenance metadata.

Data mapping strategy note (global anchor):

```text
Store_ID
    -> Store_SKU (optional)
        -> UPC
            -> Canonical_Product
```

- `UPC` is the global anchor for packaged goods product identity.
- `Store_SKU` / receipt item codes remain store-context identifiers and should resolve through `UPC` when available.
- Persisted `UPC -> Canonical_Product` mappings should be reused across stores and during future receipt resolution.

## Confidence and Matching Rules

Define structured scoring:

Confidence hierarchy (highest -> lowest):

- Exact UPC match.
- Store SKU previously mapped to UPC (store-context alias already learned).
- Strong fuzzy match with historical data.
- PLU match (produce), especially when supported by description/price context.
- Web query resolution (last-resort; lowest confidence).

Web-based resolution must be validated before permanent storage.

Shopping-mode timing rule:

- During the live quick-shop scan loop, do not run the expensive web query fallback for unresolved UPCs.
- Defer web-based resolution to the post-receipt authoritative phase, where receipt text/price context improves confidence and reduces unnecessary calls.

Barcode Resolution:

- Resolved from internal cache = highest confidence.
- Resolved from Open Food Facts / Open Beauty Facts with complete fields = high.
- Resolved from UPCDatabase / UPCitemdb with partial fields = medium.
- Conflicting provider results = low (requires confirmation).
- Heuristic-only inference = low (requires confirmation).

Receipt Matching:

- Exact store alias match = auto-resolve.
- Chain alias match = medium-high confidence (only if chain stability is validated).
- Description similarity > threshold + price match = medium confidence.
- PLU match (produce) = medium confidence unless corroborated by stronger signals.
- Web query fallback result = low/lowest confidence and confirmation-first unless confidence exceeds a strict auto-save threshold.
- No reliable match = require barcode scan.

Never auto-commit low-confidence matches without confirmation.

Updated Resolution Pipeline (summary):

```text
Quick Shop (in-session): scan UPC -> quick DB lookup -> show clean name or provisional unresolved -> save to cart -> next scan -> Conclude Quick Shop
Post-receipt (authoritative): UPC exact -> Store SKU mapped -> fuzzy/PLU -> constrained web query (last failsafe)
Persist only validated mappings; reuse UPC -> Canonical Product globally (UPC is the anchor)
```

## Implementation Plan (Step-by-Step)

### Phase A - Safe Internal Layer

Status (as of February 25, 2026): Partially implemented.

Completed so far (from handoff):

- Resolver seam added for shared barcode resolution entrypoint (`app/actions/core/barcode-resolver.ts`).
- Barcode ingest action routed through resolver (`app/actions/core/ingestion.ts`).
- Barcode receive preview UI routed through resolver (`app/(dashboard)/receive/barcode/page.tsx`).
- Behavior preserved for current tenant-scoped lookup path and existing return contracts.

Remaining work for this phase / immediate bridge:

- [x] Add internal barcode cache logic with resolved/unresolved status tracking using the new global cache tables (guarded/fail-open until Prisma client + DB migration are applied).
- [~] Add confidence scoring + provenance fields (source provider) in resolver storage/event logging (resolver return payload not expanded yet).
- [x] Add targeted coverage for resolver cache/event metadata behavior (`hit` / `miss` / `error`) via shared payload-builder tests.
- Add or finalize basic normalization rules for barcodes and titles as needed.
- Do not modify receipt logic yet.
- Deploy and verify.

### Phase B - External Provider Layering (Sources 1-4)

Status (as of February 25, 2026): Not implemented yet (seams and prerequisites only).

Completed prerequisites so far (from handoff):

- Provider interface + registry seam added (`app/actions/core/barcode-providers.ts`).
- External adapter stubs created for OFF / OBF / UPCDatabase / UPCitemdb (all `not_implemented`).
- Additive Prisma schema + draft migration created for `GlobalBarcodeCatalog` and `BarcodeResolutionEvent` (not applied).

Remaining work:

- Implement provider fallback chain in this order:
  - Open Food Facts -> Open Beauty Facts -> UPCDatabase -> UPCitemdb
- Add per-provider throttling, timeouts, retries, and circuit breakers.
- Add caching + retry backoff for unresolved barcodes (avoid hammering providers).
- Keep rollout staged so external providers stay disabled until internal cache/provenance path is stable.
- Deploy and verify.

### Phase C - Receipt Alias Mapping (Google Places Context)

Status (as of February 25, 2026): Partially implemented (place-scoped alias schema + matching/learning paths added; migration apply + verification pending).

Planned work:

- Introduce store-context alias resolution using `place_id`.
- Implement receipt line resolution pipeline (alias -> heuristic -> barcode prompt).
- Store alias mapping after user barcode scan confirmation.
- Ensure idempotent receipt ingestion (same receipt cannot double-add inventory).
- Deploy and verify.

### Phase D - Enrichment Queue

Status (as of February 25, 2026): Not started.

Planned work:

- Implement optional enrichment tracking and "fix later" UI.
- Ensure missing images do not block workflows.
- Add lightweight admin controls for resolving low-confidence items.

### Phase E - Observability & Hardening

Status (as of February 25, 2026): Not started.

Planned work:

- Add metrics:
  - Cache hit rate
  - Provider hit rate per source (OFF / OBF / UPCDatabase / UPCitemdb)
  - Provider fallback depth distribution
  - Receipt auto-resolution rate
  - Unresolved ratio and retry success rate
- Add strict rate limiting and abuse prevention.
- Add background retry scheduling for unresolved barcodes.
- Add logging + error handling + audit trails.

Each phase must:

- Be independently deployable.
- Not break existing flows.
- Include migration strategy if needed.

## Constraints

- Do not refactor unrelated systems.
- Do not introduce breaking schema changes without migration plan.
- Maintain tenant isolation at all times.
- Avoid synchronous external API dependency in user-critical paths where possible (use async enrichment where appropriate).
- Ensure duplicate receipt ingestion cannot double-add inventory.
- Take this project step-by-step; ship in small increments with acceptance criteria.

## Expected Deliverables

1. A written evaluation of the current database and codebase.
2. A proposed minimal logical data extension model (no premature schema bloat).
3. A phased rollout plan with clear acceptance criteria per phase.
4. Pseudocode for:
   - `resolve_barcode()` (Layer 0-4 with caching and backoff)
   - `resolve_receipt_line()` (`place_id` aliasing + heuristic + barcode prompt)
   - `create_alias_mapping()` (store/chain mapping after confirmation)
5. Risk assessment and mitigation plan (rate limits, bad data, duplicates, provider outages).
6. Clear reasoning for every structural change and why it is the minimum needed.

## Conclusion

This system must evolve into a self-learning barcode and receipt intelligence engine.

The guiding principle:

- Barcode = global product truth.
- Receipt identifiers = store-context alias (`place_id`-scoped; chain fallback only when safe).
- Users teach the system once.
- The system automates thereafter.

Begin with a full audit of the existing system, then proceed in incremental, testable phases using the layered external sources: Open Food Facts, Open Beauty Facts, UPCDatabase.org, and UPCitemdb.
