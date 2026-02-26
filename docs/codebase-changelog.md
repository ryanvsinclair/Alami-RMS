# Codebase Changelog

Status: Active (living document)
Last Updated: 2026-02-26
Primary Purpose: Chronological engineering changelog and validation record.

Companion overview: `docs/codebase-overview.md`

## Agent Note (Required)

- If anything fundamentally new is implemented in how the app works, functions, or what it offers, you must also open `docs/codebase-overview.md` and update the relevant section(s) so the overview matches reality.
- Example: if the Inventory system changes enough that the current Inventory section no longer accurately describes the app, update that Inventory section in `docs/codebase-overview.md` as part of the same change.

## Changelog Usage

- Append new entries at the top (newest first).
- Record validation commands actually run (and failures/exceptions) in each entry.
- Do not delete historical entries; add corrections as new entries.

## Changelog (Append New Entries At Top)

### 2026-02-26 - Added unit tests for receipt correction core Phase 1 numeric/totals scenarios
- Scope:
  - Test coverage for the new Phase 1 post-OCR receipt correction core behavior
- What changed:
  - Added `node:test` coverage for `runReceiptCorrectionCore(...)` in `src/domain/parsers/receipt-correction-core.test.mjs`
  - Covered three high-value scenarios:
    - missing decimal inference from integer-like OCR values
    - split numeric token recovery from raw text (for example `9 49`)
    - totals-driven outlier re-check candidate swap (`14900` -> `1.49` when totals support it)
  - Updated the receipt correction plan progress notes to reflect the new targeted unit coverage
- Files changed:
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (3/3; Node emitted expected experimental/module-type warnings)
  - `npx eslint src/domain/parsers/receipt-correction-core.test.mjs --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - Tests are focused on pure correction-core behavior and avoid workflow/DB dependencies to keep iteration fast during threshold tuning.

### 2026-02-26 - Receipt correction observability expanded (confidence bands + flag/action breakdowns)
- Scope:
  - Phase 1 tuning instrumentation for post-OCR receipt correction (`shadow`/`enforce` summary visibility)
- What changed:
  - Extended `ReceiptPostOcrCorrectionSummary` with parse-confidence band counts plus parse-flag and correction-action type count maps
  - Aggregated the new counts from `core.lines` in `receipt-correction.service.ts` and included them in the receipt correction summary written to `parsed_data`
  - Rolled the new summary counts into process-local correction metrics aggregation/logging in `receipt-workflow.service.ts`
  - Added derived rates for low-parse-confidence and parse-flagged line ratios in correction metrics logs
  - Updated the receipt correction plan progress notes to reflect the observability expansion
- Files changed:
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts --quiet` -> PASS
- Notes:
  - These counts are primarily for `shadow` tuning and process-local metrics logs; no receipt line persistence schema changes were introduced in this slice.

### 2026-02-26 - Receipt post-OCR correction Phase 1 follow-up: raw-text totals extraction wired into correction stage
- Scope:
  - Raw OCR text receipt workflow integration improvement for the shared post-OCR correction engine
- What changed:
  - Added a lightweight labeled totals extractor in `receipt-workflow.service.ts` for raw OCR text (`Subtotal`, `Tax`, `Total`, and common variants)
  - Wired extracted totals into `runReceiptPostOcrCorrection(...)` from `parseAndMatchReceipt(...)`
  - This enables the Phase 1 totals-consistency outlier re-check logic to run on parsed-text receipts when printed totals can be recovered from OCR text
  - Updated the receipt post-OCR correction plan progress notes to reflect raw-text totals wiring completion
- Files changed:
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-workflow.service.ts --quiet` -> PASS
- Notes:
  - Extractor is label-driven and intentionally conservative; unlabeled/noisy totals lines will still fall back to `not_evaluated`.

### 2026-02-26 - Receipt post-OCR correction Phase 1 slice started (numeric sanity + totals outlier retry, shadow safe)
- Scope:
  - First behavior-changing implementation slice for the receipt post-OCR correction engine (Phase 1)
- What changed:
  - Replaced the receipt correction core pass-through behavior with a pure numeric sanity pipeline in `src/domain/parsers/receipt-correction-core.ts`
  - Added dual numeric candidate generation/scoring for integer-like OCR values and split numeric tokens (for example `949`, `14900`, `9 49`)
  - Added guarded totals-consistency outlier re-check selection that can swap a line to an alternate numeric candidate when it improves receipt total delta
  - Added line-level parse confidence/flags/correction actions population in the core result (still separate from inventory match confidence)
  - Fixed `shadow` mode behavior in `receipt-correction.service.ts` so corrections are computed for observability but only applied to persisted lines in `enforce` mode
  - Bumped receipt correction parser version string for observability summaries
  - Updated the receipt post-OCR correction plan doc progress notes to mark Phase 1 as started/in-progress
  - Updated the overview receipt flow to explicitly include the post-OCR correction/reconciliation stage
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/features/receiving/receipt/server/receipt-correction.service.ts --quiet` -> PASS
- Notes:
  - Raw text receipt workflow still does not pass printed totals into the correction core yet, so totals re-check is currently most effective on the TabScanner path.
  - Fixture corpus expansion and threshold tuning remain pending Phase 1 follow-up work.

