# Codebase Overview and Engineering Guide

Status: Active (living document)
Last Updated: 2026-02-27
Primary Purpose: Current architecture reference, implementation summary, and feature-placement rules.

## How To Use This Document

This document is now the main day-to-day architecture and implementation guide for the current codebase.

Use it to:
- understand how the app is structured today
- find canonical file locations for new work
- understand what major features already exist
- follow the required rules for adding/changing features without breaking the app structure
- review recent changes in `docs/codebase-changelog.md`

What this document is not:
- It is not a substitute for the code.
- It is not a migration file-by-file history (the detailed phase logs remain in the plan docs).

Related historical/planning docs (still useful for deep history):
- `docs/codebase-changelog.md` (chronological engineering changelog + validation record)
- `docs/master-plan-v1.md` (canonical cross-plan execution order, completed/open ledger, and handoff checkpoint for remaining initiatives)
- `docs/app-structure-refactor-agent-playbook.md` (refactor execution history and wrapper decisions)
- `docs/inventoryintakeplan.md` (inventory/barcode/receipt/enrichment rollout history)
- `docs/combined-plan-coordination.md` (cross-plan sequencing and handoff history)
- `docs/income-integrations-onboarding-plan.md` (business-type onboarding + income provider OAuth/sync rollout plan)
- `docs/receipt-post-ocr-correction-plan.md` (post-TabScanner numeric/structural correction and reconciliation accuracy plan)
- `docs/unified-inventory-intake-refactor-plan.md` (intent-first regrouping plan to unify Shopping + Receive under a single Inventory Intake Hub without changing core feature behavior)
- `docs/operational-calendar-schedule-plan.md` (sequencing-locked plan for a cross-industry Operational Calendar schedule tab that starts only after current active plans are complete)

## Maintenance Rules (Required)

After every meaningful code or docs change, update this overview and/or `docs/codebase-changelog.md` as required.

Minimum required updates:
1. Append a new entry at the top of `docs/codebase-changelog.md`.
2. If file placement/canonical paths changed, update `## Architecture Map` and `## Feature Placement Rules`.
3. If behavior changed, update the relevant feature section(s) under `## Product Capabilities` or `## Core Workflows`.
4. If a new exception/deviation was introduced, add it to `## Accepted Exceptions and Known Validation Gaps`.
5. Record validation commands actually run (and failures/exceptions) in the changelog entry in `docs/codebase-changelog.md`.

Changelog policy (`docs/codebase-changelog.md`):
- Append new entries at the top (newest first).
- Keep entries concise but concrete: what changed, which files, validation, caveats.
- Do not delete historical entries; add corrections as new entries.

## Current Status (As Of 2026-02-27)

High-level completion:
- App structure refactor plan: complete through Phase 8 (manual core-flow smoke deferred to user/integrated QA).
- Inventory intake plan: complete through Phases 0, A, B, C, D, E.
- Combined coordination plan: complete (manual integrated smoke remains a user QA task).
- Master execution tracker: active in `docs/master-plan-v1.md` for canonical sequencing of all remaining non-completed plans.

What remains outside plan completion:
- Manual integrated smoke testing across core flows (user-run / final QA pass).
- Receipt post-OCR correction plan is in progress (Phases 0/1/1.5 partial; later phases pending).
- Income integrations onboarding plan is implementation-ready but not started.
- Unified Intake regrouping refactor is planned but not yet implemented (see `docs/unified-inventory-intake-refactor-plan.md`).
- Operational Calendar/Schedule refactor is planned and sequencing-locked behind completion of all current plans (see `docs/operational-calendar-schedule-plan.md`).

## Stack

- Next.js App Router (`next` 16.x)
- React 19 + TypeScript
- Prisma ORM + PostgreSQL (`@prisma/adapter-pg`)
- Supabase client/storage integration
- Tailwind CSS
- Playwright (E2E tooling)

Key scripts (`package.json`):
- `npm run dev`
- `npm run build` (runs `prisma generate` first)
- `npm run lint`
- `npm run test:e2e`

## Path Aliases (Important)

