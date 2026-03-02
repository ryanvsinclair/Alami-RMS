Deprecated - follow `docs/inventoryintakeplan.md` instead.

# Inventory Intake Plan Progress Handoff

Date: February 25, 2026

Purpose: This document summarizes what is already done for `docs/inventoryintakeplan.md`, including Phase 0 audit work and the implementation work completed after it, so the next agent can continue from the correct point without re-auditing.

## Primary Plan Documents

- Main plan: `docs/inventoryintakeplan.md`
- Phase 0 audit baseline: `docs/inventoryintakeplan.phase0-audit.md`

## Status Snapshot (as of this handoff)

- Phase 0 (mandatory audit): completed and documented.
- Phase A (safe internal layer): partially implemented.
- Phase B (provider layering): not implemented yet, but provider adapter seam and stubs are in place.
- Phase B prerequisite (global barcode cache/provenance schema): additive Prisma schema + SQL migration draft created (not applied yet).
- Phase C+ (place-scoped receipt aliasing, enrichment queue, observability): not started in code from this handoff.

## Phase 0 (Completed)

The required audit was completed and written to `docs/inventoryintakeplan.phase0-audit.md`.

Key checkpoints in that doc:

- Barcode normalization groundwork already existed and was marked Phase A-safe (`docs/inventoryintakeplan.phase0-audit.md:83`)
- Shared receipt/shopping line resolver extraction was already completed (`docs/inventoryintakeplan.phase0-audit.md:110`)
- Queue/worker infrastructure is still missing (`docs/inventoryintakeplan.phase0-audit.md:137`)
- Updated phase sequencing aligned to current repo (`docs/inventoryintakeplan.phase0-audit.md:334`)
- Recommended immediate next chunk (internal barcode resolver seam) was identified (`docs/inventoryintakeplan.phase0-audit.md:378`)

Why this matters:

- The audit established that current `item_barcodes` is tenant-scoped and cannot be reused as the global barcode truth layer.
- It also identified the safe seam to start Phase A without schema breakage.

## Work Completed After Phase 0

### 1) Added a Layer-0 barcode resolver seam (internal lookup only)

New resolver module:

- `app/actions/core/barcode-resolver.ts:16` defines `BarcodeResolutionResult`
- `app/actions/core/barcode-resolver.ts:32` defines `resolveBarcode(...)`

What it does:

- Normalizes barcode input
- Returns typed `resolved` / `unresolved` results
- Preserves current behavior by using the existing tenant-scoped lookup path (via provider layer, see below)
- Keeps UI/action return contracts unchanged

### 2) Routed barcode ingest action through the resolver seam

Updated barcode ingest path:

- `app/actions/core/ingestion.ts:4` imports `resolveBarcode`
- `app/actions/core/ingestion.ts:21` calls `resolveBarcode({ barcode: data.barcode })`

Behavior preserved:

- Invalid or not-found barcode still returns `error: "barcode_not_found"`
- Success path still returns `{ success: true, transaction, item }`

### 3) Routed barcode receive UI preview lookup through the same resolver seam

Updated barcode receive page:

- `app/(dashboard)/receive/barcode/page.tsx:10` imports `resolveBarcode`
- `app/(dashboard)/receive/barcode/page.tsx:38` uses resolver in `handleBarcodeScan()`

Result:

- Barcode preview lookup and barcode submit/commit now share the same resolution seam
- Reduced drift risk between preview and commit behavior

### 4) Added provider adapter contract + registry (Phase B seam, runtime still internal-only)

Provider contract/registry:

- `app/actions/core/barcode-providers.ts:7` `BarcodeProviderId` includes planned providers
- `app/actions/core/barcode-providers.ts:40` `BarcodeProvider` interface
- `app/actions/core/barcode-providers.ts:72` `PHASE_B_EXTERNAL_BARCODE_PROVIDER_STUBS`
- `app/actions/core/barcode-providers.ts:79` `getBarcodeProviderFallbackPlan()`
- `app/actions/core/barcode-providers.ts:83` `getBarcodeProviders()` (currently returns internal provider only)

Important runtime note:

- `getBarcodeProviders()` is intentionally Phase A-only and returns only the internal tenant lookup provider.
- External providers are not active yet.

### 5) Added external provider adapter stubs (not implemented, not active)

Stub files created (all currently return `error_code: "not_implemented"`):

