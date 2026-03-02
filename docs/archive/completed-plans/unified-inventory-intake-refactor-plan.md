# Unified Inventory Intake Refactor Plan

Last updated: February 27, 2026
Status: COMPLETE — all phases 0–5 done

## Latest Update

### 2026-02-27 — UI-05/UI-06 complete: Phase 5 cleanup/deprecation + plan closure

- Removed all migration-era "compatibility wrapper", "UI-0x phase N", and "extends ... compatibility map" comments from all intake files.
- Files updated (comment promotion to stable language only; no logic changes):
  - `components/nav/bottom-nav.tsx`
  - `src/features/intake/ui/IntakeHubClient.tsx`
  - `src/features/intake/shared/intake.contracts.ts`
  - `src/features/intake/shared/intake-session.contracts.ts`
  - `src/features/intake/shared/intake-capability.service.ts`
  - `app/(dashboard)/intake/page.tsx`
- No functional routes removed — `/shopping` and `/receive` are full feature routes (plan non-goal: no capability removal).
- Adoption check: `/intake` is the canonical nav entry; Hub routes all intake intents; no redundant nav duplication remains.
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint` on all touched files → PASS

### 2026-02-27 — UI-04 complete: Phase 4 navigation consolidation

- Refactored `components/nav/bottom-nav.tsx`:
  - Removed standalone `/shopping` and `/receive` entry logic (now purely accessed via Hub).
  - Maintained `/shopping` dynamic active-state highlight by ensuring `/intake` illuminates when on `/intake`, `/shopping`, or `/receive` routes.
  - Cleaned up dead code (`shoppingLabel`, `receiveLabel`, `moduleId === "receipts|shopping"` checks).
  - Ensured compatibility `/shopping` and `/receive` routes remain completely intact mapping to existing pages.
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint components/nav/bottom-nav.tsx` → PASS
- No schema migration required; no broken links.

### 2026-02-27 — UI-03 complete: Phase 3 capability gating service

- Created `src/features/intake/shared/intake-capability.service.ts`:
  - `resolveIntakeCapabilities(industryType, enabledModules)`: derives active `IntakeCapability` set
    - Always-available: `manual_entry`
    - Industry-specific: per-industry capability rules (restaurant gets `produce_entry`, salon gets `invoice_entry`, etc.)
    - Module-gated: `supplier_sync` capability requires `integrations` module
  - `isIntentVisible(intent, capabilities)`: returns `true` if any of the intent's required capabilities are active
  - `resolveVisibleIntents(industryType, enabledModules)`: combines ordering + visibility into single entry point
- Refactored `src/features/intake/ui/IntakeHubClient.tsx`:
  - Removed hardcoded `INTENT_REQUIRED_MODULE` check
  - Now delegates to `resolveVisibleIntents()` — single capability-gate call, no per-intent forks
- Updated `src/features/intake/shared/index.ts` to re-export new service
- Added `src/features/intake/shared/intake-capability.service.test.mjs`: 17 unit tests (5 suites) all pass
- No schema migration required; no existing service changes
- Validation: `node --test ...intake-capability.service.test.mjs` → PASS 17/17; `npx tsc` → PASS; `npx eslint` → PASS

### 2026-02-27 — UI-02 complete: Phase 2 session orchestration adapter layer

- Created `src/features/intake/shared/intake-session.contracts.ts`:
  - `shoppingStatusToIntakeStatus`: maps `ShoppingSessionStatus` → `IntakeSessionStatus`
    - `draft→active`, `reconciling→reviewing`, `ready→reviewing`, `committed→committed`, `cancelled→archived`
  - `receiptStatusToIntakeStatus`: maps `ReceiptStatus` → `IntakeSessionStatus`
    - `pending→created`, `parsing→active`, `review→reviewing`, `committed→committed`, `failed→archived`
  - `IntakeSessionSummary` DTO: lightweight read-only projection for unified session views
  - `buildIntakeSessionRoute`: resume/continue route builder per intent (`live_purchase→/shopping`, `bulk_intake→/receive/receipt/:id`, `supplier_sync→/integrations`)
  - `deriveIntentFromSessionOrigin`: maps session origin to intake intent
