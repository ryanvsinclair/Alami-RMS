# Receipt Post-OCR Correction Plan

Last updated: February 27, 2026 (draft / implementation-ready plan)

## Latest Update

- **Phase 1.5 RC-12 complete: produce lookup service (PLU + fuzzy + province/language fallback)** (February 27, 2026):
  - Implemented `src/features/receiving/receipt/server/receipt-produce-lookup.service.ts`:
    - PLU-first produce lookup against `produce_items` via Prisma composite key (`plu_code`, `language_code`)
    - fuzzy produce-name lookup with trigram similarity scoring and produce-keyword gating
    - province-aware language order (`QC -> FR -> EN`, default `EN`)
    - deterministic EN fallback tracking when preferred language misses
  - Wired produce lookup into `runReceiptPostOcrCorrection(...)`:
    - applies lookup results after domain correction-core output while preserving domain purity
    - enriches corrected lines with canonical `produce_match` payload
    - appends lookup parse flags/actions for observability (`produce_lookup_plu_match`, `produce_lookup_name_fuzzy_match`, `produce_lookup_language_fallback_en`)
    - refreshes correction stats after lookup enrichment so summary counts remain accurate in `shadow`/`enforce` modes
  - Added targeted service-layer regression tests:
    - `src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs`
    - covers Quebec preferred-language behavior, EN fallback on PLU miss, fuzzy-name match path, and non-produce skip guard
  - Validation:
    - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction/produce-lookup files -> PASS

- **Phase 1 RC-11 complete: province hierarchy hardening + ON/QC tax assertions + raw-text totals robustness** (February 27, 2026):
  - Hardened province determination hierarchy in workflow orchestration:
    - added Google Place Details province resolution (`address_components`/`formatted_address`) when `google_place_id` exists
    - kept deterministic fallback to stored supplier address parsing when place-details resolution is unavailable
    - added in-process cache for place-id -> province lookups to reduce repeated API fetches
  - Expanded tax-focused ON/QC fixture assertions and regression coverage:
    - added ON Google-hint-overrides-QC-labels mismatch fixture
    - added ON GST-only warning fixture
    - added QC HST-only warning fixture
    - added QC TPS-only incomplete warning fixture
    - added QC French-label comma-decimal pass fixture
  - Hardened raw-text totals extraction for noisy/variant labels and amount formats:
    - added support for `Sub-Total`, `Total Due`, `Montant total`, and `Taxe` label variants
    - added robust trailing amount normalization for split numeric tokens (`9 98`) and comma-decimal inputs (`12,00`)
    - kept totals/tax extraction logic aligned across workflow and fixture harness paths
  - Validation:
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched parser/correction/workflow/fixture docs files -> PASS

- **Phase 1 RC-10 closeout: workflow-aligned historical scoring threshold tuning + fixture corpus expanded to 20 scenarios** (February 27, 2026):
  - Tuned correction-core historical plausibility scoring to require workflow-aligned sample confidence before influencing candidate scores:
    - historical score adjustments now require `sample_size >= 4` (alignment with workflow hint-generation gate)
  - Added threshold-boundary core regression coverage:
    - `sample_size: 3` no-steer expectation
    - `sample_size: 4` steer expectation
  - Expanded fixture corpus from `18` to `20` scenarios:
    - `bakery-tabscanner-history-sample3-noop-001.json`
    - `walmart-parsed-text-discount-heavy-tax13-split-token-001.json`
  - New fixture coverage includes:
    - sub-threshold historical hint no-op behavior
    - discount-heavy parsed-text flow with split numeric token correction + generic `Tax 13%` label handling
  - Validation:
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (12/12)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (21/21)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (2/2)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction-core/tests/fixture docs -> PASS