- `app/actions/core/barcode-provider-adapters/open-food-facts.ts:3`
- `app/actions/core/barcode-provider-adapters/open-beauty-facts.ts:3`
- `app/actions/core/barcode-provider-adapters/upcdatabase.ts:3`
- `app/actions/core/barcode-provider-adapters/upcitemdb.ts:3`

Purpose:

- Establish stable adapter file boundaries for Phase B
- Prevent future churn in `resolveBarcode(...)` call sites when real provider integrations are added

### 6) Added additive Prisma schema for global barcode cache + provenance (Phase B prerequisite)

New enums in Prisma schema:

- `prisma/schema.prisma:145` `BarcodeResolutionStatus`
- `prisma/schema.prisma:151` `BarcodeSourceProvider`
- `prisma/schema.prisma:160` `BarcodeResolutionEventOutcome`

New Prisma models:

- `prisma/schema.prisma:265` `GlobalBarcodeCatalog`
- `prisma/schema.prisma:291` `BarcodeResolutionEvent`

Design intent:

- Adds a global cache/provenance layer without changing existing tenant-scoped `item_barcodes`
- Supports unresolved caching, retry/backoff fields, and provider provenance
- Keeps tenant behavior stable while enabling Phase B implementation later

### 7) Added matching SQL migration draft (not applied)

Migration file:

- `prisma/migrations/20260225133000_global_barcode_cache_prereq/migration.sql:2`

Includes:

- enum creation for barcode cache/provenance
- `global_barcode_catalog` table
- `barcode_resolution_events` table
- indexes and FK (`barcode_resolution_events -> global_barcode_catalog`)

Important:

- Migration is drafted and checked into the repo, but not executed in this handoff.

## Validation Performed

- Targeted ESLint passed for the barcode resolver/provider files and barcode receive page after changes.
- Prisma schema validation passed:
  - `npx prisma validate --schema prisma/schema.prisma`

## Known Unrelated Repo Issues (Observed During Validation)

A full `npm run lint` currently fails on unrelated existing files outside this barcode resolver work:

- `app/(dashboard)/receive/receipt/[id]/page.tsx:59`
- `app/page.tsx:160`
- `components/theme/theme-toggle.tsx:28`

These are existing React hook lint errors (`react-hooks/set-state-in-effect`) and were not modified as part of this handoff.

## What Is Not Done Yet (Important for Next Agent)

### Phase A / B bridge not implemented yet

- `resolveBarcode(...)` does not read/write `GlobalBarcodeCatalog` yet
- `resolveBarcode(...)` does not create `BarcodeResolutionEvent` records yet
- Unresolved caching/backoff behavior is not implemented yet
- No provider throttling/retry/circuit-breaker behavior yet

### External providers not implemented yet

- OFF / OBF / UPCDatabase / UPCitemdb adapters are stubs only
- No live API calls, auth headers, or normalization mappings yet

### No schema migration execution in this handoff

- Prisma schema is updated
- SQL migration draft exists
- But no migration/generate/app integration commands were run for these new tables

## Recommended Next Step (Exact Pickup Point)

Implement Layer 0 global-cache integration in the resolver, while keeping external providers disabled:

1. Add resolver persistence/read logic for `GlobalBarcodeCatalog`
2. Record `BarcodeResolutionEvent` entries for internal lookup outcomes (`hit` / `miss` / `error`)
3. Keep tenant-scoped `lookupBarcode(...)` as the active resolution source for actual item matching
4. Update `GlobalBarcodeCatalog` metadata (`last_seen_at`, `resolution_status`, `failure_count`, `retry_after_at`) based on outcomes
5. Do not enable external adapters yet (`getBarcodeProviders()` should remain internal-only until provider logic exists)

This preserves current behavior while making the Phase B cache/provenance tables immediately useful.

## Suggested Continuation Checklist

Before coding:

- Review `docs/inventoryintakeplan.md`
- Review `docs/inventoryintakeplan.phase0-audit.md`
- Review this handoff doc

Then continue in this order:

1. Implement Prisma access helpers for `GlobalBarcodeCatalog` / `BarcodeResolutionEvent`
2. Wire resolver to cache read/write + event logging (internal provider only)
3. Add unit/integration coverage for resolver outcomes
4. Only then begin implementing actual external provider adapters (OFF -> OBF -> UPCDatabase -> UPCitemdb)

## Notes on Safety / Compatibility

- Existing tenant-scoped barcode semantics are intentionally unchanged.
- Existing barcode receive UX should remain unchanged (preview + submit still work through same lookup semantics).
- Current work is additive and designed to keep the project shippable in small increments, consistent with `docs/inventoryintakeplan.md`.