- Updated `src/features/intake/shared/index.ts` to re-export new contracts
- Added `src/features/intake/shared/intake-session.contracts.test.mjs`: 18 unit tests (all pass)
- No schema migration required; no existing service changes; adapter-layer only
- Validation: `node --test ...intake-session.contracts.test.mjs` → PASS 18/18; `npx tsc` → PASS; `npx eslint` → PASS

### 2026-02-27 — UI-01 complete: Phase 1 Intake Hub shell

- Created `src/features/intake/ui/IntakeHubClient.tsx`:
  - Intent-first Hub component using `INTAKE_INTENT_ORDER_BY_INDUSTRY` for industry-aware card ordering
  - `supplier_sync` card gated on `integrations` module via `useBusinessConfig()`
  - Each card routes to the canonical existing flow: `live_purchase → /shopping`, `bulk_intake → /receive`, `supplier_sync → /integrations`
  - No behavior changes to any existing route or flow
- Created `app/(dashboard)/intake/page.tsx`: thin route wrapper
- Updated `components/nav/bottom-nav.tsx`:
  - Added `/intake` nav entry (replaced standalone `/receive` entry; Receive reachable via Hub)
  - `/shopping` nav entry preserved during migration (UI-04 consolidates)
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint` → PASS
- All existing routes (/shopping, /receive, /receive/barcode, etc.) remain fully operational

### 2026-02-27 — UI-00 complete: Phase 0 vocabulary and contracts

- Created `src/features/intake/shared/intake.contracts.ts`:
  - `INTAKE_INTENTS` tuple + `IntakeIntent` type (`live_purchase`, `bulk_intake`, `supplier_sync`)
  - `INTAKE_SESSION_STATUSES` tuple + `IntakeSessionStatus` type (`created`, `active`, `reviewing`, `committed`, `archived`)
  - `INTAKE_TERMINAL_STATUSES` set (`committed`, `archived`)
  - `INTAKE_CAPABILITIES` tuple + `IntakeCapability` type (7 capability flags)
  - `INTAKE_INTENT_ORDER_BY_INDUSTRY`: canonical intent ordering per industry type
  - `INTAKE_INTENT_LABELS`, `INTAKE_INTENT_DESCRIPTIONS`: UI display strings
  - `INTAKE_INTENT_CAPABILITIES`: per-intent capability sets
- Created `src/features/intake/shared/index.ts` — re-exports all contracts
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint` → PASS
- No schema migration required (contracts only, no DB interaction)
- All current flows remain unmodified; no behavior changes

## Pick Up Here

- PLAN COMPLETE — all phases 0–5 done. Next: QA-00 in master plan.

## Purpose

Define a product-structure refactor that unifies Shopping and Receiving into a single **Inventory Intake** system across industries.

Important constraint:

- This plan does **not** add/remove core capabilities.
- This plan does **not** change intake engine behavior by itself.
- This plan reorganizes existing capabilities by workflow intent and session model.

Downstream dependency note:

- The Schedule/Operational Calendar initiative is intentionally sequenced **after** this plan and all other active plans; see `docs/operational-calendar-schedule-plan.md`.

## Core Product Reframe

Old framing:

- Shopping (separate top-level product)
- Receive (separate top-level product)
- Input-method-first entrypoints

New framing:

- **Inventory Intake Hub** (single top-level product)
- Workflow-intent-first entrypoints
- Input methods embedded inside each workflow

## Universal Intake Paths

### A. Live Purchase

Intent:

- "I am buying right now."

Use cases:

- restaurant grocery runs
- contractor material/tool runs
- salon in-store restocking
- retail on-site replenishment

Embedded capabilities (existing features, regrouped):

- barcode capture
- produce entry
- manual add
- photo assistance
- running totals
- store context
- draft/resume

### B. Bulk Intake (Post-Purchase)

Intent:

- "I already bought this."