Configured in `tsconfig.json`:
- `@/features/*` -> `src/features/*`
- `@/domain/*` -> `src/domain/*`
- `@/server/*` -> `src/server/*`
- `@/shared/*` -> `src/shared/*`
- `@/core/*` -> `lib/core/*` (legacy compatibility path)
- `@/modules/*` -> `lib/modules/*` (legacy compatibility path)
- `@/*` -> broad alias resolving to `./lib/*` and `./*`

Rules for new code:
- Prefer explicit aliases: `@/features`, `@/domain`, `@/server`, `@/shared`.
- Treat `@/core/*` and `@/modules/*` as legacy/compatibility paths unless extending an existing legacy module intentionally.
- Avoid relying on broad `@/*` when a more explicit alias exists.

## Architecture Map (Current Structure)

### 1. App entrypoints (`app/`)

Purpose:
- Next.js routes and layouts
- Server action entrypoints
- Thin wrappers around canonical feature/server logic

Patterns:
- Route pages should be thin wrappers that render feature UI components.
- Server actions should be thin wrappers that enforce auth/module guards and delegate to feature services.

Examples:
- `app/(dashboard)/inventory/page.tsx` -> thin wrapper to `src/features/inventory/ui/InventoryListPageClient.tsx`
- `app/actions/core/inventory.ts` -> wrapper around `src/features/inventory/server/*`
- `app/actions/modules/receipts.ts` -> wrapper around `src/features/receiving/receipt/server/*`

Accepted exception:
- `app/(dashboard)/shopping/page.tsx` is still a large route entrypoint (state/hooks/contracts extracted; most JSX remains local).

### 2. Feature modules (`src/features/`)

Purpose:
- Canonical location for feature-specific UI, services, repositories, integrations, and contracts

Current feature folders:
- `src/features/auth`
- `src/features/contacts`
- `src/features/finance`
- `src/features/home`
- `src/features/integrations`
- `src/features/inventory`
- `src/features/modules`
- `src/features/receiving`
- `src/features/shopping`
- `src/features/staff`

Typical internal split:
- `ui/` client components and feature UI helpers
- `server/` service/repository/query logic
- `shared/` client-safe feature contracts/helpers used by both `ui/` and `server/` (optional, add when needed)
- `integrations/` feature-local external integration wrappers/adapters (when feature-specific)

### 3. Domain logic (`src/domain/`)

Purpose:
- Pure logic and reusable domain utilities with no framework/runtime coupling

Current areas:
- `src/domain/barcode`
- `src/domain/matching`
- `src/domain/parsers`
- `src/domain/shared`

Examples:
- barcode normalization
- matching confidence/fuzzy logic
- receipt/product/shelf-label parsing
- shared serialization helpers (facade path)

### 4. Server infrastructure (`src/server/`)

Purpose:
- Server-only infrastructure facades and integration access points

Current areas:
- `src/server/auth`
- `src/server/db`
- `src/server/integrations`
- `src/server/matching`
- `src/server/modules`
- `src/server/storage`

Examples:
- Prisma facade
- auth/tenant guards
- Supabase storage helpers
- receipt OCR integration facades
- module guard facade

### 5. Shared UI/config/types (`src/shared/`)

Purpose:
- Shared components, UI primitives, config, types, and utilities consumed across features

Current areas:
- `src/shared/ui`
- `src/shared/components/*` (nav, pwa, theme, receipts, flows)
- `src/shared/config`
- `src/shared/types`
- `src/shared/utils`

## Legacy Compatibility Layers (Still Present by Design)

Not all wrappers were removed in the refactor. Phase 8 documented a keep/defer matrix and intentionally left wrappers in place.

Wrapper categories:
- Keep (by design):
  - route entrypoints in `app/(dashboard)/**/page.tsx`
  - server action entrypoints in `app/actions/**`
- Keep for now (canonical facades):
  - many `src/*` wrapper paths that currently re-export legacy implementations but define the canonical import surface
- Defer retirement:
  - legacy compatibility wrappers in `lib/core/*` (especially parser/matching/barcode wrappers) still used by active callers/tests

Important Phase 8 outcome:
- Zero wrapper removals were performed.
- Future wrapper removals require repo-wide import migration proof plus validation.