- **Phase 1 RC-10 continuation: raw-text parser noise hardening + tax assertion fixtures expanded to 18 scenarios** (February 27, 2026):
  - Hardened `parseReceiptText(...)` skip/noise filters to better suppress receipt-summary lines before correction:
    - `Sub Total`/`Subtotal`/`Grand Total` variants
    - dotted tax labels (`H.S.T.` etc.) and Quebec labels (`TPS`/`TVQ`)
    - coupon/discount header-style noise lines
  - Added fixture-harness support for machine-checkable `tax_interpretation` assertions.
  - Added targeted parser tests (`src/domain/parsers/receipt.test.mjs`) for dotted HST and TPS/TVQ skip behavior.
  - Expanded fixture corpus from `15` to `18` scenarios:
    - `ontario-parsed-text-hst-dotted-pass-001.json`
    - `quebec-parsed-text-tps-tvq-pass-001.json`
    - `grocery-parsed-text-zero-tax-subtotal-total-001.json`
  - Validation:
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (2/2)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (19/19)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched parser/correction/workflow/repository files -> PASS

- **Phase 1 RC-10 continuation: historical hint quality gates + observability + fixture expansion** (February 27, 2026):
  - Added quality gates to feature-layer historical hint derivation:
    - minimum sample size required for hint generation (`>= 4`)
    - recency lookback window for source samples (default `120` days)
  - Expanded correction observability summary with historical-hint telemetry:
    - hinted line count
    - hint sample-size totals/max
    - hinted lines applied count
  - Expanded fixture corpus from `12` to `15` receipt scenarios with additional noisy/edge inputs:
    - `market-parsed-text-hst-dotted-label-missing-decimal-001.json`
    - `grocery-parsed-text-split-token-with-subtotal-tax-001.json`
    - `bakery-tabscanner-history-low-sample-noop-001.json`
  - Fixture harness tax-label parsing now includes dotted/variant labels (`H.S.T.`, `TPS`, `TVQ`) to better mirror workflow extraction.
  - Validation:
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (16/16)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction/workflow/repository files -> PASS

- **Phase 1 RC-10 slice started: historical price plausibility wired from feature layer into correction core** (February 27, 2026):
  - Added line-level historical price hint support in `runReceiptCorrectionCore(...)` via `historical_price_hints` input.
  - Added historical plausibility scoring adjustments and guarded aggressive-candidate acceptance when historical support is strong.
  - Kept correction core pure: no DB access in domain layer; historical data is passed as input.
  - Added feature-layer orchestration in `receipt-workflow.service.ts`:
    - queries recent receipt line price samples scoped by business and supplier/place context when available
    - computes median line/unit cost per parsed name
    - injects per-line `historical_price_hints` into correction calls for both parsed-text and TabScanner flows
  - Expanded regression coverage:
    - new correction-core tests for history-guided selection and low-sample no-op behavior
    - fixture harness support for optional `historical_price_hints`
    - new fixture: `bakery-tabscanner-history-guided-decimal-001.json`
  - Validation:
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (13/13)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction/workflow/repository files -> PASS

- **Produce resolution layer added**: Section 8 documents the full produce normalization and organic handling strategy (9-prefix PLU stripping, organic keyword removal, `produce_items` Supabase lookup with language fallback). Phase 1.5 added to phased plan.
- **`produce_items` table live in Supabase**: 4,479 rows (1,544 unique PLUs, EN/FR/ES), composite PK `(plu_code, language_code)`, GIN trigram indexes on `display_name`/`commodity`/`variety`. No organic column -- organic is a transactional attribute.
- **`CorrectedReceiptLine` DTO extended**: added `plu_code`, `produce_match`, `organic_flag` fields.
- **Phase 1.5 scaffold started in code**: domain produce normalization now runs in `runReceiptCorrectionCore(...)` (9-prefix PLU normalization + organic keyword stripping + produce candidate gating), with produce fields/flags/actions populated in corrected lines and covered by tests/fixtures.
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

Continue with **Phase 1.5 persistence decision (RC-13)**.

Recommended next implementation order:

1. Resolve parse/produce metadata persistence path (schema-light vs schema-backed)
   - explicitly choose where `plu_code` / `organic_flag` / `produce_match` metadata should persist
2. Implement approved persistence path with minimal migration risk
   - if schema-backed, add migration + schema/docs sync
   - if schema-light, persist deterministic correction metadata in existing JSON summary path
