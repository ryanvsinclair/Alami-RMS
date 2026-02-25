Deprecated - follow `docs/inventoryintakeplan.md` instead.

# Inventory Intake Plan - Phase 0 Audit (Current Repo Baseline)

Date: February 25, 2026

This document is the Phase 0 "mandatory initial evaluation" required by `docs/inventoryintakeplan.md` before structural changes (schema/provider integrations/queues).

It also captures the minimum logical extension model needed to align the plan with the current repo state.

## Scope and Plan Compliance

- Follows the order in `docs/inventoryintakeplan.md`: audit first, then propose minimal extensions, then phased implementation.
- Intentionally does not introduce schema changes or external barcode providers yet.
- Uses current repo paths after the in-progress `core/modules` refactor (for example `app/actions/modules/*`, `lib/core/*`).

## 1) Database Audit (Current State)

### Multi-tenant model (already exists)

- `Business` exists as the tenant root model in `prisma/schema.prisma:475`.
- Core operational tables already carry `business_id` (inventory, receipts, transactions, shopping):
  - `InventoryItem` in `prisma/schema.prisma:183`
  - `ItemBarcode` in `prisma/schema.prisma:213`
  - `Receipt` in `prisma/schema.prisma:243`
  - `ReceiptLineItem` in `prisma/schema.prisma:266`
  - `InventoryTransaction` in `prisma/schema.prisma:292`
  - `ShoppingSession` in `prisma/schema.prisma:326`

### Inventory entities and relationships

- Inventory master is tenant-scoped (`InventoryItem.business_id`) with aliases and barcodes:
  - `InventoryItem.barcodes` and `InventoryItem.aliases` in `prisma/schema.prisma:183`
  - `ItemBarcode` join table in `prisma/schema.prisma:213`
  - `ItemAlias` table follows immediately after (`prisma/schema.prisma`, same inventory section)
- `ItemBarcode` is currently tenant-scoped, not global:
  - `@@unique([business_id, barcode])` in `prisma/schema.prisma:213`

Implication:
- The plan statement "Barcode = global product truth" is not compatible with the current `item_barcodes` table as-is.
- A separate global barcode catalog layer is needed (logical model below), while preserving current tenant links.

### Receipt ingestion and commit pipeline (already exists)

- `Receipt` and `ReceiptLineItem` are implemented in schema:
  - `Receipt` in `prisma/schema.prisma:243`
  - `ReceiptLineItem` in `prisma/schema.prisma:266`
- Inventory transaction commit linkage already exists:
  - `InventoryTransaction.receipt_line_item_id` is unique in `prisma/schema.prisma:292`
  - This provides a strong idempotency primitive for receipt line commits.

### Shopping mode and Google Places context (already exists)

- Shopping sessions persist store context including `google_place_id`:
  - `ShoppingSession.google_place_id` in `prisma/schema.prisma:326`
- This is the correct anchor for future place-scoped receipt aliasing (Phase C).

### Product images / enrichment readiness

- Receipt images are supported on `Receipt` (`image_url`, `image_path`) in `prisma/schema.prisma:243`.
- `InventoryItem` has no item image fields in `prisma/schema.prisma:183`.

Implication:
- Product photo enrichment is currently absent for inventory items and should be treated as future extension work (not retrofitted into Phase A).

### Authorization / isolation boundaries (important)

- App-layer tenant isolation is active via `requireBusinessId()` in `lib/core/auth/tenant.ts:48`.
- Supabase SQL migration still contains MVP-wide permissive RLS policies:
  - "Authenticated users full access" policies across inventory/receipts/shopping tables in `supabase/migrations/001_initial_schema.sql:268` through `supabase/migrations/001_initial_schema.sql:398`
  - The migration comments explicitly note MVP behavior and future org scoping in `supabase/migrations/001_initial_schema.sql` (RLS section near line 265)

Implication:
- Current tenant isolation is primarily enforced in application code, not strict DB RLS policy.
- The rollout plan should call this out explicitly as a hardening track, not assume DB-level isolation is already complete.

## 2) Codebase Audit (Current State)

### Barcode scanning flow (already exists)

