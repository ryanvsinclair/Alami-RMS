# Codebase Overview and Engineering Guide

Status: Active (living document)
Last Updated: 2026-02-28
Primary Purpose: Current architecture reference, implementation summary, and feature-placement rules.

---

## 🔐 Backend Architecture Reference

> **MANDATORY READ FOR ALL BACKEND WORK**
>
> All backend system understanding must be derived from:
>
> **[docs/MASTER_BACKEND_ARCHITECTURE.md](./MASTER_BACKEND_ARCHITECTURE.md)**
>
> This document is the **authoritative source of truth** for:
> - Live database schema (introspected directly from Supabase)
> - All 26 tables and 21 enums with full column details
> - Security model and RLS posture
> - Multi-tenant isolation strategy
> - Migration history and governance rules
> - External integrations (OAuth, barcode resolution, OCR)
> - Deployment safety checklist
> - Full schema audit report (schema alignment: 96.2%)
>
> Any engineer or AI agent modifying backend logic **must read that document first**.
>
> Do NOT duplicate backend explanations in this file. This document covers frontend structure, feature placement, and product capabilities. The backend document covers database, security, and data flow.

---

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
- `docs/master-plan-v1.md` (archived canonical execution ledger; all v1 checklist items complete)
- `docs/master-plan-v2.md` (active canonical tracker for the restaurant launch major refactor program)
- `docs/app-structure-refactor-agent-playbook.md` (refactor execution history and wrapper decisions)
- `docs/inventoryintakeplan.md` (inventory/barcode/receipt/enrichment rollout history)
- `docs/combined-plan-coordination.md` (cross-plan sequencing and handoff history)
- `docs/income-integrations-onboarding-plan.md` (business-type onboarding + income provider OAuth/sync rollout plan)
- `docs/receipt-post-ocr-correction-plan.md` (post-TabScanner numeric/structural correction and reconciliation accuracy plan)
- `docs/unified-inventory-intake-refactor-plan.md` (intent-first regrouping plan to unify Shopping + Receive under a single Inventory Intake Hub without changing core feature behavior)
- `docs/operational-calendar-schedule-plan.md` (Operational Calendar plan — COMPLETE; OC-00 through OC-07 closed)

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
- Master execution tracker: `docs/master-plan-v1.md` archived complete; `docs/master-plan-v2.md` is the active canonical tracker.

What remains outside plan completion:

- Manual integrated smoke testing across core flows (user-run / final QA pass).
- Receipt post-OCR correction plan is complete through Phase 6 closeout (`RC-19`), with non-blocking follow-ups tracked separately.
- **Income Integrations Onboarding Plan: COMPLETE** (all phases IN-00 through IN-08, security checklist 7/7).
- **Unified Inventory Intake Refactor Plan: COMPLETE** (all phases UI-00 through UI-06). `/intake` is the canonical Hub entry; capability-gating via `resolveVisibleIntents()`; all migration-era scaffolding removed; `/shopping` and `/receive` remain as full feature routes under the Hub.
- **Operational Calendar Plan: COMPLETE** — OC-00 through OC-07 shipped (activation, shell, provider sync, scheduling connectors, suggestions, ops hardening, closure/archive transition).

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
- `src/features/intake` (new — Unified Inventory Intake refactor; Phase 0 contracts only)
- `src/features/integrations`
- `src/features/inventory`
- `src/features/modules`
- `src/features/receiving`
- `src/features/schedule`
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

### Inventory Intake Hub (UI-01 complete)

Implemented capabilities:

- `/intake` route with intent-first landing surface (`IntakeHubClient`)
- Industry-aware intent card ordering via `INTAKE_INTENT_ORDER_BY_INDUSTRY` (from `src/features/intake/shared/`)
- Restaurant-first launch support lock via `INDUSTRY_LAUNCH_SUPPORT_MAP` (`restaurant=full`, others=`planned`)
- Intake launch guardrails codified in shared contracts (`intake_source` + `inventory_eligibility` vocabulary + invariant lock)
- Three intent cards routing to existing flows:
  - **Live Purchase** → `/shopping` (existing Shopping flow, unchanged)
  - **Bulk Intake** → `/receive` (existing Receive flow, unchanged)
  - **Supplier Sync** → `/integrations` (module-gated; only shown when `integrations` module is enabled)
- `Intake` nav entry in bottom nav (consolidated standalone `/receive` and `/shopping` tabs into the Hub proxy)
- All existing routes fully operational (no behavior changes)

Canonical paths:

- `src/features/intake/shared/intake.contracts.ts` (vocabulary, intent model, session lifecycle, capabilities)
- `src/features/intake/shared/intake-session.contracts.ts` (session orchestration adapter: status mappings, `IntakeSessionSummary` DTO, route builder)
- `src/features/intake/shared/intake-capability.service.ts` (capability gating: `resolveIntakeCapabilities`, `isIntentVisible`, `resolveVisibleIntents`)
- `lib/config/presets.ts` (industry presets + launch support map)
- `src/features/intake/ui/IntakeHubClient.tsx` (Hub UI component — uses `resolveVisibleIntents()`)
- `app/(dashboard)/intake/page.tsx` (route wrapper)

Migration posture:

- `/shopping` and `/receive` routes preserved and fully functional
- Refactor complete (UI-00 through UI-06): navigation consolidated, migration-era comments removed, canonical stable state.

### Signup and Business Provisioning

Implemented capabilities:

- `industry_type` remains the canonical signup input for business provisioning.
- Signup now supports optional restaurant place capture (`google_place_id`, formatted address, latitude, longitude) with explicit skip behavior.
- Business provisioning persists optional place metadata on `Business` when supplied.
- Restaurant businesses now default-enable `table_service` alongside existing launch modules.
- Existing restaurant businesses are backfilled with `table_service` module enablement via additive migration.

Canonical paths:

- `app/auth/signup/page.tsx`
- `app/actions/core/auth.ts`
- `lib/core/auth/tenant.ts`
- `lib/modules/registry.ts`
- `lib/modules/table-service/index.ts`
- `src/features/table-service/server/guard.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260228060000_business_profile_place_metadata/migration.sql`
- `prisma/migrations/20260228130000_table_service_module_backfill/migration.sql`

### Operational Calendar (OC-04 complete)

Implemented capabilities:

- `/schedule` route provides Day/Week/Month master shell and source filters from OC-02.
- Provider catalog + sync health shell (SourceHealthBar) from OC-03 is active.
- Scheduling-platform server foundation is active for Phase 3 expansion:
  - connector registry for appointment/reservation providers
  - provider-event normalization contracts and guardrails
  - deterministic duplicate suppression + overlap conflict diagnostics
  - sync preview service surface for provider fetch/normalize/conflict reporting
- Cross-feature suggestion layer is active for Phase 4:
  - delivery-window to intake-session coverage nudges
  - booking/reservation inventory deficit hints
  - job-assignment material gap warnings
  - Schedule UI suggestion rail with empty-state-safe rendering
- Ops hardening layer is active for Phase 5:
  - sync reliability + duplicate/overlap rate summary derivation
  - deterministic day/week/month render caps for load guard tuning
  - role/source-aware event permission checks and audit-entry construction
  - Schedule UI ops diagnostics shell for upcoming telemetry display

Canonical paths:

- `src/features/schedule/shared/schedule.contracts.ts`
- `src/features/schedule/shared/schedule-provider.contracts.ts`
- `src/features/schedule/shared/schedule-sync.contracts.ts`
- `src/features/schedule/shared/schedule-normalization.contracts.ts`
- `src/features/schedule/shared/schedule-suggestions.contracts.ts`
- `src/features/schedule/shared/schedule-ops.contracts.ts`
- `src/features/schedule/server/scheduling-connectors.ts`
- `src/features/schedule/server/schedule-conflict.service.ts`
- `src/features/schedule/server/scheduling-sync.service.ts`
- `src/features/schedule/server/schedule-suggestion.service.ts`
- `src/features/schedule/server/schedule-ops.service.ts`
- `src/features/schedule/ui/ScheduleClient.tsx`
- `app/(dashboard)/schedule/page.tsx`

### Home dashboard financial layers (interactive)

Implemented capabilities:

- Layered home financial surfaces with separate income and expense/transactions sheets
- Income-layer tap interaction collapses the transactions sheet to reveal income-source breakdown
- Expense-focused transactions sheet (recent expense activity only)
- Business-type-aware income source ordering (for example restaurant POS + delivery channels first)
- Receipt-linked expense rows now include explicit `View Photo` cue when navigating to receipt detail

Canonical paths:

- `src/features/home/ui/*`
- `src/features/home/server/*`
- `src/features/home/shared/*`

Wrappers:

- `app/page.tsx` (route composition/state wiring)
- `app/actions/core/financial.ts` (`getDashboardSummary` wrapper delegates to feature server)

### Income integrations — Phase 4 complete (GoDaddy POS + Uber Eats + DoorDash live)

Implemented capabilities:

- Industry-aware provider catalog and recommendation ordering for onboarding/integrations views
- Onboarding setup route (`/onboarding/income-sources`) with provider cards, status badges, and skip flow
- Dashboard integrations route (`/integrations`) with connection status, last-sync timestamps, and sync buttons
- Provider-agnostic OAuth core active via:
  - `/api/integrations/oauth/[provider]/start`
  - `/api/integrations/oauth/[provider]/callback`