3. Add focused validation for persistence behavior
   - verify metadata availability after parse/reload cycles without affecting inventory-match confidence semantics
4. Keep production behavior risk-controlled
   - remain in `shadow` first, inspect correction metrics/deltas, then promote safe rules to `enforce`

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
- province-aware tax interpretation/validation (Ontario HST vs Quebec GST/QST/TPS/TVQ)
- store-specific parsing pattern memory
- dual numeric interpretation and plausibility selection
- structured parsing/correction (not regex-only heuristics)
- historical and store-context matching to reduce repeat errors
- produce resolution via PLU normalization and `produce_items` Supabase table lookup
- organic normalization (9-prefix legacy codes, keyword stripping) as a transactional attribute separate from produce identity

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

### 6. Province-aware tax parsing and validation

Examples improved:

- Ontario receipts interpreted as single-tax HST structures (typically 13%)
- Quebec receipts interpreted as dual-tax GST + QST / TPS + TVQ structures
- tax-label parsing mistakes detected via tax math checks
- zero-rated grocery receipts (`subtotal == total`, no tax line) not falsely flagged

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
  receipt-produce-normalization.ts        # PLU 9-prefix stripping, organic keyword removal, produce candidate detection (pure)
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
  receipt-produce-lookup.service.ts       # produce_items Supabase queries (PLU lookup, fuzzy name search, language fallback)
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

  // Produce resolution fields (populated by produce normalization layer)
  plu_code: number | null;             // canonical PLU (9-prefix stripped if organic)
  produce_match: {
    display_name: string;
    commodity: string;
    variety: string | null;
    language_code: string;
    match_method: "plu" | "name_fuzzy";
  } | null;
  organic_flag: boolean;               // true if 9-prefix PLU or organic keyword detected

  parse_confidence_score: number;      // 0-1
  parse_confidence_band: "high" | "medium" | "low";
  parse_flags: string[];               // e.g. decimal_inferred, outlier_price_corrected, organic_keyword_stripped, plu_9prefix_normalized
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

## 7. Tax Interpretation Layer (Ontario & Quebec)

Purpose:

- correctly interpret receipt tax amounts/structure for Canadian businesses using province + tax labels + receipt math
- improve tax-line parsing reliability without falsely flagging valid zero-tax grocery receipts

### Province determination priority

Determine receipt province in this order:

1. Google Places / store context (`google_place_id` -> province)
2. Parsed tax-label structure (`HST` vs `GST/QST` and `TPS/TVQ`)
3. Visible receipt address text fallback (`ON`, `QC`, `Ontario`, `Quebec`)

Conflict rule:

- Google Places takes priority when available
- if Google Places is unavailable, use parsed tax structure as the primary signal

### Ontario tax rules (HST)

Province: Ontario

- tax system: HST (harmonized sales tax)
- standard rate: `13%`

Common receipt label patterns:

- `HST`
- `H.S.T.`
- `Tax 13%`
- `HST #`

Typical structure:

- `Subtotal`
- `HST 13%`
- `Total`

Interpretation rules:

- Ontario receipts typically should not show separate `GST` + `QST` lines
- if province resolves to Ontario and tax label shows `HST`, treat tax as Ontario HST candidate (`13%`)
- if province resolves to Ontario and only `GST` appears, treat as likely parsing/classification issue unless a special-case receipt pattern is confirmed
- multiple tax lines in Ontario should trigger investigation/flags (uncommon)

### Quebec tax rules (GST + QST)

Province: Quebec

- tax system: separate `GST` + `QST`
- standard rates:
  - `GST = 5%`
  - `QST = 9.975%`

Common receipt label patterns:

- `GST` / `QST`
- `TPS` (French GST)
- `TVQ` (French QST)

Typical structure:

- `Subtotal`
- `GST 5%` (or `TPS`)
- `QST 9.975%` (or `TVQ`)
- `Total`

Interpretation rules:

- Quebec receipts usually should have two tax lines
- if province resolves to Quebec and only `HST` appears, treat as likely incorrect parsing
- if province resolves to Quebec and only `GST`/`TPS` appears, treat as likely incomplete parsing
- `GST + QST` (or `TPS + TVQ`) together is the expected structure

