# Codebase Changelog

Status: Active (living document)
Last Updated: 2026-02-27
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

### 2026-02-27 - RC-10 continuation: historical hint quality gates, observability expansion, and fixture corpus growth
- Scope:
  - Receipt correction Phase 1 (RC-10) threshold-hardening continuation after initial historical plausibility wiring
- What changed:
  - Hardened feature-layer historical hint derivation:
    - added minimum sample-size gate for generated hints (`>= 4`)
    - added recency lookback filter for sampled receipt lines (default `120` days)
  - Expanded correction observability payloads/metrics:
    - historical hint line counts
    - historical hint sample-size totals/max
    - hinted lines applied counts
  - Bumped parser version label to `v1.4-numeric-tax-produce-history-gated`
  - Fixture and harness expansion:
    - added `market-parsed-text-hst-dotted-label-missing-decimal-001.json`
    - added `grocery-parsed-text-split-token-with-subtotal-tax-001.json`
    - added `bakery-tabscanner-history-low-sample-noop-001.json`
    - updated fixture harness tax-label extraction to include dotted/variant labels (`H.S.T.`, `TPS`, `TVQ`)
  - Updated RC-10 documentation status/remaining tasks in master + receipt plan docs.
- Files changed:
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `test/fixtures/receipt-correction/market-parsed-text-hst-dotted-label-missing-decimal-001.json`
  - `test/fixtures/receipt-correction/grocery-parsed-text-split-token-with-subtotal-tax-001.json`
  - `test/fixtures/receipt-correction/bakery-tabscanner-history-low-sample-noop-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (16/16; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - RC-10 remains in progress; fixture corpus now at 15 scenarios, with 18-20 target still pending before closeout.

### 2026-02-27 - RC-10 kickoff: historical price plausibility wiring for receipt correction + fixture/test expansion
- Scope:
  - Receipt post-OCR correction Phase 1 (RC-10) continuation focused on feature-layer historical plausibility signals and threshold-tuning scaffolding
- What changed:
  - Extended correction-core input/contracts:
    - added `historical_price_hints` support in `runReceiptCorrectionCore(...)`
    - added history-aware plausibility adjustments in baseline/candidate scoring
    - added guarded aggressive-candidate acceptance path only when historical support is strong
    - added parse flag `historical_price_signal_available` for observability
  - Added feature-layer historical hint orchestration (no DB access in domain core):
    - new receipt repository query to fetch recent receipt line price samples by parsed name, scoped to business and optionally supplier/place
    - workflow service now derives per-line median price hints and passes them into correction for both parsed-text and TabScanner paths
  - Expanded regression coverage:
    - added correction-core tests for history-guided candidate selection and low-sample no-op behavior
    - fixture harness now supports optional `historical_price_hints`
    - added fixture `test/fixtures/receipt-correction/bakery-tabscanner-history-guided-decimal-001.json`
  - Updated parser version string:
    - `v1.3-numeric-tax-produce-history-tuned`
  - Synced documentation:
    - receipt correction plan `Latest Update` + Phase 1 progress notes updated
    - master plan RC-10 marked in progress with latest job summary
    - overview workflow/capability sections updated for historical hint stage
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `test/fixtures/receipt-correction/bakery-tabscanner-history-guided-decimal-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (13/13; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - RC-10 remains in progress; this slice implemented historical signal wiring and first fixture expansion, with threshold tuning and broader fixture growth still pending.

### 2026-02-27 - Master plan checklist hardened with mandatory per-step scoped implementation pre-checks
- Scope:
  - Documentation/process hardening to reduce duplicate code creation risk during ongoing plan execution
- What changed:
  - Updated `docs/master-plan-v1.md` so every canonical checklist item now begins with an explicit pre-check requirement:
    - review currently implemented scoped files/logic first
    - prefer build-on/refactor/remove/move of existing scope-related code before creating new code/files
  - Added a matching session summary entry in the master plan log to make the rule visible in future handoffs
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - No runtime behavior, schema, or architecture implementation changed in this slice.

### 2026-02-27 - Created Master Plan v1 for canonical continuation order across remaining plans
- Scope:
  - Documentation coordination and execution-order consolidation across all current plan docs
- What changed:
  - Added new master tracker document:
    - `docs/master-plan-v1.md`
  - Master plan contents now include:
    - full markdown-doc inventory review snapshot
    - completed-plan ledger
    - non-completed plan review, including explicit latest-update review for open plans
    - single canonical checklist order for remaining initiatives
    - `Last Left Off Here` checkpoint block for future handoffs
    - per-session documentation sync checklist and summary template
  - Synced architecture reference:
    - added `docs/master-plan-v1.md` to related planning docs in `docs/codebase-overview.md`
    - updated overview current-status snapshot to reflect open plans (receipt correction in progress, income integrations not started)
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - No runtime behavior or schema changes were made in this slice.

### 2026-02-27 - Added sequencing-locked Operational Calendar (Schedule tab) plan
- Scope:
  - Product/system-design planning for a cross-industry Schedule tab as an Operational Calendar, with explicit start-order gating after all current active plans
- What changed:
  - Added new dedicated plan:
    - `docs/operational-calendar-schedule-plan.md`
  - Reviewed and strengthened the proposed schedule concept into an implementation-ready planning structure:
    - clarified that Schedule is an operational calendar (not single-vertical booking UI)
    - defined cross-industry event model and event types
    - defined integration/sync/dedupe/read-only policies at high level
    - defined simple no-integration mode
    - defined phased rollout and architecture layers
    - added strict sequencing gate requiring completion of existing plans (including Intake regrouping)
  - Synced planning references:
    - linked Schedule plan in `docs/codebase-overview.md`
    - added downstream dependency note in `docs/unified-inventory-intake-refactor-plan.md`
- Files changed:
  - `docs/operational-calendar-schedule-plan.md`
  - `docs/unified-inventory-intake-refactor-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - This is planning-only; no feature behavior or architecture implementation changed in this slice.

### 2026-02-27 - Added unified Inventory Intake regrouping refactor plan (planning-only, no behavior changes)
- Scope:
  - Product-structure planning update to unify Shopping + Receive under an intent-first Intake model without changing feature behavior
- What changed:
  - Added a new dedicated planning document:
    - `docs/unified-inventory-intake-refactor-plan.md`
  - Documented the requested unified model and constraints:
    - Inventory Intake Hub with three intents (`Live Purchase`, `Bulk Intake`, `Supplier Sync`)
    - capability-driven industry adaptation (restaurants, contractors, salons, retailers)
    - shared Intake Session lifecycle (`Created`, `Active`, `Reviewing`, `Committed`, `Archived`)
    - migration strategy from current Shopping/Receive structure to unified intent-based navigation
    - explicit non-goal that this is grouping/orchestration refactor only (no feature removals or behavior changes)
  - Synced doc references so planning docs remain discoverable:
    - added the new plan to `docs/codebase-overview.md` related-plans list
    - added a follow-on pointer in `docs/inventoryintakeplan.md` to avoid split-brain planning
- Files changed:
  - `docs/unified-inventory-intake-refactor-plan.md`
  - `docs/codebase-overview.md`
  - `docs/inventoryintakeplan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Current implementation remains unchanged. This entry records product/system-design planning alignment only.

### 2026-02-27 - Receipt correction Phase 1.5 scaffold: produce normalization wired into core
- Scope:
  - Initial code implementation slice for produce normalization/organic handling in the post-OCR correction pipeline
- What changed:
  - Added pure domain produce normalization module:
    - `src/domain/parsers/receipt-produce-normalization.ts`
    - 9-prefix PLU normalization (`94131` -> `4131`)
    - organic keyword stripping for EN/FR/ES tokens
    - conservative produce candidate gating (PLU/high-signal name hints + packaged SKU exclusion)
  - Wired produce normalization into `runReceiptCorrectionCore(...)` so corrected lines now populate:
    - `plu_code`
    - `organic_flag`
    - produce parse flags/actions (`plu_9prefix_normalized`, `organic_keyword_stripped`)
  - Added runtime bridge `src/domain/parsers/receipt-produce-normalization.js` so Node `--experimental-transform-types` tests resolve module imports while TypeScript remains strict
  - Extended receipt workflow/contracts pass-through shapes for produce fields (`ResolvedLineItem` optional produce fields, TabScanner-path propagation from corrected lines)
  - Expanded regression coverage:
    - added produce-focused unit tests in `src/domain/parsers/receipt-correction-core.test.mjs`
    - added fixture-harness produce assertions in `src/domain/parsers/receipt-correction-fixtures.test.mjs`
    - added produce fixture `test/fixtures/receipt-correction/grocery-parsed-text-produce-organic-plu-001.json`
  - Bumped correction parser version to `v1.2-numeric-tax-produce-normalization`
  - Updated overview/plan docs to reflect Phase 1.5 in-progress state and current implemented-vs-remaining scope
- Files changed:
  - `src/domain/parsers/receipt-produce-normalization.ts`
  - `src/domain/parsers/receipt-produce-normalization.js`
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `src/features/receiving/receipt/server/contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `test/fixtures/receipt-correction/grocery-parsed-text-produce-organic-plu-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (8/8; Node emitted expected experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (12/12; Node emitted expected experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-produce-normalization.ts src/domain/parsers/receipt-produce-normalization.js src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - This slice is intentionally domain-first. `receipt-produce-lookup.service.ts` and DB persistence fields (`ReceiptLineItem.plu_code`, `organic_flag`) remain pending follow-up schema/service work.

### 2026-02-26 - Receipt correction Phase 1 tax scaffold implemented (ON/QC interpretation + validation signals)
- Scope:
  - Initial code implementation slice for province-aware tax interpretation in the post-OCR receipt correction pipeline
- What changed:
  - Extended correction-core totals input to carry tax signal/context fields (`tax_lines`, province hint/source, address text)
  - Added tax interpretation output in `runReceiptCorrectionCore(...)` with:
    - province/source inference (`google_places`, `tax_labels`, `address_fallback`)
    - tax structure classification (`on_hst`, `qc_gst_qst`, etc.)
    - Ontario HST and Quebec GST/QST/TPS/TVQ math validation status (`pass`/`warn`/`not_evaluated`)
    - zero-tax candidate detection (`subtotal == total` with no tax lines) to reduce false-positive warnings
    - tax flags + label counts for observability
  - Wired workflow tax signals into correction calls:
    - raw-text path now extracts labeled tax lines and passes receipt text for address fallback
    - supplier `formatted_address` is now selected and used as a Google Places province hint when available
    - TabScanner path now passes generic tax lines plus province hints from supplier place context when available
  - Extended correction summary payload with tax interpretation fields (status/structure/province/source/flags/labels)
  - Added targeted correction-core tests for:
    - Ontario HST pass case
    - Quebec TPS/TVQ dual-tax pass case
    - zero-tax subtotal==total candidate handling
  - Updated overview and receipt-plan docs to reflect the implemented tax scaffold and next hardening steps
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (6/6; Node emitted expected experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (11/11; Node emitted expected experimental/module-type warnings)
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - Google Places remains primary in policy, but this slice uses stored supplier `formatted_address` as the current place-context province signal (explicit place-details province fetch can be added in a follow-up hardening step).

### 2026-02-26 - Added Ontario/Quebec tax interpretation design guidance to receipt correction plan
- Scope:
  - Planning/docs update for improving receipt tax scanning/parsing and tax validation in the post-OCR correction pipeline
- What changed:
  - Added a detailed Ontario/Quebec tax interpretation layer section to `docs/receipt-post-ocr-correction-plan.md` covering:
    - province determination priority (`google_place_id` / tax labels / address fallback)
    - Ontario HST rules (`13%`, single-tax expectations)
    - Quebec GST+QST / TPS+TVQ rules (`5%` + `9.975%`, dual-tax expectations)
    - province-aware tax math validation logic
    - zero-rated grocery handling and auto-correction safety constraints
    - final tax decision hierarchy
  - Threaded tax interpretation requirements into scope, product outcomes, observability, fixture/test guidance, manual QA scenarios, and phased roadmap/open decisions
  - Updated `test/fixtures/receipt-correction/README.md` to include tax-focused fixture guidance (Ontario HST, Quebec TPS/TVQ, zero-rated groceries, mixed baskets, mismatch cases)
- Files changed:
  - `docs/receipt-post-ocr-correction-plan.md`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - This is a planning/design addition only; no tax parsing behavior was implemented in code in this slice.

### 2026-02-26 - Expanded receipt correction fixture corpus to 10 scenarios and added fixture-driven regression tests
- Scope:
  - Phase 0/1 validation infrastructure for post-OCR receipt correction tuning
- What changed:
  - Expanded `test/fixtures/receipt-correction/*` from seed examples to 10 runnable JSON scenarios (TabScanner and parsed-text paths)
  - Added machine-checkable fixture assertions (`totals_status`, changed/outlier lines, expected corrected line costs, required parse flags)
  - Added a fixture-driven `node:test` harness in `src/domain/parsers/receipt-correction-fixtures.test.mjs` that:
    - normalizes TabScanner fixtures into parser-like line items
    - runs parsed-text fixtures through `parseReceiptText(...)`
    - infers labeled printed totals from raw text when present
    - executes `runReceiptCorrectionCore(...)` and validates fixture assertions
  - Updated fixture documentation (`test/fixtures/receipt-correction/README.md`) with the machine-checkable assertion schema
  - Corrected the existing `grocery-tabscanner-total-mismatch-outlier-001` fixture expectations to assert the intended behavior (`warn` + outlier identification) rather than an impossible totals pass
  - Updated the receipt correction plan progress notes to reflect fixture corpus expansion and fixture-driven regression coverage
- Files changed:
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `test/fixtures/receipt-correction/README.md`
  - `test/fixtures/receipt-correction/costco-tabscanner-missing-decimal-001.json`
  - `test/fixtures/receipt-correction/costco-tabscanner-extra-digit-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-total-mismatch-outlier-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-split-numeric-token-001.json`
  - `test/fixtures/receipt-correction/costco-tabscanner-missing-decimal-qty-two-001.json`
  - `test/fixtures/receipt-correction/warehouse-tabscanner-no-correction-needed-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-missing-decimal-no-totals-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-missing-decimal-with-totals-002.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-ocr-o-zero-001.json`
  - `test/fixtures/receipt-correction/localgrocer-parsed-text-no-labeled-totals-split-token-001.json`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (11/11; Node emitted expected experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (14/14; Node emitted expected experimental/module-type warnings)
  - `npx eslint src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - The fixture harness is pure/local and does not hit workflow/DB code, keeping threshold-tuning iterations fast.

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
