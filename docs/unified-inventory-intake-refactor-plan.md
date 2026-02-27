# Unified Inventory Intake Refactor Plan

Last updated: February 27, 2026 (draft / planning-only, no feature-behavior changes)

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