### Tax validation logic (province-aware)

After parsing and tax-line extraction:

Ontario validation:

- if province = Ontario, expected tax is approximately `subtotal * 0.13`
- if parsed tax deviates materially:
  - re-evaluate tax-line numeric parsing
  - re-evaluate decimal placement on tax amounts and nearby summary values
  - flag for correction/review if inconsistency remains

Quebec validation:

- if province = Quebec, validate tax components separately:
  - expected `GST ~= subtotal * 0.05`
  - expected `QST ~= subtotal * 0.09975`
- if only one tax line is found or either component deviates materially:
  - re-evaluate parsing of tax labels and numeric values
  - flag structure mismatch / incomplete tax extraction

### Zero-rated grocery handling (do not over-flag)

In both Ontario and Quebec:

- if items appear to be basic groceries
- and no tax line exists
- and `subtotal == total`

then this can be valid (zero-rated sale), not a parsing error.

### Edge cases and auto-correction safety

Handle cautiously:

- mixed taxable + zero-rated items
- alcohol (taxable)
- prepared food / snacks / beverages (often taxable)
- deposits / bottle returns / environmental fees / adjustments

Never auto-correct tax values unless:

- there is a mathematical inconsistency
- province is clearly determined
- confidence exceeds threshold

### Tax decision hierarchy (final)

1. Province (`google_place_id` / Google Places)
2. Tax label structure (`HST` vs `GST/QST` or `TPS/TVQ`)
3. Tax amount mathematical validation
4. Address-text fallback (only if stronger signals are unavailable)

Objective:

- Ontario receipts reflect `13% HST` structure when applicable
- Quebec receipts reflect `5% GST + 9.975% QST` structure when applicable
- tax parsing errors are detected via mathematical reconciliation
- zero-rated groceries are not falsely flagged

## 8. Produce Resolution & Organic Normalization Layer

### Purpose

This layer ensures that produce items on receipts:

- match correctly to canonical PLU identities via the `produce_items` Supabase table
- are not broken by legacy 9-prefix organic PLU codes
- are not misparsed due to organic adjectives in item names
- resolve consistently across EN/FR/ES receipt languages
- do not interfere with numeric correction or totals validation

This step runs after numeric sanity / totals reconciliation and before inventory matching (`resolveReceiptLineMatch(...)`). It is deterministic and does not use probabilistic scoring.

### Data source: `produce_items` table (Supabase)

Canonical produce identity is stored in:

```sql
produce_items (
  plu_code        integer   not null,
  language_code   text      not null,
  category        text      not null,
  commodity       text      not null,
  variety         text,
  size_label      text,
  scientific_name text,
  display_name    text      not null,
  primary key (plu_code, language_code)
)
```

Properties:

- 1,544 unique PLUs
- EN / FR / ES language support (EN: 1,543, FR: 1,402, ES: 1,534)
- Composite PK `(plu_code, language_code)`
- GIN trigram indexes on `display_name`, `commodity`, `variety`
- No `organic` column -- organic is a transactional attribute on the receipt line, not part of produce identity

### Step A -- Legacy 9-prefix PLU normalization

If a receipt line contains a PLU code where:

- `plu_code` is 5 digits AND starts with `9`

Then:

- `base_plu = plu_code.substring(1)` (strip leading `9`)
- `organic_flag = true`

Example: `94131` -> base PLU `4131`, `organic_flag = true`

All produce lookups use the `base_plu`. The original 5-digit code is never used for identity lookup.

### Step B -- Organic keyword removal

Before fuzzy name matching, normalize the receipt line text:

1. Lowercase
2. Remove accents (NFD + strip combining marks)
3. Remove punctuation

Then strip organic indicator tokens:

| Language | Tokens to remove |
|----------|-----------------|
| English | `organic`, `org` |
| French | `bio`, `biologique`, `organique` |
| Spanish | `organico`, `orgánico`, `ecologico`, `ecológico`, `bio` |

If any token was removed: `organic_flag = true`

The cleaned name (with organic tokens removed) is used for produce lookup. This prevents "Organic Gala Apples" from failing to match "Gala Apples".

