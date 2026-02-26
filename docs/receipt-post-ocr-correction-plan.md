# Receipt Post-OCR Correction Plan

Last updated: February 26, 2026 (draft / implementation-ready plan)

## Latest Update

- Phase 0 foundation scaffolding has been implemented (feature-flagged pass-through + observability; no numeric corrections applied yet by default).
- Phase 1 implementation has started with a first numeric-sanity slice in the domain correction core:
  - dual numeric candidate generation for integer-like and split numeric tokens (`949`, `14900`, `9 49`)
  - guarded totals-consistency outlier re-check loop (single-line candidate swap when it improves total delta)
  - line-level parse confidence/flags/correction actions now populated by the core result
- `shadow` mode behavior was corrected so corrections are computed/logged but only applied to persisted values in `enforce` mode.
- A new correction stage now runs in both receipt workflows before inventory matching:
  - raw OCR text path (`parseAndMatchReceipt(...)`)
  - TabScanner structured path (`processReceiptImage(...)`)
- Core additions already in place:
  - `src/domain/parsers/receipt-correction-core.ts` (pass-through correction core + totals-consistency observability)
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - correction-stage insertion + metrics logging in `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - fixture corpus scaffold in `test/fixtures/receipt-correction/*`
- Feature flags / modes:
  - `RECEIPT_POST_OCR_CORRECTION_ENABLED`
  - `RECEIPT_POST_OCR_CORRECTION_MODE` = `off | shadow | enforce`
- Validation already completed for the Phase 0 slice:
  - targeted `eslint` on touched receipt correction files -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS

## Pick Up Here (Next Continuation)

Start with **Phase 1 - Numeric sanity + dual interpretation**, using `shadow` mode first.

Recommended next implementation order:

1. Implement decimal enforcement and dual numeric interpretation in `src/domain/parsers/receipt-correction-core.ts`
   - examples: `949 -> 9.49`, `9 49 -> 9.49` vs `949.00` (plausibility-ranked)
2. Add high-confidence price plausibility checks + guarded auto-correction scoring
   - use historical/store context signals where available, but keep fallback heuristics safe
3. Add totals-consistency outlier re-check loop
   - if `sum(lines) + tax != total`, identify likely outlier line and retry correction candidates
4. Expand fixture corpus to 10-20 representative receipts before enabling `enforce`
   - include missing decimals, extra digits, split numeric tokens, outlier totals, coupon/discount edge cases
5. Keep production behavior risk-controlled
   - run in `shadow` first, inspect correction metrics/deltas, then promote safe rules to `enforce`

Implementation guardrails (carry forward):

- Do not overload `ReceiptLineItem.confidence` (inventory match confidence) with parse confidence.
- Keep pure correction logic in `src/domain/parsers/*`.
- Keep DB/profile/history orchestration in `src/features/receiving/receipt/server/*`.
- Insert correction stage before `resolveReceiptLineMatch(...)` in both receipt paths (already wired; extend, do not bypass).

## Goal

Improve post-OCR receipt parsing accuracy (the last 5% of numeric and structural errors) after TabScanner returns data.

Target pipeline:

1. Receipt Photo
2. TabScanner OCR
3. Raw parsed receipt data (structured line items + totals)
4. Post-OCR correction + reconciliation engine (new layer)
5. Clean structured receipt data
6. Inventory matching + user review/commit

## Scope (What This Plan Covers)

This plan improves:

- numeric sanity and auto-correction (decimal drift, extra digits, separators, `0` vs `O`)
- line-level confidence scoring (not just receipt-level)
- receipt total consistency validation (`sum(lines) + tax ~= total`)
- store-specific parsing pattern memory
- dual numeric interpretation and plausibility selection
- structured parsing/correction (not regex-only heuristics)
- historical and store-context matching to reduce repeat errors

## Non-Goals (Explicit)

This plan does not target:

- image quality improvements
- barcode scanning accuracy
- shopping mode reconciliation logic (except reusing historical prices as signals)
- TabScanner OCR vendor replacement

It is specifically for the post-OCR correction/reconciliation stage.

## Why This Plan Exists (Codebase-Overview Alignment)

This plan follows `docs/codebase-overview.md`:

- pure parsing/correction logic goes in `src/domain/*`
- receipt workflow/orchestration and DB access stay in `src/features/receiving/receipt/server/*`
- wrappers remain thin in `app/actions/modules/receipts.ts`
- docs/changelog updates are required for meaningful changes

## Current-State Pipeline (Relevant Code)

### 1. TabScanner image flow (current)

`src/features/receiving/receipt/server/receipt-workflow.service.ts`

- `processReceiptImage(...)` calls `scanReceipt(...)`
- receives TabScanner structured data (`lineItems`, `subTotal`, `tax`, `total`)
- maps TabScanner line items directly into `ResolvedLineItem` candidates
- immediately performs inventory matching (`resolveReceiptLineMatch(...)`)
- writes receipt line items to DB

Important implication:

- There is currently no dedicated correction/reconciliation stage between TabScanner output and line-item write/match.

### 2. Raw text parse flow (current)

`src/domain/parsers/receipt.ts`

- `parseReceiptText(...)` is currently regex-heavy
- skips header/footer noise via simple patterns
- extracts price/quantity with basic regex heuristics

Current limitations (matches your diagnosis):

- assumes decimal-formatted prices (`12.99`)
- no decimal auto-correction (`949 -> 9.49`)
- no line-level parse confidence
- no total-consistency reconciliation
- no store-specific structural memory
- no dual numeric interpretation

### 3. Existing assets we should reuse

- `ReceiptLineItem` table already stores per-line `confidence`/`status`, but that confidence currently represents inventory-match confidence (not parse confidence)
- `ReceiptItemAlias` + store-context aliasing already exists for repeated store lines
- `Supplier.google_place_id` is already available for store-scoped behavior
- `ItemPriceHistory` / prior `FinancialTransaction` / prior `ReceiptLineItem` can be used for price plausibility checks

## Product Outcomes (What This Will Improve)

### 1. Price accuracy

Examples fixed:

- missing decimals (`949 -> 9.49`)
- extra digits (`14900 -> 149.00` or `1.49` based on plausibility)
- `0` vs `O`
- split numeric tokens (`9 49`)
- decimal precision normalization (`12.5 -> 12.50`)

### 2. Line item extraction accuracy

Examples fixed:

- multi-line item names
- SKU misplacement
- totals/summary lines misclassified as items
- discounts misclassified as purchases

### 3. Store-specific reliability over time

Examples:

- Costco format becomes deterministic-ish
- Walmart multi-line patterns become reusable
- small local stores accumulate custom parsing profiles

### 4. Financial reconciliation integrity

Add enterprise-style validation:

- `sum(line totals) + tax ~= total`
- detect outlier lines when the equation fails
- re-run correction for likely numeric offenders

### 5. Safer automation

Use line-level confidence to decide:

- high confidence -> auto-save
- medium confidence -> auto-correct + flag
- low confidence -> require user confirmation

## Recommended Architecture (Playbook-Compliant)

## A. Pure logic (domain layer)

Place deterministic parsing/correction logic in `src/domain/parsers/*`.

Recommended new files:

```text
src/domain/parsers/
  receipt-correction-core.ts              # orchestration of correction pipeline (pure)
  receipt-numeric-sanity.ts               # decimal enforcement, numeric variants, plausibility scoring
  receipt-total-reconciliation.ts         # total consistency checks + outlier search
  receipt-structured-line-parser.ts       # token/numeric-cluster extraction (regex+structure hybrid)
  receipt-confidence.ts                   # line confidence scoring (parse confidence)
  receipt-store-patterns.ts               # store profile interpretation helpers (pure)
```

Keep `src/domain/parsers/receipt.ts` as a compatibility facade initially, then gradually delegate to the new logic.

## B. Receipt feature server (workflow + DB access)

Place store memory, historical lookups, and workflow orchestration in `src/features/receiving/receipt/server/*`.

Recommended new files:

```text
src/features/receiving/receipt/server/
  receipt-correction.contracts.ts         # server DTOs for correction candidates/results
  receipt-correction.repository.ts        # historical prices, prior lines, store profile reads/writes
  receipt-correction.service.ts           # post-OCR correction orchestration (TabScanner + raw text paths)
  receipt-parse-profile.service.ts        # store-specific profile learning/update logic
```

## C. Workflow insertion points (critical)

Insert correction stage before matching in both paths:

1. `processReceiptImage(...)` in `receipt-workflow.service.ts`
   - input: TabScanner structured result
   - run correction/reconciliation
   - then call `resolveReceiptLineMatch(...)`

2. `parseAndMatchReceipt(...)` in `receipt-workflow.service.ts`
   - input: raw OCR text
   - parse raw text -> correction/reconciliation -> matching

Do not add this logic to `app/actions/modules/receipts.ts` (wrapper must stay thin).

## Core Design: Canonical Correction Input/Output

### Canonical correction input (new internal DTO)

Normalize both sources (raw text parser, TabScanner structured output) into one internal shape before correction:

```ts
type ReceiptParsedLineCandidate = {
  source: "tabscanner" | "raw_text";
  lineIndex: number;
  rawText: string;
  parsedName: string | null;
  skuCandidate: string | null;
  quantityCandidate: number | null;
  unitCandidate: string | null;
  amountTokens: string[];          // raw numeric token strings seen on the line
  lineTotalCandidate: number | null;
  unitPriceCandidate: number | null;
  providerFields?: Record<string, unknown>; // e.g. TabScanner productCode/qty/price/lineTotal
};
```

### Canonical correction output (new internal DTO)

```ts
type CorrectedReceiptLine = {
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | null;
  unit: string | null;
  line_cost: number | null;
  unit_cost: number | null;

  parse_confidence_score: number;      // 0-1
  parse_confidence_band: "high" | "medium" | "low";
  parse_flags: string[];               // e.g. decimal_inferred, outlier_price_corrected
  correction_actions: Array<{
    type: string;
    before: string | number | null;
    after: string | number | null;
    confidence: number;
    reason: string;
  }>;
};

type ReceiptCorrectionResult = {
  lines: CorrectedReceiptLine[];
  totalsCheck: {
    subtotal_printed: number | null;
    tax_printed: number | null;
    total_printed: number | null;
    lines_sum: number | null;
    delta_to_total: number | null;
    status: "pass" | "corrected" | "warn" | "fail";
    outlier_line_numbers: number[];
  };
  storeProfileSignals: Record<string, unknown>;
};
```

## High-Impact Features (Mapped To Your Requirements)

## 1. Numeric Sanity + Auto-Correction Layer (highest impact)

### A. Decimal enforcement

When a numeric token has no decimal:

- prefer 2 decimal places from the end (`949 -> 9.49`, `1299 -> 12.99`)
- apply plausibility filters before auto-correcting

Default heuristics:

- grocery/retail line items usually `< $200`
- currency usually has 2 decimal places
- values should be positive for purchase lines

Risk control:

- auto-correct only when confidence passes threshold
- otherwise mark line `medium/low` parse confidence and flag for confirmation

### B. Price range checks (historical plausibility)

Use item/store history when available:

- store + SKU historical price range
- store + fuzzy name historical price range
- canonical inventory item + recent purchase prices

Example:

- OCR says `149.00`
- historical store/item range is `1.49-3.99`
- generate `1.49`, `14.90`, `149.00`
- choose `1.49` if total consistency and historical plausibility strongly agree

### C. Receipt total consistency check

Validate:

- `sum(line totals) + tax ~= total`
- also `subtotal ~= sum(purchase lines) +/- discounts` (phase 2+)

Use a tolerance (e.g. 1-5 cents) to allow rounding.

If mismatch:

- identify numeric outlier candidates
- re-score alternate interpretations for those lines
- pick correction set that minimizes total delta and preserves plausibility

## 2. Store-specific pattern memory

Persist store-scoped parse profile signals keyed by:

- `business_id`
- store identity (`supplier_id` and/or `google_place_id`)

Track patterns such as:

- common SKU lengths (e.g. 7-digit Costco SKUs)
- decimal formatting style confidence
- line structure shape patterns
- tax labels/patterns
- multi-line item frequency
- whether prices are reliably right-aligned/split across lines (for raw text path)

Use these profiles to:

- improve line parsing
- improve numeric correction scoring
- reduce repeated mistakes over time

## 3. Confidence scoring per line (parse confidence, separate from match confidence)

Current `ReceiptLineItem.confidence` = inventory match confidence.

We need an additional parse-confidence layer.

Score factors (examples):

- decimal detected or inferred cleanly
- line total plausible for store/item
- quantity x unit_price ~= line_total
- line structure matches store profile
- name token quality (not footer noise)
- SKU format validity for store
- consistency with receipt total equation

Outputs:

- numeric score `0-1`
- band (`high`/`medium`/`low`)
- machine-readable flags

## 4. Fuzzy name + historical matching for correction (not inventory matching replacement)

Use store-scoped receipt memory to improve parsing/correction before inventory matching:

- `store_id + sku -> prior parsed name / canonical item / price range`
- `store_id + fuzzy receipt name -> prior parsed outcome`
- price proximity as a tie-breaker

This complements (not replaces) `resolveReceiptLineMatch(...)`.

## 5. Dual numeric interpretation

For ambiguous tokens like `9 49`, `949`, `14900`, generate multiple candidates:

- `9.49`
- `94.90`
- `949.00`
- `1.49` (if OCR inserted extra zero and profile/history support it)

Select candidate using:

- price range plausibility
- quantity consistency
- total consistency
- store profile priors

## 6. Structured parsing (not regex-only)

Move toward structured line parsing:

- detect numeric clusters and token roles (SKU / qty / unit / price / total)
- detect header/footer/tax/summary sections using patterns + position
- detect multi-line item continuations
- treat TabScanner structured fields as high-signal inputs but still verifiable

Pragmatic note:

- this should be a hybrid parser (structure-first + regex helpers), not a big-bang replacement in one commit.

## Data Model Plan (Prisma)

## A. Minimal viable schema changes (recommended)

### 1. `ReceiptLineItem` additions (new parse-layer metadata)

Add fields so parse confidence/corrections are not overloaded into match confidence:

- `parse_confidence_score` `Decimal?` (0-1)
- `parse_confidence_band` enum or string (`high`/`medium`/`low`)
- `parse_flags` `Json?`
- `parse_corrections` `Json?` (applied correction actions)
- `source_sku` `String?` (normalized parsed SKU/product code if detected)

Why:

- preserves existing `confidence` field semantics for inventory matching
- enables UI review and auditability for auto-corrections

### 2. `Receipt.parsed_data` extensions (schema-light)

Continue using `parsed_data` JSON for receipt-level correction summary:

- parser version
- total consistency status
- total delta
- outlier line numbers
- source (`tabscanner`/`parsed_text`)
- correction counts

This avoids extra tables for receipt-level correction metrics in MVP.

## B. Store-specific pattern memory persistence (new table recommended)

Add a new table (suggested name):

- `ReceiptParseProfile`

Fields:

- `id`
- `business_id`
- `supplier_id` nullable
- `google_place_id` nullable
- `profile_key` (normalized store identifier)
- `signals` JSON (SKU length histogram, tax labels, line shapes, decimal patterns)
- `stats` JSON (observation counts, confidence)
- `version`
- `last_seen_at`
- `created_at`
- `updated_at`

Unique/index:

- unique `(business_id, profile_key)`
- index `(business_id, last_seen_at)`

Alternative (phase 1 schema-light):

- store profile in a new JSON column on `Supplier` if we want less schema footprint
- but a dedicated table is cleaner for versioning and parser iteration

## C. Optional future table (phase 2+)

If we need stronger observability/auditability:

- `ReceiptLineParseObservation` for capturing raw candidates and correction decisions

Not recommended for MVP due to volume/storage overhead.

## Workflow Integration Plan (Exact Insertion Points)

## 1. `processReceiptImage(...)` (TabScanner path)

Current flow:

- `scanReceipt()` -> direct mapping -> `resolveReceiptLineMatch()` -> write

Planned flow:

- `scanReceipt()`
- normalize TabScanner result into correction input
- run `correctReceiptParsedData(...)`
- match corrected lines via `resolveReceiptLineMatch(...)`
- write corrected lines + parse metadata

### Why here

This is exactly the stage you called out:

- after TabScanner
- before our matching/reconciliation engine persists structured data

## 2. `parseAndMatchReceipt(...)` (raw text path)

Current flow:

- `parseReceiptText(raw_text)` -> match -> write

Planned flow:

- `parseReceiptText(raw_text)` (legacy/basic extraction)
- normalize into correction input
- run the same correction engine
- match corrected lines
- write corrected lines + parse metadata

This gives both paths a shared correction/reconciliation layer.

## Repository/Service Responsibilities (Keep Clean Boundaries)

## Domain (`src/domain/parsers/*`) responsibilities

- numeric candidate generation and scoring
- decimal enforcement
- total reconciliation logic
- line parse confidence scoring
- structured token classification

No DB access here.

## Receipt feature server (`src/features/receiving/receipt/server/*`) responsibilities

- load store parse profile
- load historical price/matching priors
- call domain correction core
- persist updated store profile signals
- map correction results into `ResolvedLineItem` for workflow
- write parse metadata to receipt/line items

## Matching layer (`resolveReceiptLineMatch`) stays separate

Do not fold parser confidence into match confidence.

Instead:

- correction layer improves line shape/name/price before matching
- matching layer continues to produce `matched/suggested/unresolved` + match confidence

## Confidence and Auto-Correction Policy (Safety Rules)

## Proposed thresholds (initial)

- `parse_confidence >= 0.92` -> auto-apply correction silently
- `0.75 - 0.91` -> auto-apply but flag in UI (reviewable)
- `< 0.75` -> no risky correction; flag for user confirmation

These are starting points only. Tune using fixture corpus.

## Hard safety gates

Never auto-correct if:

- total consistency remains worse after correction
- no plausible candidate falls within configured range and history is weak
- correction requires multiple aggressive assumptions simultaneously
- line appears to be tax/total/discount but classifier is uncertain

## Observability Plan (Needed for Tuning)

Add parser/correction metrics (similar to existing receipt match metrics) in `receipt-workflow.service.ts`:

- receipts processed by source (`tabscanner`, `parsed_text`)
- lines corrected count
- correction types count (`decimal_inferred`, `digit_trimmed`, `dual_numeric_selected`, etc.)
- total-consistency pass rate before vs after correction
- lines flagged low parse confidence
- auto-correction acceptance rate (if user later confirms/edits)

This is essential for tuning the last 5%.

## Validation & Test Plan

## 1. Unit tests (domain correction core)

Add fixture-driven tests for:

- decimal enforcement variants
- dual numeric interpretation
- total reconciliation outlier detection
- price plausibility scoring
- confidence scoring
- section/header/footer classification

Recommended test style:

- plain Node tests for pure functions (similar to `receipt-line-core` tests)

## 2. Goldens / fixture corpus (high priority)

Create a curated fixture corpus of real/anonymized receipts:

- Costco
- Walmart
- local grocery
- restaurant supply
- small merchant edge cases

For each fixture store:

- TabScanner raw structured result (JSON)
- expected corrected line items
- expected totals consistency outcome

This is the fastest way to improve accuracy safely.

## 3. Integration tests (receipt workflow)

Test:

- `processReceiptImage()` inserts corrected lines and parse metadata
- no regression to matching statuses
- correction layer can be toggled/rolled back if needed

## 4. Manual QA scenarios

- missing decimals
- split numeric tokens
- tax/total line misclassification
- multi-line names
- repeated store receipts improving over time

## Phased Implementation Plan (Detailed)

## Phase 0 - Contracts, fixtures, and instrumentation (foundation)

Status: `[~]`

Deliverables:

- define correction input/output contracts
- add fixture corpus format and first 10-20 fixtures
- add parser observability counters (no correction yet)
- add feature flag / kill switch for correction layer

Why first:

- gives a safe baseline and measurement before changing parsing behavior

Progress notes (2026-02-26):

- Implemented a Phase 0 no-op correction core and feature service wrapper with env kill-switch/modes (`off` / `shadow` / `enforce`)
- Inserted correction-stage calls into both receipt paths (`processReceiptImage`, `parseAndMatchReceipt`) with pass-through behavior only
- Added correction observability metrics logging in `receipt-workflow.service.ts`
- Added fixture corpus scaffold + seed fixtures (not yet the full 10-20 corpus)
- Remaining for full Phase 0 completion:
  - expand fixture corpus to at least 10-20 representative receipts
  - optional feature flag surfacing/config docs for local/dev/prod environments

## Phase 1 - Numeric sanity + dual interpretation + totals check (highest ROI)

Status: `[~]`

Deliverables:

- decimal enforcement
- dual numeric interpretation
- line-level price plausibility scoring (basic heuristics)
- total consistency validation
- outlier re-check pass

Applies to:

- TabScanner path first (priority)
- raw text path second (same core)

Progress notes (2026-02-26):

- Implemented first-pass numeric sanity + dual interpretation heuristics in `src/domain/parsers/receipt-correction-core.ts`
- Added totals-consistency outlier re-check loop (guarded, candidate-scored single-line swap)
- Wired raw-text receipt totals extraction into `parseAndMatchReceipt(...)` so the shared correction core can run totals checks on parsed-text receipts when labels are present
- Expanded correction summary/metrics observability with parse-confidence band counts and parse-flag/correction-action type breakdowns (useful for `shadow` tuning)
- Added targeted `node:test` coverage for `runReceiptCorrectionCore(...)` (missing decimal, split-token recovery, totals outlier re-check scenarios)
- Remaining:
  - tune thresholds/heuristics against expanded fixture corpus
  - add/store historical plausibility signals in feature-layer orchestration
  - harden raw-text totals extraction for more label/format variants (discount-heavy and noisy OCR cases)

## Phase 2 - Line-level parse confidence and UI flags

Status: `[ ]`

Deliverables:

- parse confidence score/band per line
- parse flags and applied correction metadata
- persist parse metadata on receipt/line items
- UI indicators for low/medium parse confidence in receipt review page

Note:

- Keep inventory match confidence UI distinct from parse confidence UI

## Phase 3 - Store-specific pattern memory

Status: `[ ]`

Deliverables:

- `ReceiptParseProfile` persistence
- profile learning updates after successful parses/confirmed edits
- store profile priors used by parser/correction scoring

Expected impact:

- strong compounding improvement for repeat merchants/stores

## Phase 4 - Structured parsing upgrade (hybrid parser)

Status: `[ ]`

Deliverables:

- section detection (items vs tax/footer/summary)
- multi-line item handling
- numeric cluster classification
- SKU position inference using store profiles

Goal:

- reduce dependence on brittle regex-only parsing in `src/domain/parsers/receipt.ts`

## Phase 5 - Historical matching feedback loop

Status: `[ ]`

Deliverables:

- store + SKU memory
- store + fuzzy name + price proximity priors
- correction scoring integration with prior outcomes
- optional learning from user edits in receipt review flow

## Phase 6 - Hardening and rollout expansion

Status: `[ ]`

Deliverables:

- threshold tuning from production metrics
- parser versioning in `parsed_data`
- backfill/reparse tooling for selected historical receipts (optional)
- per-store parser profile diagnostics/admin debugging views (optional)

## Rollout Strategy (Risk-Controlled)

## 1. Feature flag first

Add a kill switch (env or module config) for correction layer:

- off -> current behavior
- on -> correction path active

## 2. Shadow mode before write mode (recommended)

Phase rollout:

1. Shadow mode:
   - run correction engine
   - do not change persisted line values
   - log deltas/metrics only
2. Assisted mode:
   - apply safe corrections
   - flag medium-risk lines for review
3. Full mode:
   - apply high-confidence corrections automatically

## 3. Store-by-store enablement (optional)

Enable by provider/store profile confidence:

- start with stores with stable formats
- delay fragile small-store patterns until profile confidence grows

## Open Decisions (Need Product/Engineering Confirmation)

1. Do we want new `ReceiptLineItem` parse metadata columns now, or phase 1 schema-light via `receipt.parsed_data` only?
2. Should `ReceiptParseProfile` be a dedicated table or a `Supplier` JSON field initially?
3. What tolerance should total-consistency checks use (`0.01`, `0.02`, `0.05`)?
4. Do discounts/coupons become first-class line types in phase 1 or phase 4?
5. Do we surface parse-confidence UI immediately, or keep it internal until thresholds stabilize?

## Implementation Notes for Future Agent/Engineer

- Follow `docs/codebase-overview.md` New Feature Implementation Playbook
- Keep pure parsing/correction logic in `src/domain/parsers/*`
- Keep DB/profile/history orchestration in `src/features/receiving/receipt/server/*`
- Do not overload `ReceiptLineItem.confidence` (inventory match confidence) with parse confidence
- Insert correction stage before `resolveReceiptLineMatch(...)` in both receipt paths
- Update `docs/codebase-changelog.md` after each meaningful slice