## Product Capabilities (Current)

This is a multi-flow inventory/receiving/shopping system with barcode-first intelligence and receipt learning.

### Home dashboard financial layers (interactive)

Implemented capabilities:
- Layered home financial surfaces with separate income and expense/transactions sheets
- Income-layer tap interaction collapses the transactions sheet to reveal income-source breakdown
- Expense-focused transactions sheet (recent expense activity only)
- Business-type-aware income source ordering (for example restaurant POS + delivery channels first)

Canonical paths:
- `src/features/home/ui/*`
- `src/features/home/server/*`
- `src/features/home/shared/*`

Wrappers:
- `app/page.tsx` (route composition/state wiring)
- `app/actions/core/financial.ts` (`getDashboardSummary` wrapper delegates to feature server)

### Receiving (4 ingestion paths)

Implemented paths:
1. Barcode receive
2. Photo receive (OCR + parsing + match assist)
3. Manual receive
4. Receipt parse/review/commit

Current structure (canonical):
- `src/features/receiving/barcode/*`
- `src/features/receiving/photo/*`
- `src/features/receiving/manual/*`
- `src/features/receiving/receipt/*`
- `src/features/receiving/shared/*`

Route wrappers:
- `app/(dashboard)/receive/*`

### Barcode resolution intelligence (Phases A/B/E complete)

Implemented capabilities:
- Layer 0 internal lookup/cache logic with global barcode catalog + resolution event recording
- Layered external provider fallback chain:
  - Open Food Facts
  - Open Beauty Facts
  - UPCDatabase
  - UPCitemdb
- Confidence + provenance returned in resolver results
- Global unresolved caching/backoff behavior
- Stricter rate limiting / abuse controls for repeated lookup churn
- Background retry scheduling for unresolved barcodes (process-local timers)
- Aggregate metrics and derived-rate summaries (process-local structured logs)

Primary files:
- `app/actions/core/barcode-resolver.ts`
- `app/actions/core/barcode-resolver-core.ts`
- `app/actions/core/barcode-resolver-cache.ts`
- `app/actions/core/barcode-providers.ts`
- `app/actions/core/barcode-provider-adapters/*`

Data model support:
- `GlobalBarcodeCatalog`
- `BarcodeResolutionEvent`

Operational note:
- Some hardening/metrics/retry state is process-local and resets on server restart.

### Receipt intelligence and store-context aliasing (Phase C complete)

Implemented capabilities:
- Place-scoped receipt aliasing (`google_place_id`)
- Receipt line matching and alias learning
- Receipt parse/review/commit lifecycle
- Post-OCR correction now accepts line-level historical price plausibility hints derived from recent receipt line history (scoped by business and supplier/place when available)
- Historical hint quality gates are active (minimum sample-size threshold + recent-history lookback window) with summary metrics for hint coverage/sample quality
- Correction-core historical plausibility scoring now only applies history-based score adjustments when hint sample size is at least 4 (workflow-aligned confidence gate)
- Province hint resolution now prioritizes Google Place Details lookups (when `google_place_id` is available) with supplier-address fallback, so tax interpretation uses stronger store-context geography signals
- Raw-text receipt parser skip/noise filters now explicitly handle `Sub Total`/`Grand Total`, dotted tax labels (`H.S.T.`), and Quebec tax labels (`TPS`/`TVQ`) to reduce false line-item candidates before correction
- Raw-text totals extraction now supports additional noisy label/amount variants (`Sub-Total`, `Total Due`, `Montant total`, spaced/comma-decimal amounts) for stronger tax/totals interpretation on parsed-text receipts
- Service-layer produce lookup is now active post-core correction (`receipt-produce-lookup.service.ts`): PLU-first + fuzzy name matching against `produce_items`, with province-aware language order (`QC: FR -> EN`, default `EN`)
- Schema-backed minimal produce persistence is active on `ReceiptLineItem` with nullable `plu_code` and `organic_flag` fields
- Schema-backed parse metadata persistence is active on `ReceiptLineItem` (`parse_confidence_score`, `parse_confidence_band`, `parse_flags`, `parse_corrections`) so parse-confidence evidence survives parse/reload cycles
- Receipt review UI now surfaces parse-confidence indicators separately from match confidence (per-line parse badges, parse-band summary counts, inline parse flags for medium/low confidence lines)
- Store-specific parse-profile memory is active via `ReceiptParseProfile` (dedicated table): correction summaries now accumulate province/tax/parse signals per store profile key (`place:<google_place_id>` preferred, fallback `supplier:<supplier_id>`)
- Profile priors are now consumed in receipt workflows when Google Place province hints are unavailable, and line-review `confirmed`/`skipped` actions feed profile stats for continuous store adaptation
- Raw-text receipt parsing now uses a hybrid section-aware parser (`src/domain/parsers/receipt.ts`) instead of regex-only extraction:
  - line section classification (items vs tax/subtotal/total/footer/meta)
  - multi-line wrapped item merge support
  - numeric cluster extraction (`qty x unit_price line_total`) and safer trailing amount parsing
  - province-hinted tax summary skipping and optional profile-guided SKU token position hints