### Step C -- Produce candidate detection

Determine if a receipt line is likely produce by:

- Presence of a PLU (4-digit numeric token on the line)
- Or name matching `produce_items` `display_name` / `commodity` / `variety`
- And absence of known packaged SKU patterns (barcodes, long numeric codes)

Use structured token + numeric cluster detection, not regex-only.

### Produce lookup strategy (Supabase integration)

**Priority 1 -- PLU match (deterministic, high confidence)**

If `base_plu` exists:

```sql
SELECT * FROM produce_items
WHERE plu_code = :base_plu AND language_code = :preferred_language
```

If not found in preferred language, fallback to English:

```sql
SELECT * FROM produce_items
WHERE plu_code = :base_plu AND language_code = 'EN'
```

**Priority 2 -- Name match (fuzzy, medium confidence)**

If no PLU is available, perform normalized name search against `display_name`, `commodity`, `variety` using:

- `ILIKE` for exact substring matches
- Trigram similarity (`%` operator with `pg_trgm`) for fuzzy matches (recommended)

Language-aware preference based on store province:

- Ontario -> `EN`
- Quebec -> `FR`
- Fallback -> `EN`

If no match in preferred language, fallback to `EN` row. Never fail resolution due to language mismatch.

### Province-aware produce language preference

Determine language preference via (same hierarchy as tax interpretation):

1. Google Places province (primary)
2. Tax structure signals (secondary)
3. Address fallback (last resort)

Language selection:

- Ontario -> English
- Quebec -> French
- Else -> English

### Organic handling model

Organic is stored as a transactional attribute on the receipt line:

- `organic_flag: boolean` (on `CorrectedReceiptLine`)

It is **not** part of produce identity. Produce identity is determined solely by `plu_code`.

Matching must always occur against `base_plu` (9-prefix stripped) and cleaned name (organic keywords removed). Organic must never alter the produce identity lookup.

### Confidence behavior

| Outcome | Confidence |
|---------|-----------|
| PLU match succeeds | `high` |
| Name fuzzy match | `medium` |
| No match | fallback to inventory matching layer |

Produce parse confidence is separate from inventory match confidence (consistent with existing design principle).

### Why this layer exists

Without this step:

- `94131` would not match PLU `4131`
- "Organic Gala Apples" would fail fuzzy matching against "Gala Apples"
- Multilingual receipts (FR/ES) would degrade produce match quality
- Organic adjectives would break trigram similarity scoring

This layer ensures:

- Stable canonical identity resolution via `produce_items`
- Organic does not interfere with matching
- Multilingual produce works cleanly (FR missing ~141 PLUs -> EN fallback)
- No duplication of organic variants in the database

### Non-goals of this layer

This layer does NOT:

- Infer organic probabilistically (e.g. from price)
- Create separate organic PLU entries in `produce_items`
- Modify tax behavior
- Modify inventory matching confidence
- Replace the correction engine or `resolveReceiptLineMatch(...)`
- Modify numeric correction results or totals reconciliation

It only normalizes produce identity for safe matching and attaches `organic_flag` as a separate attribute.

### Architectural summary

- **Produce** = canonical identity via `produce_items` table
- **Organic** = transactional attribute on receipt line (`organic_flag`)
- **PLU 9-prefix** = legacy normalization rule (strip -> lookup base PLU)
- **Language** = store-context preference with EN fallback
- **Lookup** = deterministic-first (PLU), fuzzy-second (name trigram)

### Pipeline execution order

```text
OCR / TabScanner
    |
Numeric Sanity
    |
Totals Reconciliation
    |
Produce Organic Normalization     <-- this layer
    |
Produce Lookup (Supabase)         <-- this layer
    |
resolveReceiptLineMatch(...)
```

Produce resolution must:

- Not modify numeric correction results
- Not modify totals reconciliation
- Only normalize PLU and name for matching
- Attach `organic_flag` separately

## Data Model Plan (Prisma)

## A. Minimal viable schema changes (recommended)

### 1. `ReceiptLineItem` additions (new parse-layer metadata)