- OAuth state hashing + one-time state consumption + PKCE + token encryption in feature server services
- Three live provider sync adapters (all follow same normalization contract):
  - `godaddy-pos.provider.ts` — POS events; `GET /api/integrations/sync/godaddy-pos/manual`
  - `uber-eats.provider.ts` — order/payout events; `GET /api/integrations/sync/uber-eats/manual`
  - `doordash.provider.ts` — delivery/order events; `GET /api/integrations/sync/doordash/manual`
- Generic `runProviderManualSync` shared runner in `sync.service.ts` — all providers use same upsert/projection/log path
- Provider catalog `SYNC_ENABLED_PROVIDERS` + `buildSyncHref` — one line to enable sync for a new provider
- `IncomeEvent` upsert (idempotent on `connection_id + external_id`) + `FinancialTransaction` projection (idempotent on `business_id + source + external_id`)
- `ExternalSyncLog` records every sync run (running → success/failed) with record counts
- `lastSyncAt` surfaced in connection card contract and UI
- Home dashboard income breakdown already consumes all three sources (`godaddy_pos`, `uber_eats`, `doordash`)

Canonical paths:

- `src/features/integrations/shared/*`
- `src/features/integrations/server/provider-catalog.ts`
- `src/features/integrations/server/oauth.service.ts`
- `src/features/integrations/server/oauth-state.repository.ts`
- `src/features/integrations/server/connections.repository.ts`
- `src/features/integrations/server/oauth-crypto.ts`
- `src/features/integrations/server/sync.service.ts`
- `src/features/integrations/providers/registry.ts`
- `src/features/integrations/providers/godaddy-pos.provider.ts`
- `src/features/integrations/providers/uber-eats.provider.ts`
- `src/features/integrations/providers/doordash.provider.ts`
- `src/features/integrations/ui/*`

Route wrappers:

- `app/onboarding/*`
- `app/(dashboard)/integrations/*`
- `app/api/integrations/sync/godaddy-pos/manual/route.ts`
- `app/api/integrations/sync/uber-eats/manual/route.ts`
- `app/api/integrations/sync/doordash/manual/route.ts`

Scheduled sync + webhooks (Phase 5 complete):

- `runAllProvidersCronSync` in `sync.service.ts`: cron runner across all providers + businesses with error isolation
- `app/api/integrations/sync/cron/route.ts`: `INCOME_CRON_SECRET`-secured cron endpoint
- Sync lock guard in `runProviderManualSync`: DB soft lock via `ExternalSyncLog` (10-min staleness window, scoped per business+source)
- `src/features/integrations/server/webhook-crypto.ts`: HMAC-SHA256 signature verification with `timingSafeEqual`
- `app/api/integrations/webhooks/uber-eats/route.ts`: `X-Uber-Signature` verification + `last_webhook_at` update
- `app/api/integrations/webhooks/doordash/route.ts`: `X-DoorDash-Signature` verification + `last_webhook_at` update

Canonical paths (additional Phase 5):

- `src/features/integrations/server/webhook-crypto.ts`
- `app/api/integrations/sync/cron/route.ts`
- `app/api/integrations/webhooks/uber-eats/route.ts`
- `app/api/integrations/webhooks/doordash/route.ts`

Connection health indicators (Phase 6 complete):

- `IncomeProviderConnectionCard.syncStale`: true if connected with no sync or >24h since last sync (`SYNC_STALE_THRESHOLD_MS`)
- `IncomeProviderConnectionCard.lastErrorMessage`: populated from `connection.last_error_message` when status is `error`
- `IncomeProviderConnectCard.tsx`: renders `Sync Stale` warning badge, "no sync run yet" prompt, and error message
- `provider-catalog.ts` computes both fields from DB connection state at card-build time

Production hardening (Phase 7 complete):