- Receipt-correction fixture corpus is expanded to 20 runnable scenarios, including discount-heavy parsed-text and historical-threshold boundary coverage
- Idempotent receipt commit behavior in inventory ledger path
- Receipt auto-resolution observability (process-local summaries)

Key model:
- `ReceiptItemAlias` (store-context alias mapping)

Canonical server paths:
- `src/features/receiving/receipt/server/*`

### Shopping mode with Google Places context

Implemented capabilities:
- Shopping sessions tied to store/place context (`google_place_id`)
- Quick-shop barcode loop
- Receipt reconciliation / pairing
- Manual pairing fallback for unresolved barcode items
- Optional photo-assisted and web/AI suggestion flow (post-receipt authoritative phase)
- Audit metadata persistence for fallback evidence and pairing decisions
- Web fallback hardening and observability

Canonical paths:
- `src/features/shopping/server/*`
- `src/features/shopping/ui/*`
- `src/features/shopping/integrations/*` (feature-facing facades)

Important hotspot:
- `lib/modules/shopping/web-fallback.ts` remains a major legacy implementation hotspot behind refactor facades.

### Inventory management and enrichment queue (Phase D complete)

Implemented capabilities:
- Inventory CRUD (items, barcodes, aliases)
- Inventory list/detail pages
- Derived non-blocking "Fix Later Queue" surfaced in Inventory UI
- Persistent task actions via client-side localStorage:
  - complete
  - defer
  - snooze
  - undo/reset
- Expanded candidate sources:
  - barcode/global metadata quality gaps
  - receipt matching suggested/unresolved outcomes
  - shopping pairing leftovers (unresolved barcode, missing-on-receipt, extra-on-receipt)
  - normalization gaps (e.g., missing category)
- Queue observability stats in UI (candidate source breakdown, queue health)