### 2026-02-26 - Split overview vs changelog docs and added receipt-plan handoff sections
- Scope:
  - Documentation maintenance refactor to separate architecture overview from changelog history, plus a continuation handoff update for the receipt post-OCR correction plan
- What changed:
  - Split the old embedded changelog out of `docs/codebase-overview.md` into a dedicated `docs/codebase-changelog.md`
  - Added a required agent note at the top of `docs/codebase-changelog.md` reminding agents to also update `docs/codebase-overview.md` when fundamental app behavior/capabilities change
  - Updated `docs/codebase-overview.md` wording to reflect overview-only responsibility and point changelog instructions to `docs/codebase-changelog.md`
  - Updated plan-doc references that still pointed to the old embedded changelog location (`docs/income-integrations-onboarding-plan.md`, `docs/receipt-post-ocr-correction-plan.md`)
  - Added `Latest Update` and `Pick Up Here (Next Continuation)` sections to `docs/receipt-post-ocr-correction-plan.md` documenting the completed Phase 0 scaffolding slice and next Phase 1 steps
- Files changed:
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/receipt-post-ocr-correction-plan.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Historical changelog entries were preserved and moved intact to the new dedicated changelog file.

### 2026-02-26 - Receipt post-OCR correction Phase 0 scaffolding (feature-flagged pass-through + observability)
- Scope:
  - Initial implementation slice for the post-TabScanner receipt correction/reconciliation plan (foundation only; no parsing behavior changes yet)