- Barcode ingestion action exists in `app/actions/core/ingestion.ts:14` (`ingestByBarcode`)
- It now normalizes barcode input at entry in `app/actions/core/ingestion.ts:21`
- Inventory barcode lookup is tenant-scoped in `app/actions/core/inventory.ts:172`

### Barcode normalization groundwork (recently added, Phase A-safe)

- Shared normalization + GTIN helpers exist in `lib/core/utils/barcode.ts:4`
- GTIN support/check-digit helper is present in `lib/core/utils/barcode.ts:13`
- Inventory creation now normalizes/dedupes incoming barcodes in `app/actions/core/inventory.ts:59`
- `addBarcode(...)` normalizes barcode and verifies item ownership before insert in `app/actions/core/inventory.ts:139`
- `lookupBarcode(...)` normalizes lookup input in `app/actions/core/inventory.ts:172`

### Receipt parsing and matching flow (already exists)

- Receipt parse + match pipeline exists in `app/actions/modules/receipts.ts:45` (`parseAndMatchReceipt`)
- Receipt OCR image pipeline exists in `app/actions/modules/receipts.ts:281` (`processReceiptImage`)
- Receipt line alias learning exists via `learnAlias(...)` in `app/actions/modules/receipts.ts:179` and `app/actions/modules/receipts.ts:181`

### Shopping reconciliation flow (already exists)

- Shopping receipt reconciliation exists in `app/actions/modules/shopping.ts:409`
- TabScanner shopping reconciliation flow exists in `app/actions/modules/shopping.ts:620`
- Google Places-backed store context persists throughout shopping session creation/reuse:
  - `google_place_id` usage in `app/actions/modules/shopping.ts:132`, `app/actions/modules/shopping.ts:195`, `app/actions/modules/shopping.ts:1169`

### Matching engine (tenant-wide, shared primitive)

- Tenant-wide matcher exists in `lib/core/matching/engine.ts:29` (`matchText`)
- Alias learning exists in `lib/core/matching/engine.ts:137` (`learnAlias`)
- Matching remains tenant-wide today (no place-specific alias tier yet)

### Shared resolver extraction (completed to reduce drift)

- Shared receipt-line resolver helper added in `lib/core/matching/receipt-line.ts:35`
- Status mapping is centralized with explicit profiles (`receipt` vs `shopping`) in `lib/core/matching/receipt-line.ts:23`
- Receipts and shopping line matching now both call the shared helper:
  - `app/actions/modules/receipts.ts:66`
  - `app/actions/modules/receipts.ts:333`
  - `app/actions/modules/shopping.ts:443`
  - `app/actions/modules/shopping.ts:696`

Why this matters:
- Future place-scoped aliasing can be introduced in one resolver seam instead of diverging per pipeline.

### Inventory writes / commit points (already exists)

- Generic transaction write path exists in `app/actions/core/transactions.ts` (`createTransaction`)
- Receipt commit path exists in `app/actions/core/transactions.ts:59` (`commitReceiptTransactions`)
- Receipt commit flow is already idempotency-aware (checks existing transactions by requested receipt lines before creating new ones) in `app/actions/core/transactions.ts:59`

### OCR and image storage (current behavior)

- TabScanner integration exists in `lib/modules/receipts/ocr/tabscanner.ts:41`
- Receipt image storage helpers exist in `lib/supabase/storage.ts:9` and `lib/supabase/storage.ts:33`

Important behavior note:
- OCR flows are synchronous server actions today (no queue/worker orchestration layer).

### Background jobs / queue infrastructure (missing)

- `package.json` has no queue/worker libraries and no worker scripts (`package.json:1`)
- No in-repo queue worker implementation is present in current actions/modules paths

Implication:
- Phase D/E queue and retry scheduling must be introduced as new infrastructure, not assumed.

## 3) What Can Be Reused / What Must Be Refactored / What Is Missing

### Reuse (existing primitives to build on)

- Tenant model and app-layer tenant enforcement (`Business`, `requireBusinessId`)
- Inventory master + barcode + alias schema
- Receipt records, line items, and commit pipeline
- Shopping sessions with `google_place_id`
- Tenant-wide text matcher (`matchText`) and alias learning (`learnAlias`)
- Receipt image storage and TabScanner integration