Use cases:

- receipt scan/upload
- invoice paperwork entry
- distributor paperwork reconciliation

Embedded capabilities:

- document parsing
- correction engine
- totals/tax validation
- review before commit

### C. Supplier Sync (Optional)

Intent:

- "Sync this source automatically."

Use cases:

- POS integrations
- distributor/vendor feeds
- delivery platform sync

Behavior:

- shown only when capability is relevant to business type and enabled rollout state

## Session-Centric Model

Introduce a unified **Inventory Intake Session** lifecycle for all paths:

1. Created
2. Active
3. Reviewing
4. Committed
5. Archived

Rules:

- Live Purchase sessions are resumable and keep store context.
- Bulk Intake sessions run parse/correction/review before commit.
- All session types feed the same downstream correction/matching/commit pipeline.

## Capability-Driven UX Model

UI should be driven by capability flags, not hardcoded route silos.

Examples:

- Restaurants: emphasize produce, receipts, supplier sync options.
- Contractors: emphasize barcode + bulk intake + supplier account workflows.
- Salons: emphasize repeat supplier sync + bulk receipt/invoice capture.
- Retail: emphasize bulk restock + invoice + SKU-level flows.

Design rule:

- users choose intent first, then methods inside that workflow.
- raw technical methods are not primary top-level navigation actions.

## Navigation and IA Target

Top-level concept:

- **Inventory Intake** replaces separate Shopping/Receive mental model.

Hub entry cards:

1. Live Purchase
2. Bulk Intake
3. Supplier Sync (conditional)

Migration posture:

- preserve existing routes during migration
- progressively shift navigation labels and entrypoints to Intake terminology
- keep compatibility wrappers/redirects until adoption is stable

## Cross-Industry Guardrails

The regrouped system must remain industry-agnostic:

- no grocery-only assumptions in core intake model
- preserve support for SKU-heavy workflows, produce workflows, and invoice-heavy workflows
- keep tax/correction/matching logic reusable across all intake intents

## Architecture Alignment (High-Level)

This refactor re-groups existing feature surfaces and engines:

- `src/features/shopping/*` -> Live Purchase intent layer
- `src/features/receiving/*` -> Bulk Intake intent layer
- `src/features/integrations/*` -> Supplier Sync intent layer
- `src/domain/parsers/*` + matching/correction pipelines -> shared intake intelligence layer

No DB table/column design is specified in this document.
Schema work, if needed later, must be handled in implementation slices with explicit migration plans.

## Migration Strategy (No Behavior Breaks)

### Phase 0 - Vocabulary and contracts

- define shared Intake terminology and intent model in docs/contracts
- keep all current flows operational

### Phase 1 - Intake Hub shell

- add unified Intake landing surface
- wire existing flows behind intent-based entry cards
- no engine behavior changes

### Phase 2 - Session unification at orchestration level

- normalize route-level state and lifecycle handling to the Intake Session model
- keep existing feature services under the hood

### Phase 3 - Capability gating

- drive visibility/order of actions from business capability rules
- avoid hardcoded per-industry route forks

### Phase 4 - Navigation consolidation

- promote Intake Hub as canonical top-level entry
- retain compatibility routes and wrappers for Shopping/Receive during transition

### Phase 5 - Cleanup and deprecation

- remove redundant navigation duplication after adoption
- preserve behavior parity and rollback controls

## Deliverables

This plan covers:

1. Updated product structure (intent-first Intake Hub)
2. Navigation change model (Shopping/Receive -> Intake framing)
3. Unified intake model (Live Purchase, Bulk Intake, Supplier Sync)
4. Session lifecycle design (Created -> Archived)
5. Capability-driven UI model (industry-aware, flag-driven)
6. Migration strategy from current structure
7. High-level architecture alignment only (no schema specifics)

## Explicit Non-Goals

- No new provider integrations are defined here.
- No parsing/correction algorithm changes are defined here.
- No table/column-level schema proposal is defined here.
- No removal of existing capabilities is allowed in this refactor.