- What changed:
  - Added a new domain correction core scaffold (`src/domain/parsers/receipt-correction-core.ts`) that currently runs pass-through line handling and computes receipt totals consistency observability
  - Added receipt feature correction contracts/service wrappers with env-based mode control (`off` / `shadow` / `enforce`) in `src/features/receiving/receipt/server/receipt-correction.*`
  - Inserted the correction stage into both receipt workflows before inventory matching:
    - `parseAndMatchReceipt(...)` (raw OCR text path)
    - `processReceiptImage(...)` (TabScanner structured path)
  - Added process-local receipt correction metrics logging (source/mode/totals-check status counts) in `receipt-workflow.service.ts`
  - Extended receipt `parsed_data` summary shape to include a correction summary payload (`ParsedDataSummary.correction`)
  - Added fixture corpus scaffold + seed receipt-correction fixtures under `test/fixtures/receipt-correction/*`
  - Updated the receipt post-OCR correction plan status to mark Phase 0 as partial/in-progress
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/contracts.ts`
  - `src/features/receiving/receipt/server/index.ts`
  - `test/fixtures/receipt-correction/README.md`
  - `test/fixtures/receipt-correction/costco-tabscanner-missing-decimal-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-split-numeric-token-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-total-mismatch-outlier-001.json`
  - `test/fixtures/receipt-correction/costco-tabscanner-extra-digit-001.json`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx eslint src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/contracts.ts src/features/receiving/receipt/server/index.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-correction.contracts.ts src/domain/parsers/receipt-correction-core.ts --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - This is an insertion/scaffolding slice only: no numeric auto-correction is applied yet, and line values remain unchanged by default (`RECEIPT_POST_OCR_CORRECTION_MODE=off`).

### 2026-02-26 - Added implementation plan for post-OCR receipt correction/reconciliation accuracy layer
- Scope:
  - New planning document for improving post-TabScanner receipt parsing accuracy (numeric sanity, structural parsing, confidence scoring, store memory)
- What changed:
  - Added a separate detailed implementation plan focused on the receipt processing stage after OCR and before structured line-item persistence/matching
  - Documented a playbook-compliant architecture split:
    - pure correction logic in `src/domain/parsers/*`
    - workflow/history/profile orchestration in `src/features/receiving/receipt/server/*`
  - Mapped high-impact improvements into concrete workstreams:
    - numeric sanity + decimal correction
    - dual numeric interpretation
    - receipt total consistency reconciliation
    - line-level parse confidence
    - store-specific pattern memory
    - structured (non-regex-only) parsing upgrades
  - Included exact insertion points in `receipt-workflow.service.ts` for both `processReceiptImage(...)` and `parseAndMatchReceipt(...)`
  - Added phased rollout, shadow-mode strategy, and validation/fixture plan
  - Added the new plan doc to the related historical/planning docs list in this overview
- Files changed:
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Plan is intentionally scoped to post-OCR receipt parsing/correction and excludes image-quality, barcode, and shopping-mode concerns.

### 2026-02-26 - Added implementation plan for business-type income integrations onboarding + OAuth/sync architecture
- Scope:
  - New planning document for income-provider onboarding, OAuth connections, sync, and normalization rollout
- What changed:
  - Added a detailed implementation plan covering:
    - business-type signup/onboarding UX
    - modular provider catalog and connection architecture
    - OAuth start/callback pattern with token encryption and PKCE/state handling
    - sync model (initial + incremental + webhook-triggered)
    - normalized `IncomeEvent` model and compatibility projection to existing `FinancialTransaction`
    - playbook-compliant file placement under `src/features/integrations/*` and thin wrappers in `app/*`
    - phased rollout, validation expectations, and open decisions
  - Added the new plan doc to the related historical/planning docs list in this overview
- Files changed:
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/codebase-overview.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Plan intentionally aligns with the current codebase state (existing `Business.industry_type`, `FinancialTransaction`, `ExternalSyncLog`, and home dashboard income layer refactor) to minimize migration risk.

### 2026-02-26 - Home dashboard layer feature extracted into `src/features/home/*` (playbook compliance)
- Scope:
  - Home dashboard interactive income/expense layer feature follow-up refactor for feature-module compliance
- What changed:
  - Created canonical home feature module paths: `src/features/home/server/*`, `src/features/home/ui/*`, and `src/features/home/shared/*`
  - Moved dashboard summary period/window query and aggregation workflow out of `app/actions/core/financial.ts` into `src/features/home/server/*` (repository + service)
  - Converted `app/actions/core/financial.ts#getDashboardSummary` into a thin wrapper that enforces tenant auth and delegates to the home feature service
  - Moved `HomeIncomeLayer` and `HomeTransactionsLayer` plus their UI helpers/contracts out of `app/page.tsx` into `src/features/home/ui/*`
  - Kept `app/page.tsx` as route composition/state wiring while preserving the interactive collapse/expand behavior
  - Updated architecture map + product capabilities sections in this document to include the new home feature module and canonical paths
- Files changed:
  - `src/features/home/server/dashboard-summary.repository.ts`
  - `src/features/home/server/dashboard-summary.service.ts`
  - `src/features/home/server/index.ts`
  - `src/features/home/shared/dashboard-summary.contracts.ts`
  - `src/features/home/ui/home-financial-layer.shared.tsx`
  - `src/features/home/ui/HomeIncomeLayer.tsx`
  - `src/features/home/ui/HomeTransactionsLayer.tsx`
  - `src/features/home/ui/index.ts`
  - `app/actions/core/financial.ts`
  - `app/page.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint app/page.tsx app/actions/core/financial.ts src/features/home/server/*.ts src/features/home/shared/*.ts src/features/home/ui/*.tsx src/features/home/ui/*.ts --quiet` -> baseline/pre-existing `react-hooks/set-state-in-effect` error remains in `app/page.tsx` (`setLoading(true)` inside `useEffect`)
- Notes:
  - This refactor addresses the playbook compliance gap recorded in the prior home-dashboard changelog entry.

### 2026-02-26 - Home dashboard interactive income/expense layers + income source breakdown
- Scope:
  - Home dashboard financial layers (income/expense split interaction) and dashboard summary data aggregation
- What changed:
  - Split home financial sheet into separate `HomeIncomeLayer` and `HomeTransactionsLayer` components (currently local component functions in `app/page.tsx`)
  - Added interactive layer behavior so tapping the income layer collapses the transactions layer and expands an income-source breakdown view
  - Limited the transactions layer to expense records only while the income layer surfaces income by source
  - Added business-type-aware income source ordering (e.g., restaurant prioritizes GoDaddy POS, Uber Eats, DoorDash)
  - Extended `getDashboardSummary()` to return aggregated `incomeBreakdown` grouped by transaction source for the selected period
- Files changed:
  - `app/page.tsx`
  - `app/actions/core/financial.ts`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx eslint app/page.tsx app/actions/core/financial.ts --quiet` -> baseline/pre-existing `react-hooks/set-state-in-effect` error remains in `app/page.tsx`; no new errors in `app/actions/core/financial.ts`
  - `npm run lint` -> known repo baseline noise/failures (including generated `playwright-report` assets), unchanged by this feature
- Notes:
  - Playbook compliance is partial: UI/server logic were implemented in route/action files (`app/page.tsx`, `app/actions/core/financial.ts`) instead of feature modules under `src/features/*`; follow-up extraction is recommended for strict compliance.

Entry format (recommended):
- Date
- Scope
- What changed
- Files changed
- Validation run
- Notes / caveats

### 2026-02-26 - Global design language refresh (finance-style shell with green primary)
- Scope:
  - Cross-app visual language update (dark/light theme-aware) + homepage redesign
- What changed:
  - Updated global theme tokens in `app/globals.css` for cleaner matte surfaces, softer shadows, and green-first hero accents
  - Added reusable UI surface classes (`app-control`, `app-hero-card`, `app-hero-inset`, `app-sheet`, `app-sheet-row`)
  - Updated shared `Card` and `BottomNav` components so many pages inherit the new rounded finance-app style automatically
  - Redesigned `app/page.tsx` to a green hero + rounded sheet layout while preserving existing features (period toggle, balance summary, contacts shortcut, transaction feed)
- Files changed:
  - `app/globals.css`
  - `components/ui/card.tsx`
  - `components/nav/bottom-nav.tsx`
  - `app/page.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - This pass focuses on shared surfaces + homepage; some feature pages still use local styling and may need follow-up polish to fully align with the new language.

### 2026-02-26 - Homepage UI cleanup (reduced glow and card density)
- Scope:
  - Dashboard/home page visual simplification for cleaner presentation
- What changed:
  - Removed heavy glow/gradient treatment from the top header/summary area
  - Flattened top nav controls (profile/search/reports) to a simpler surface style
  - Replaced boxed summary "stat pills" with a lighter inline summary row
  - Simplified quick action + transaction card treatments (less border/shadow intensity)
- Files changed:
  - `app/page.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - No behavior/data-loading changes; this is a presentation-only cleanup.

### 2026-02-26 - Codebase overview promoted to architecture handbook + engineering guide + changelog
- Scope:
  - Replaced the old MVP-style overview with a current-state architecture reference covering refactor outcomes, inventory intelligence features, feature placement rules, accepted exceptions, and changelog process.
- What changed:
  - Added canonical architecture map (`app`, `src/features`, `src/domain`, `src/server`, `src/shared`)
  - Added feature implementation summaries (barcode resolver, receipt aliasing, shopping reconciliation, inventory enrichment queue)
  - Added explicit rules for future engineers on where new code must go
  - Added accepted exceptions/validation gaps and operational notes
  - Added changelog process and backfilled historical milestone summaries below
- Files changed:
  - `docs/codebase-overview.md`
- Validation run:
  - Documentation update only (no new code validation commands run)
- Notes:
  - This file is now expected to be updated after every meaningful change.

### 2026-02-26 - Fixed Inventory page client-bundle server import leak (`pg`/`dns` in browser build)
- Scope:
  - Inventory enrichment queue client hook/import boundaries
- What changed:
  - Moved shared inventory enrichment queue types/constants into a client-safe feature file:
    - `src/features/inventory/shared/enrichment-queue.contracts.ts`
  - Updated client UI/hook imports to use the new shared path instead of importing from `@/features/inventory/server`
  - Kept server API compatibility by re-exporting the shared contracts from `src/features/inventory/server/inventory.service.ts`
- Files changed:
  - `src/features/inventory/shared/enrichment-queue.contracts.ts`
  - `src/features/inventory/server/inventory.service.ts`
  - `src/features/inventory/ui/use-enrichment-dismissals.ts`
  - `src/features/inventory/ui/InventoryListPageClient.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/inventory/shared/enrichment-queue.contracts.ts src/features/inventory/server/inventory.service.ts src/features/inventory/ui/use-enrichment-dismissals.ts src/features/inventory/ui/InventoryListPageClient.tsx` -> PASS
  - `rg -n '@/features/inventory/server' src/features/inventory/ui` -> no matches
- Notes:
  - Root cause: `use-enrichment-dismissals.ts` imported `ENRICHMENT_SNOOZE_HOURS` from the inventory server barrel, which pulled Prisma/`pg` into the client bundle and caused the `dns` module resolution error in Next.js/Turbopack.

### 2026-02-26 - Refactor plan complete through Phase 8 (manual integrated smoke deferred)
- Scope:
  - App structure refactor final closeout
- What changed (summary from refactor playbook):
  - Route-thin + feature-first structure established across shopping/receiving/inventory/contacts/staff
  - Shared/domain/server wrapper slices and feature import cleanup completed
  - Phase 8 wrapper keep/defer matrix documented
  - Accepted exceptions finalized (shopping route large, zero wrapper removals this phase, known lint/test exceptions)
- Files changed (representative/canonical areas):
  - `src/features/*`
  - `src/domain/*`
  - `src/server/*`
  - `src/shared/*`
  - `app/actions/*` wrappers
  - `app/(dashboard)/*` route wrappers
- Validation run (recorded in refactor playbook):
  - `npx tsc --noEmit --incremental false` PASS
  - targeted tests PASS except documented Node ESM issue for `barcode-resolver-core.test.mjs`
  - `npm run lint` FAIL with known baseline exceptions/noise
  - localhost HEAD route smoke PASS
- Notes:
  - Manual integrated smoke deferred to user/final QA pass.

### 2026-02-26 - Inventory Plan Phase D complete (enrichment queue)
- Scope:
  - Optional non-blocking "Fix Later" enrichment workflow
- What changed (summary from inventory plan):
  - Added derived enrichment queue in Inventory UI
  - Added client-side persistent task actions (complete/defer/snooze via localStorage)
  - Expanded sources (barcode metadata, receipt matching, shopping pairing leftovers, normalization gaps)
  - Added queue observability summaries in UI
- Canonical files:
  - `src/features/inventory/server/inventory.repository.ts`
  - `src/features/inventory/server/inventory.service.ts`
  - `src/features/inventory/server/index.ts`
  - `src/features/inventory/ui/InventoryListPageClient.tsx`
  - `src/features/inventory/ui/use-enrichment-dismissals.ts`
  - `app/actions/core/inventory.ts` (wrapper wiring)
- Validation run (recorded in inventory plan):
  - `npx tsc --noEmit --incremental false` PASS
  - targeted eslint on inventory files PASS
- Notes:
  - Server-side persistent enrichment task table intentionally deferred.

### 2026-02-26 - Inventory Plan Phase E complete (observability and hardening)
- Scope:
  - Resolver/web fallback hardening, metrics, retries, derived rates
- What changed (summary from inventory plan):
  - Web fallback hardening (timeouts/retries/cooldowns/observability)
  - Barcode provider aggregate metrics + resolver metrics
  - Barcode lookup abuse controls and cooldowns
  - Background retry scheduling for unresolved barcodes
  - Derived-rate summaries for resolver and receipt matching
- Key files (representative):
  - `lib/modules/shopping/web-fallback.ts`
  - `app/actions/core/barcode-resolver.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
- Notes:
  - Many metrics/retry mechanisms are process-local and reset on restart.

### 2026-02-26 - Inventory Plan Phases B/C complete; receipt aliasing and external barcode provider layering in production code
- Scope:
  - Barcode provider integrations and place-scoped receipt aliasing
- What changed (summary from inventory plan):
  - Implemented OFF/OBF/UPCDatabase/UPCitemdb provider layering with caching/provenance
  - Added place-scoped receipt alias mapping and matching/learning integration
  - Preserved receipt commit idempotency and tenant isolation
- Key schema/entities:
  - `GlobalBarcodeCatalog`
  - `BarcodeResolutionEvent`
  - `ReceiptItemAlias`

### 2026-02-25 to 2026-02-26 - Major architecture transition completed (historical backfill summary)
- Scope:
  - Full route-thin, feature-first refactor and inventory intelligence rollout from plan docs
- What changed:
  - Phases 0-8 refactor plan executed and documented
  - Phases 0/A/B/C/D/E inventory plan executed and documented
  - Combined coordination plan used to sequence high-churn work safely
- Notes:
  - Detailed step-by-step logs remain in:
    - `docs/app-structure-refactor-agent-playbook.md`
    - `docs/inventoryintakeplan.md`
    - `docs/combined-plan-coordination.md`

## Changelog Entry Template (Copy / Append At Top)

```md
### YYYY-MM-DD - <short change title>
- Scope:
  - <what area changed>
- What changed:
  - <summary>
  - <summary>
- Files changed:
  - `<path>`
  - `<path>`
- Validation run:
  - `<command>` -> <PASS/FAIL + notes>
  - `<command>` -> <PASS/FAIL + notes>
- Notes:
  - <caveats / follow-up / accepted exceptions>
```