Add fields so parse confidence/corrections are not overloaded into match confidence:

- `parse_confidence_score` `Decimal?` (0-1)
- `parse_confidence_band` enum or string (`high`/`medium`/`low`)
- `parse_flags` `Json?`
- `parse_corrections` `Json?` (applied correction actions)
- `source_sku` `String?` (normalized parsed SKU/product code if detected)
- `plu_code` `Int?` (canonical PLU from produce resolution, 9-prefix stripped)
- `organic_flag` `Boolean?` (true if 9-prefix PLU or organic keyword detected)

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

### 3. `ProduceItem` table (already created)

The `produce_items` table is already live in Supabase with the `ProduceItem` model in `prisma/schema.prisma`:

- Composite PK `(plu_code, language_code)`
- GIN trigram indexes on `display_name`, `commodity`, `variety` (via `pg_trgm`)
- 4,479 rows seeded (1,544 unique PLUs across EN/FR/ES)
- No `organic` column -- organic is determined at receipt parse time, not stored in produce identity

This table is read-only from the application's perspective. Updates come from the IFPS PLU CSV pipeline (`scripts/normalize-plu-csv.mjs` -> `scripts/seed-produce-items.mjs`).

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
- tax-structure validation outcomes by province (`ON_HST`, `QC_GST_QST`, `unknown`, mismatch/incomplete)
- province signal source used (`google_places`, `tax_labels`, `address_fallback`)
- detected tax labels count (`HST`, `GST`, `QST`, `TPS`, `TVQ`)
- lines flagged low parse confidence
- zero-tax grocery receipts accepted vs flagged
- produce lines resolved by PLU vs fuzzy name vs unmatched
- organic flags set (9-prefix vs keyword detection)
- produce language fallback rate (preferred miss -> EN hit)
- auto-correction acceptance rate (if user later confirms/edits)

This is essential for tuning the last 5%.

## Validation & Test Plan

## 1. Unit tests (domain correction core)

Add fixture-driven tests for:

- decimal enforcement variants
- dual numeric interpretation
- total reconciliation outlier detection
- tax-label parsing (`HST`, `GST`, `QST`, `TPS`, `TVQ`)
- province inference fallback order (Google Places -> labels -> address text)
- Ontario/Quebec tax math validation (including mismatch detection)
- price plausibility scoring
- confidence scoring
- section/header/footer classification
- PLU 9-prefix normalization (`94131` -> `4131`, `organic_flag = true`)
- organic keyword removal (EN: `organic`/`org`, FR: `bio`/`biologique`/`organique`, ES: `organico`/`ecologico`/`bio`)
- produce PLU lookup with language fallback (preferred -> EN)
- fuzzy name matching with organic adjectives removed
- produce candidate detection (PLU presence vs packaged SKU exclusion)

Recommended test style:

- plain Node tests for pure functions (similar to `receipt-line-core` tests)

## 2. Goldens / fixture corpus (high priority)

Create a curated fixture corpus of real/anonymized receipts:

- Costco
- Walmart
- local grocery
- restaurant supply
- small merchant edge cases
- Ontario HST receipts (single-tax line)
- Quebec GST+QST / TPS+TVQ receipts (dual-tax lines)
- zero-rated grocery receipts (`subtotal == total`, no tax line)
- mixed taxable + zero-rated baskets
- produce-heavy receipts with PLU codes (4-digit and 5-digit organic 9-prefix)
- receipts with organic keyword produce lines ("Organic Gala Apples", "Pommes Bio", "Manzanas Organico")
- French-language produce receipts (Quebec grocery stores)

For each fixture store:

- TabScanner raw structured result (JSON)
- expected corrected line items
- expected totals consistency outcome
- expected tax interpretation outcome (province/tax structure/validation status)
- expected produce resolution outcome (PLU match, organic flag, language used)

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
- Ontario HST receipts (`HST`, `H.S.T.`, `Tax 13%`)
- Quebec receipts with `GST+QST` and French labels (`TPS` + `TVQ`)
- zero-rated grocery receipts with no tax line (`subtotal == total`)
- multi-line names
- repeated store receipts improving over time
- produce with PLU codes (including 5-digit organic 9-prefix codes)
- "Organic Gala Apples" matching to "Gala Apples" after keyword strip
- French produce receipts resolving via `produce_items` FR rows with EN fallback

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
- Expanded fixture corpus to 10 runnable JSON scenarios and added a fixture-driven `node:test` harness for correction-core regression checks
- Remaining for full Phase 0 completion:
  - optional feature flag surfacing/config docs for local/dev/prod environments