- Token expiry guard in `runProviderManualSync`: checks `token_expires_at <= now` → calls `markIncomeConnectionExpired` (status="expired") → throws; requires reconnect
- `markIncomeConnectionExpired` in `connections.repository.ts`: last_error_code="token_expired", status="expired"
- `INCOME_PROVIDER_OAUTH_SCOPES` in `oauth.contracts.ts`: least-privilege read-only scopes per provider
- `INCOME_TOKEN_KEY_VERSION = "v1"` with key rotation runbook in `oauth.contracts.ts`
- Security checklist fully complete (7/7)

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
- Schema-backed receipt produce decisions are active on `ReceiptLineItem` (`inventory_decision`, `inventory_decided_at`) to support explicit `yes/no/resolve later` flows
- Receipt review UI now surfaces parse-confidence indicators separately from match confidence (per-line parse badges, parse-band summary counts, inline parse flags for medium/low confidence lines)
- Receipt review UI now includes a parsed-produce checklist (`yes/no/select all/resolve later`) with auto-advance highlighting
- Receipt finalize flow now gates commit until produce decisions are explicit; only produce lines marked `add_to_inventory` can create inventory transactions
- Receipt lines marked `resolve_later` now flow into Inventory Fix Later queue as purchase-confirmation tasks
- Receipt detail now exposes an explicit `View Photo` CTA (signed URL) when a receipt image is available
- Receipt commit guardrails now validate line-to-inventory mapping eligibility at commit time to block stale/ineligible mappings
- Store-specific parse-profile memory is active via `ReceiptParseProfile` (dedicated table): correction summaries now accumulate province/tax/parse signals per store profile key (`place:<google_place_id>` preferred, fallback `supplier:<supplier_id>`)
- Profile priors are now consumed in receipt workflows when Google Place province hints are unavailable, and line-review `confirmed`/`skipped` actions feed profile stats for continuous store adaptation
- Raw-text receipt parsing now uses a hybrid section-aware parser (`src/domain/parsers/receipt.ts`) instead of regex-only extraction:
  - line section classification (items vs tax/subtotal/total/footer/meta)
  - multi-line wrapped item merge support
  - numeric cluster extraction (`qty x unit_price line_total`) and safer trailing amount parsing
  - province-hinted tax summary skipping and optional profile-guided SKU token position hints
- Historical feedback-loop priors are now outcome-aware in receipt workflow orchestration:
  - confirmed/matched review outcomes (`ReceiptLineItem.status` + `matched_item_id`) are prioritized over unresolved noise
  - fuzzy parsed-name fallback can supply priors when exact keys are missing
  - price-proximity gating suppresses weak far-distance priors before they influence correction scoring
- Rollout hardening for correction `enforce` mode is now active:
  - enforce requests are guard-checked per receipt (totals pass, tax-warn policy, low-confidence threshold)
  - failed guards automatically fall back to shadow for that receipt with explicit reason counts
  - correction/workflow diagnostics now expose requested vs effective mode and rollout-guard metrics
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
- Produce quick-search autosuggest from `produce_items` with quantity-first add-to-basket
- Receipt reconciliation / pairing
- Manual pairing fallback for unresolved barcode items
- Optional photo-assisted and web/AI suggestion flow (post-receipt authoritative phase)
- Audit metadata persistence for fallback evidence and pairing decisions
- Intake-source eligibility metadata persisted per shopping item (`resolution_audit.intake_source` + `inventory_eligibility`)
- Commit guardrail: manual and shelf-label sources are expense-only at commit time (no inventory writes)
- Expense-ledger metadata now includes `inventory_transaction_count` alongside `item_count` and ineligible-item counts
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
  - unresolved purchase confirmations (`inventory_decision=resolve_later`)
  - shopping pairing leftovers (unresolved barcode, missing-on-receipt, extra-on-receipt)
  - normalization gaps (e.g., missing category)
- Queue observability stats in UI (candidate source breakdown, queue health)
- Queue UI includes dedicated unresolved-purchase filter for faster Fix Later triage

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
- `ReceiptLineItem` (includes parse metadata + produce decision persistence)
- `ReceiptItemAlias` (store-context alias mapping)
- `ReceiptParseProfile` (store-specific parse/tax/province memory + priors)

Shopping entities:

- `ShoppingSession`
- `ShoppingSessionItem` (includes `resolution_audit`)

Restaurant table-service entities (RTS baseline):

- `DiningTable` (global unique `qr_token`; per-business unique `table_number`)
- `MenuCategory` (seeded/custom category support via `is_seeded`)
- `MenuItem` (includes `description`, `price`, and `is_available` 86 toggle)
- `TableSession` (includes `party_size`; one active session per table via DB partial unique index)
- `KitchenOrder` (exactly one order per table session; `confirmed_at`/`due_at`/`closed_at` lifecycle anchors)
- `KitchenOrderItem` (status enum: `pending`, `preparing`, `ready_to_serve`, `served`, `cancelled`)
- Shared contract baseline: `src/features/table-service/shared/table-service.contracts.ts` locks one-order-per-session and same-order append invariants.

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
8. User reviews/edits unresolved/suggested lines and completes parsed-produce checklist decisions
9. Finalize receipt review (server gate ensures produce decisions are explicit)
10. Commit eligible receipt transactions atomically (`add_to_inventory` produce lines only)
11. Learn aliases from user confirmations

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