### Refactor (needed to support planned behavior safely)

- Receipt/shopping line resolution should continue to flow through a shared resolver seam (started with `lib/core/matching/receipt-line.ts`)
- Barcode lookup should move behind an internal resolver interface (Layer 0 first) before adding provider fallbacks
- Matching/alias logic should be extended in a shared service, not separately inside receipts and shopping
- Plan docs and implementation notes must distinguish app-layer tenant isolation from DB RLS hardening

### Missing entirely (for target system behavior)

- Global barcode catalog/cache (cross-tenant knowledge layer)
- Store-scoped receipt alias mapping keyed by place context
- Optional chain-level alias mapping (safely derived, not assumed)
- Provider provenance/confidence persistence for barcode resolutions
- Unresolved barcode retry/backoff tracking
- Background jobs/queue for asynchronous enrichment/retries
- Inventory item photo fields / product media storage model

## 4) Risk Assessment (Current Repo + Planned Changes)

### Highest-risk mismatches with the plan

- Global barcode truth vs current tenant barcode uniqueness:
  - Current `item_barcodes` is tenant-scoped, so reusing it as the global source of truth would break isolation and existing assumptions.
- Store-context aliasing not yet implemented:
  - If added separately to receipts and shopping flows, behavior drift is likely.
  - Shared resolver extraction reduces this risk but does not yet add place-aware aliasing.
- Tenant isolation assumptions:
  - App layer is doing most enforcement today; DB RLS remains permissive in MVP migration SQL.

### Operational risks for later phases

- Provider rate limits / cost blowups without unresolved caching + backoff
- Duplicate/partial commits if new paths bypass existing idempotent receipt commit logic
- Bad external data polluting tenant inventory without confidence gating and confirmation paths
- Queue introduction increasing complexity if attempted before stable resolver interfaces exist

## 5) Minimal Logical Extension Model (No Schema Changes Yet)

This is a logical model only. It is the minimum set of new concepts needed to implement the plan without repurposing current tenant-scoped tables.

### A. Global barcode catalog (new logical layer)

Purpose:
- Cache barcode knowledge once (including unresolved outcomes)
- Separate global product identity from tenant inventory items

Logical entity: `global_barcode_catalog`

Suggested fields (logical):
- `barcode_normalized` (unique)
- `gtin_format` (UPC-A / EAN-13 / GTIN-14 / unknown)
- `resolution_status` (`resolved`, `unresolved`, `needs_review`)
- `canonical_title`
- `brand`
- `size_text`
- `category_hint`
- `image_url` (optional external image URL only)
- `confidence`
- `source_provider` (last winning provider)
- `source_updated_at`
- `first_seen_at`
- `last_seen_at`
- `retry_after_at` (for unresolved backoff)
- `failure_count`

Notes:
- This does not replace `item_barcodes`.
- It becomes a global cache/provenance layer that tenant flows can consult before external providers.

### B. Tenant link from inventory to global barcode knowledge

Purpose:
- Preserve tenant ownership/custom naming while leveraging shared barcode knowledge

Logical entity: `business_barcode_link`

Suggested fields (logical):
- `business_id`
- `inventory_item_id`
- `barcode_normalized`
- `global_barcode_catalog_id` (nullable until resolved)
- `link_source` (`barcode_scan`, `receipt_confirm`, `manual`)
- `confirmed_by_user` (boolean)
- `created_at`
- `updated_at`

Notes:
- Existing `item_barcodes` can remain as the operational tenant lookup during migration.
- A future schema design can either:
  - keep `item_barcodes` and add a link to global cache, or
  - introduce a new table and migrate reads behind a resolver.

### C. Store-scoped receipt alias mapping (place-aware)

Purpose:
- Treat receipt identifiers/descriptions as store-context aliases, not global IDs

Logical entity: `receipt_alias_store_map`