Canonical files (examples):
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/inventory/server/inventory.service.ts`
- `src/features/inventory/ui/InventoryListPageClient.tsx`
- `src/features/inventory/ui/use-enrichment-dismissals.ts`

Deferred by design:
- Server-side persistent enrichment task table (future enhancement if localStorage dismissals become insufficient)

### Contacts and staff

Refactor-complete feature extraction:
- `src/features/contacts/*`
- `src/features/staff/*`

Route/action wrappers remain in `app/(dashboard)` and `app/actions/core`.

## Data Model (Key Entities and Relationships)

Core operational entities:
- `Business`
- `InventoryItem`
- `ItemBarcode`
- `ItemAlias`
- `InventoryTransaction`
- `ItemPriceHistory`
- `Supplier` (includes `google_place_id`)

Receipt entities:
- `Receipt`
- `ReceiptLineItem`
- `ReceiptItemAlias` (store-context alias mapping)
- `ReceiptParseProfile` (store-specific parse/tax/province memory + priors)

Shopping entities:
- `ShoppingSession`
- `ShoppingSessionItem` (includes `resolution_audit`)

Barcode intelligence entities:
- `GlobalBarcodeCatalog`
- `BarcodeResolutionEvent`

Design principles currently enforced:
- Tenant isolation remains primary (`business_id`-scoped operations)
- Receipt/store aliases are place-scoped (not global product IDs)
- Barcode knowledge is globally cached for metadata/provenance, not cross-tenant inventory ownership
- Receipt commit and ledger writes preserve idempotency/all-or-nothing semantics

## Core Workflows (Current Behavior)

### 1. Barcode receive flow

High-level flow:
1. User scans barcode in receive UI
2. Resolver normalizes barcode
3. Internal lookup (tenant/global cache paths)
4. External provider fallback chain (if needed)
5. Result returned with confidence + source
6. Inventory transaction / item linkage path proceeds
7. Metrics + cache/event persistence recorded

Notes:
- Unresolved lookups use backoff/cooldowns
- Background retries may re-attempt external providers later (process-local)

### 2. Photo receive flow

High-level flow:
1. Upload/capture image
2. OCR extraction
3. Product text parsing / matching
4. User confirms/suggests
5. Transaction write
6. Alias learning (where applicable)

### 3. Manual receive flow

High-level flow:
1. User selects existing item or creates new item
2. Quantity/cost metadata entered
3. Transaction written
4. Optional aliases/barcodes can be added

### 4. Receipt parse/review/commit flow

High-level flow:
1. OCR/manual receipt text ingestion
2. Parse into line items
3. Derive optional historical line-price hints from recent receipt history for current parsed names (feature-layer orchestration)
4. Run post-OCR numeric correction/reconciliation (feature-flagged; shadow/enforce modes)
5. Apply tax interpretation checks (province/tax-structure/math validation where signals exist)
6. Apply produce normalization (9-prefix PLU handling + organic keyword stripping on produce candidates)
7. Resolve lines using alias + matching pipeline
8. User reviews/edits unresolved/suggested lines
9. Commit receipt transactions atomically
10. Learn aliases from user confirmations

Behavior invariants:
- Commit remains idempotent
- Commit is all-or-nothing

### 5. Shopping + post-receipt reconciliation flow

High-level flow:
1. Start shopping session with Google Places store context
2. Scan item barcodes during shopping
3. Resolve via barcode resolver (defer expensive web fallback during live scan loop)
4. Scan/ingest receipt (authoritative phase)
5. Reconcile staged items to receipt lines
6. Manual/photo/web fallback only when needed
7. Persist pairing audit metadata
8. Commit/reconcile shopping state

### 6. Inventory enrichment "Fix Later" queue

High-level flow:
1. Inventory server derives candidate tasks from multiple existing data sources
2. UI displays prioritized queue (non-blocking)
3. User applies local actions (complete/defer/snooze) via localStorage dismissals
4. Queue updates immediately without impacting intake workflows
5. Observability stats help identify backlog patterns

## Feature Placement Rules (Most Important Section)

Future engineers must follow these rules to preserve the refactor structure.

### Rule 1: Put code in the canonical layer first

Choose placement by responsibility:
- Route composition and page entrypoint only -> `app/(dashboard)/**/page.tsx`
- Server action entrypoint / auth guard wrapper -> `app/actions/**`
- Feature business logic / workflows -> `src/features/<feature>/server/*`
- Feature UI and local state -> `src/features/<feature>/ui/*`
- Pure parsing/scoring/normalization -> `src/domain/*`
- Shared UI components/config/types -> `src/shared/*`
- Server-only infra clients and adapters -> `src/server/*`

Do not add new business logic to:
- `app/(dashboard)/**/page.tsx` (except accepted legacy exception work, if you are intentionally touching it)
- `app/actions/**` wrappers (unless action contract/auth/guard wiring must change)

### Rule 2: Respect client/server boundaries

- Client components must not import `@/server/*`.
- Client components can call server actions through `app/actions/*` entrypoints.
- Server-only code (Prisma, auth guards, storage) belongs in `src/server/*` and feature server modules.

### Rule 3: Prefer explicit aliases

Use:
- `@/features/*`
- `@/domain/*`
- `@/server/*`
- `@/shared/*`

Avoid for new code:
- `@/core/*` (legacy compatibility path)
- `@/modules/*` (legacy compatibility path)
- ambiguous `@/*` imports when an explicit alias exists

### Rule 4: Do not remove wrappers casually

Wrappers exist for one of three reasons:
- required entrypoints (route/action wrappers)
- canonical facades (`src/*` wrapper paths)
- compatibility for legacy imports/tests (`lib/core/*` wrappers)

Before removing any wrapper:
1. Prove repo-wide imports no longer depend on it.
2. Run validation.
3. Update this document changelog + accepted exceptions if behavior/structure changes.

### Rule 5: Keep refactor exceptions explicit

If you cannot keep a route thin (for example `app/(dashboard)/shopping/page.tsx`), document it here under:
- `Accepted Exceptions and Known Validation Gaps`
- Changelog entry for that change

Do not leave undocumented structural deviations.

### Rule 6: Extend feature modules, do not create parallel implementations

Before adding a new file:
- search for existing repository/service/helper in the feature module
- extend canonical files instead of duplicating logic in route pages/actions

Examples:
- Inventory enrichment work belongs in `src/features/inventory/server/*` and `src/features/inventory/ui/*`, not in `app/actions/core/inventory.ts` beyond wrapper wiring.
- Receipt matching changes belong in `src/features/receiving/receipt/server/*` and `src/domain/matching/*` (if pure logic).
- If both inventory UI and inventory server need the same queue types/constants, put them in a client-safe feature file such as `src/features/inventory/shared/*` (do not import `src/features/inventory/server` from client code).

## New Feature Implementation Playbook (Follow This)

Use this checklist when adding a new feature or major extension.

### A. Decide the scope type

- Cross-cutting pure logic -> `src/domain/*`
- Feature-specific workflow -> `src/features/<feature>/server/*`
- Feature UI -> `src/features/<feature>/ui/*`
- Shared primitive/component/config -> `src/shared/*`
- External server integration -> `src/server/integrations/*` or `src/features/<feature>/integrations/*` (if feature-local)

### B. Wire entrypoints last

Order of implementation:
1. Repository/query functions (if DB access needed)
2. Service/workflow logic
3. Feature UI
4. Action wrapper / route wrapper wiring
5. Validation
6. Docs/changelog update in this file

### C. Validation expectations

Run targeted validation for touched files, plus broader checks when appropriate.

Common commands:
- `npx tsc --noEmit --incremental false`
- `npm run lint` (document baseline failures if unchanged)
- `node --test app/actions/core/barcode-resolver-cache.test.mjs`
- `node --test --experimental-transform-types lib/core/matching/receipt-line-core.test.mjs`

### D. Documentation expectations (required)

For every meaningful change:
- Append a changelog entry in this file
- Update relevant architecture/workflow sections here
- If reactivating plan-style work, also update the relevant plan doc(s)

## Accepted Exceptions and Known Validation Gaps

Structural exceptions:
- `app/(dashboard)/shopping/page.tsx` remains a large route entrypoint (state/hooks/contracts extracted, JSX mostly local). This is an accepted deviation.
- Zero wrapper removals were performed during refactor Phase 8. Wrapper keep/defer matrix is documented; removals are deferred until repo-wide migrations justify them.

Validation exceptions (documented baseline/current):
- `npm run lint` has known failures not caused by the refactor closeout:
  - `app/page.tsx`
  - `components/theme/theme-toggle.tsx`
  - `lib/modules/shopping/web-fallback.ts`
  - generated `playwright-report` asset lint noise
- `node --test app/actions/core/barcode-resolver-core.test.mjs` fails under direct Node execution because of a Node ESM extensionless import resolution issue (`barcode-resolver-core.ts` imports `app/actions/core/barcode-resolver-cache` without an extension specifier in this command context)

Deferred QA:
- Manual integrated smoke test across core flows is intentionally deferred to user/final QA pass.

## Operational Notes and Gotchas

Prisma client regeneration in dev:
- After schema changes and `prisma generate`, restart the Next.js dev server.
- Reason: the in-memory Prisma client instance in the running server may be stale and not expose newly generated delegates/models.

Process-local observability/retries:
- Some queue/metrics/cooldown/retry state is in-memory and resets on server restart.
- This is expected for current Phase E behavior unless/until persistent jobs/metrics are added.