## Phase 1 - Numeric sanity + dual interpretation + totals check (highest ROI)

Status: `[~]`

Deliverables:

- decimal enforcement
- dual numeric interpretation
- line-level price plausibility scoring (basic heuristics)
- total consistency validation
- outlier re-check pass
- initial tax interpretation/validation scaffolding (Ontario HST and Quebec GST/QST/TPS/TVQ rules)

Applies to:

- TabScanner path first (priority)
- raw text path second (same core)

Progress notes (2026-02-26):

- Implemented first-pass numeric sanity + dual interpretation heuristics in `src/domain/parsers/receipt-correction-core.ts`
- Added totals-consistency outlier re-check loop (guarded, candidate-scored single-line swap)
- Wired raw-text receipt totals extraction into `parseAndMatchReceipt(...)` so the shared correction core can run totals checks on parsed-text receipts when labels are present
- Expanded correction summary/metrics observability with parse-confidence band counts and parse-flag/correction-action type breakdowns (useful for `shadow` tuning)
- Added targeted `node:test` coverage for `runReceiptCorrectionCore(...)` (missing decimal, split-token recovery, totals outlier re-check scenarios)
- Added fixture-driven regression tests that execute the receipt-correction fixture corpus end-to-end against the correction core
- Implemented an initial tax interpretation scaffold in the correction core:
  - province/tax-structure inference (`ON`/`QC`, label and address signals)
  - Ontario HST and Quebec GST+QST/TPS+TVQ math checks
  - zero-tax (`subtotal == total`) candidate handling to avoid false-positive tax warnings
  - tax interpretation summary fields surfaced in correction output/summary
- Remaining:
  - tune thresholds/heuristics against expanded fixture corpus
  - continue tuning thresholds now that historical plausibility signals are wired in feature-layer orchestration
  - harden province determination hierarchy with explicit Google Places place-details province resolution (currently uses stored supplier formatted-address signal when available)
  - add dedicated tax-focused fixtures (ON/QC + mismatch/incomplete structures) with machine-checkable `tax_interpretation` assertions
  - harden raw-text totals extraction for more label/format variants (discount-heavy and noisy OCR cases)

Progress notes (2026-02-27):

- Added feature-layer historical plausibility wiring:
  - new receipt repository query for recent line-price samples scoped by business and supplier/place context
  - workflow-layer median price hint derivation and line-level hint injection into correction core for both receipt paths
- Added correction-core support for `historical_price_hints` and history-aware candidate scoring/selection guardrails.
- Added fixture-harness support + history-guided fixture and targeted core tests.
- Added historical hint quality gates + observability expansion:
  - minimum sample size gate for hint generation (`>= 4`)
  - sample recency lookback window (120 days)
  - historical hint coverage/sample-size metrics in correction summary + periodic workflow metrics logs
- Expanded fixture corpus to 15 scenarios (history low-sample gate + noisy dotted-tax label + split-token-with-totals coverage).
- Hardened raw-text parser skip behavior for subtotal/tax summary lines and expanded tax-focused fixture assertions/corpus to 18 scenarios.
- Tuned correction-core historical plausibility scoring to require `sample_size >= 4` before applying historical score adjustments.
- Added threshold-boundary core tests (`sample_size: 3` no-op and `sample_size: 4` steer) and expanded fixture corpus to 20 scenarios.
- Completed RC-11 tax hardening slice:
  - province hint resolution now prioritizes Google Place Details (with cached lookup + address fallback)
  - added ON/QC mismatch/incomplete tax interpretation fixtures/assertions
  - hardened raw-text totals extraction for hyphenated/french labels and spaced/comma-decimal numeric formats