Suggested fields (logical):
- `business_id`
- `google_place_id`
- `alias_key` (normalized receipt line identifier/text, optionally including parsed product code)
- `inventory_item_id` (tenant-specific resolved item)
- `barcode_normalized` (optional, if confirmed via barcode)
- `confidence`
- `times_seen`
- `last_price`
- `last_seen_at`
- `created_by` (`user_confirm`, `auto_from_barcode`, `migration`)

Uniqueness (logical):
- unique on (`business_id`, `google_place_id`, `alias_key`)

Notes:
- This is the primary new entity required for the plan's Phase C behavior.
- It should be checked before tenant-wide `matchText`.

### D. Optional chain-level alias mapping (deferred, only if safe)

Purpose:
- Reuse alias mappings across stores in the same chain only when stability is demonstrated

Logical entity: `receipt_alias_chain_map` (optional, later phase)

Suggested fields (logical):
- `business_id`
- `chain_key`
- `alias_key`
- `inventory_item_id` or `barcode_normalized`
- `stability_score`
- `promoted_from_store_alias_count`

Notes:
- Defer until chain identity rules are reliable.
- Do not block store-level alias mapping on this.

### E. Barcode resolution provenance / attempts (minimal)

Purpose:
- Support confidence, debugging, and cost control without storing full provider payloads by default

Logical entity: `barcode_resolution_event`

Suggested fields (logical):
- `barcode_normalized`
- `provider`
- `outcome` (`hit`, `miss`, `error`, `throttled`)
- `confidence`
- `normalized_fields_snapshot` (small normalized payload)
- `error_code`
- `duration_ms`
- `created_at`

Notes:
- Raw payload storage should be optional and sampled/limited.
- Start with normalized fields + provenance metadata.

### F. Optional enrichment task tracking (queue-ready, not queue-dependent)

Purpose:
- Track non-blocking follow-up work without requiring workers on day one

Logical entity: `product_enrichment_task`

Suggested fields (logical):
- `business_id`
- `inventory_item_id` (optional)
- `barcode_normalized` (optional)
- `task_type` (`add_photo`, `confirm_brand`, `confirm_size`, `confirm_category`)
- `status` (`open`, `done`, `dismissed`)
- `priority`
- `created_at`
- `resolved_at`

Notes:
- Can be created synchronously in app flows even before a queue exists.

## 6) Updated Phase Sequencing (Aligned to Current Repo)

### Phase 0 (now)

- Complete this audit and extension model (this document)
- Confirm acceptance of the logical model before schema edits

### Phase A (safe internal layer, no external providers)

- Keep current tenant barcode tables working
- Introduce an internal barcode resolver interface (Layer 0 only)
- Route barcode ingestion through the resolver interface using current normalized tenant lookup
- Persist unresolved outcomes only when a schema design is approved

Acceptance criteria:
- Existing barcode scan UX unchanged
- No schema-breaking changes
- Resolver is pluggable for future providers

### Phase B (provider layering)

- Add provider adapters behind the resolver interface
- Add timeouts/throttling/backoff
- Cache unresolved results to avoid repeated misses

Prereq:
- Approved schema for global barcode cache/provenance

### Phase C (receipt alias mapping with Google Places context)

- Extend shared receipt-line resolver to check place-scoped alias map first
- Reuse in both receipts and shopping flows (same resolver seam)
- Write alias on user-confirmed barcode resolution

Acceptance criteria:
- Store-specific aliasing reduces repeat manual match work
- Receipts and shopping use identical alias-resolution path

### Phase D/E (enrichment + observability + hardening)

- Add optional enrichment task tracking/UI
- Add metrics and retry scheduling
- Explicitly harden DB RLS (separate track from app-layer enforcement)

## 7) Recommended Immediate Next Implementation Chunk (After This Doc)

Implement the internal barcode resolver interface (Layer 0 only) and route `ingestByBarcode(...)` through it, while preserving:

- current normalized tenant lookup behavior (`app/actions/core/ingestion.ts:21`, `app/actions/core/inventory.ts:172`)
- current tenant-scoped barcode storage semantics (`prisma/schema.prisma:213`)
- current action return contract for UI compatibility

This keeps us aligned with `docs/inventoryintakeplan.md` Phase A while respecting the Phase 0 audit gate.