- Remaining in Phase 1:
  - monitor `shadow` metrics for province/tax interpretation false-positive drift and tune tolerances if needed
  - proceed to Phase 1.5 service-layer lookup completion (`RC-12`)

## Phase 1.5 - Produce resolution & organic normalization

Status: `[~]`

Deliverables:

- Implement `receipt-produce-normalization.ts` in domain layer (pure logic):
  - 9-prefix PLU stripping
  - organic keyword removal (EN/FR/ES token lists)
  - produce candidate detection (PLU presence / name matching / packaged SKU exclusion)
- Implement `receipt-produce-lookup.service.ts` in feature server layer:
  - PLU lookup against `produce_items` with language fallback
  - Fuzzy name search via trigram similarity with language preference
  - Province-aware language selection (Ontario -> EN, Quebec -> FR)
- Wire produce normalization into correction pipeline (after totals reconciliation, before `resolveReceiptLineMatch`)
- Populate `CorrectedReceiptLine.plu_code`, `produce_match`, `organic_flag` fields
- Add parse flags: `organic_keyword_stripped`, `plu_9prefix_normalized`
- Unit tests for:
  - 9-prefix stripping (`94131` -> `4131` + organic)
  - organic keyword removal across EN/FR/ES
  - PLU lookup with language fallback
  - fuzzy name matching with organic adjective interference removed
- Add produce-focused receipt fixtures (PLU lines, organic items, FR/ES produce names)

Dependencies:

- `produce_items` table already created and seeded (4,479 rows, trigram indexes live)
- Province determination from Phase 1 tax interpretation (reuse same hierarchy)

Progress notes (2026-02-27):

- Implemented a first domain-only produce normalization scaffold:
  - new pure module `src/domain/parsers/receipt-produce-normalization.ts`
  - 9-prefix PLU normalization (`94131` -> `4131`) with `plu_9prefix_normalized` flag/action
  - organic keyword stripping (EN/FR/ES token set) with `organic_keyword_stripped` flag/action
  - conservative produce candidate gating (PLU/high-signal name hints, packaged-SKU exclusion)
- Wired produce normalization into `runReceiptCorrectionCore(...)` after numeric/totals selection:
  - populates corrected line fields (`plu_code`, `organic_flag`, pass-through `produce_match`)
  - includes produce corrections in line-level `correction_actions`
- Added test coverage:
  - targeted `node:test` cases in `src/domain/parsers/receipt-correction-core.test.mjs`
  - fixture-harness support for produce assertions + produce fixture in `test/fixtures/receipt-correction/*`
- Completed RC-12 service-layer lookup slice:
  - added `receipt-produce-lookup.service.ts` (PLU exact + fuzzy produce name matching)
  - added province-aware language preference + EN fallback (`QC: FR -> EN`, default `EN`)
  - wired lookup enrichment into `runReceiptPostOcrCorrection(...)` with parse-flag/action observability
  - added targeted lookup service tests (`npx tsx --test ...`)
- Remaining:
  - persist produce metadata (`plu_code`, `organic_flag`) on `ReceiptLineItem` once schema slice is approved
  - resolve and implement RC-13 persistence decision path for parse/produce metadata

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
- stronger tax-line extraction/classification (`HST`/`GST`/`QST`/`TPS`/`TVQ`) and summary-section parsing

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
6. What tax-validation tolerances should we use for Ontario HST and Quebec GST/QST (including rounding behavior)?
7. Should interpreted province/tax structure signals be persisted in `receipt.parsed_data` only, or also in `ReceiptParseProfile` for store-learning?

## Implementation Notes for Future Agent/Engineer

- Follow `docs/codebase-overview.md` New Feature Implementation Playbook
- Keep pure parsing/correction logic in `src/domain/parsers/*`
- Keep DB/profile/history orchestration in `src/features/receiving/receipt/server/*`
- Do not overload `ReceiptLineItem.confidence` (inventory match confidence) with parse confidence
- Insert correction stage before `resolveReceiptLineMatch(...)` in both receipt paths
- Update `docs/codebase-changelog.md` after each meaningful slice
