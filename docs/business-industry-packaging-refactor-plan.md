# Business Modules and Industry Packaging Refactor Plan

Status: ACTIVE - restaurant launch track in progress
Created: 2026-02-28
Last Updated: 2026-02-28
Primary Purpose: define canonical industry packaging and execute the restaurant launch intake slice.

## Compressed Invariant Block (Always In Scope)

- Launch target: `restaurant` full support first.
- Other industries are continuation scope, not launch blockers.
- No product forks; use shared engines with industry configuration.
- Receipts never auto-create inventory.
- Inventory writes are explicit and eligibility-gated.
- Unresolved parsed produce must route to Inventory Fix Later.
- No silent scope expansion; use deviation proposal workflow.
- Any UI-touching tasks in this plan must follow `docs/execution-constitution.md` UI and UX rules.

Constitution source: `docs/execution-constitution.md`

## Latest Update

- **2026-02-28 - RPK-03 completed (receipt direct-commit gate + parsed-produce checklist decisions).**
  - Constitution Restatement logged for `RPK-03`: scope limited to receipt review/commit decision flow and additive persistence only.
  - Added additive receipt-line decision schema (`ReceiptInventoryDecision`, `inventory_decided_at`) for explicit produce decisions.
  - Replaced direct client commit payload flow with `finalizeReceiptReview` server action.
  - Added server-side gating so produce lines require explicit decision before commit.
  - Added parsed-produce checklist UI with `yes` / `no` / `resolve later` actions, plus `select all yes/no`.
  - Added auto-advance highlight behavior to move through pending produce decisions.
  - Preserved parse/review UX and expense-only behavior by allowing finalize with zero inventory writes when all produce lines are marked `no` or `resolve later`.

- **2026-02-28 - RPK-02 completed (shopping source eligibility + produce autosuggest + expense-only enforcement).**
  - Added produce quick-search autosuggest in shopping mode with quantity-first add path.
  - Tagged shopping items with canonical `intake_source` + `inventory_eligibility` metadata at creation time.
  - Enforced launch policy in commit flow: `manual_entry` and `shelf_label_scan` sources remain expense-only (no inventory writes), while barcode/produce-confirmed paths remain inventory-eligible.
  - Added `searchProduceCatalog` server action for EN produce lookup from `produce_items`.

- **2026-02-28 - RPK-01 completed (restaurant signup place capture + business profile persistence).**
  - Kept `industry_type` as canonical signup driver (unchanged path).
  - Added optional restaurant place capture fields in signup (`google_place_id`, address, latitude, longitude) with explicit skip behavior.
  - Added additive business profile place metadata columns and persisted supplied values via provisioning flow.
  - `prisma migrate dev` was blocked by a pre-existing shadow-db history issue (`P3006`); used safe additive fallback:
    - generated migration SQL manually
    - applied with `prisma db execute`
    - marked applied via `prisma migrate resolve`
    - verified with `prisma migrate status`

- **2026-02-28 - RPK-00 contracts baseline completed (launch map + intake invariants + source eligibility vocabulary).**
  - Constitution Restatement logged for `RPK-00`: scope limited to contract/config additions only (no runtime flow rewiring).
  - Added `INDUSTRY_LAUNCH_SUPPORT_MAP` (`restaurant=full`, others=`planned`) in shared presets.
  - Added canonical intake invariants and `intake_source` / `inventory_eligibility` contract types in intake shared contracts.
  - Synced source-of-truth docs and advanced pickup pointer to `RPK-01-a`.

- **2026-02-28 - RPK preflight file targets locked (RPK-01 through RPK-05).**
  - Ran codebase preflight search and embedded exact file targets per phase to remove discovery stalls.

- **2026-02-28 - UI and UX constitution linkage added.**
  - Added explicit UI-governance requirement for any UI-touching tasks in this plan.

- **2026-02-28 - Execution format normalized.**
  - Converted this plan to explicit in-progress/checklist phase format.
  - Aligned execution IDs to master plan (`RPK-00` through `RPK-05`).
  - Added mandatory restatement, deviation control, and expanded validation gates.

## Pick Up Here

- Current phase: `RPK-04`
- Current task: `RPK-04-a`
- Status: `[ ]` pending

## Scope and Launch Posture

This plan tracks two tracks:

1. Track A: launch-critical restaurant packaging + intake behavior.
2. Track B: post-launch multi-industry continuation.

Launch support policy:

- `restaurant`: full support at launch.
- `salon`, `retail`, `contractor`, `general`: planned post-launch.

## Current Implementation Baseline (As-Is)

Business identity and tenancy:

- tenant root: `Business`
- business type: `Business.industry_type`
- per-business modules: `BusinessModule`
- tenant scoping via `business_id`

Provisioning and signup:

- signup captures `industry_type`
- provisioning uses `INDUSTRY_PRESETS`
- owner membership + default module provisioning exists

Current module/context infrastructure:

- module registry centered on `shopping`, `receipts`, `integrations`
- `requireModule(...)` and `isModuleEnabled(...)` guards exist
- dashboard context carries `industryType`, `enabledModules`, terminology

## RPK Preflight File Targets (Locked)

These paths are the execution starting points for Track A work.

### RPK-01 - Signup and business context alignment

- `app/auth/signup/page.tsx`
- `app/actions/core/auth.ts`
- `lib/core/auth/tenant.ts`
- `src/server/auth/tenant.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*` (new migration for business place metadata fields, if schema change required)

### RPK-02 - Shopping core intake behavior

- `app/(dashboard)/shopping/page.tsx`
- `src/features/shopping/ui/use-shopping-session.ts`
- `app/actions/modules/shopping.ts`
- `src/features/shopping/server/contracts.ts`
- `src/features/shopping/server/session-state.service.ts`
- `src/features/shopping/server/commit.service.ts`
- `src/features/shopping/server/receipt-reconcile.service.ts`
- `src/features/receiving/receipt/server/receipt-produce-lookup.service.ts` (existing produce lookup data source)
- `src/features/shopping/server/produce-search.service.ts` (new, if introduced for shopping autosuggest)

### RPK-03 - Receipt decoupling and confirmation flow

- `app/actions/core/transactions.ts`
- `app/actions/modules/receipts.ts`
- `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx`
- `src/features/shopping/ui/use-shopping-session.ts`
- `app/(dashboard)/shopping/page.tsx`
- `src/features/receiving/receipt/server/receipt-workflow.service.ts`
- `src/features/shopping/server/receipt-reconcile.service.ts`

### RPK-04 - Inventory Fix Later integration

- `src/features/inventory/shared/enrichment-queue.contracts.ts`
- `src/features/inventory/server/inventory.service.ts`
- `app/actions/core/inventory.ts`
- `src/features/inventory/ui/InventoryListPageClient.tsx`
- `src/features/inventory/ui/use-enrichment-dismissals.ts`

### RPK-05 - Receipt photo visibility and commit guardrails

- `src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx`
- `src/features/home/ui/HomeTransactionsLayer.tsx`
- `app/actions/core/transactions.ts`
- `src/features/shopping/server/commit.service.ts`
- `app/(dashboard)/shopping/orders/[id]/page.tsx`

## Strategic Industry Packaging Matrix (Target)

Restaurant:

- Core: receipts, shopping, inventory, schedule, integrations
- Emphasis: stock/supplies framing, sales/purchases language
- Additional needs: low-stock alerts, ingredient usage, vendor performance, COGS, delivery reconciliation

Salon/Barbershop:

- Core: schedule-first, appointments intake, receipts, product inventory, booking/payment integrations

Retail:

- Core: inventory-first, receipts, shopping, light schedule, POS/accounting integrations

Contractor:

- Core: jobs schedule, projects intake, receipts, materials inventory, accounting integrations

General/Solo:

- Core: receipts + money tracking, tax-first simplicity

## Phase Status Ledger

- `RPK-00`: `[x]` completed
- `RPK-01`: `[x]` completed
- `RPK-02`: `[x]` completed
- `RPK-03`: `[x]` completed
- `RPK-04`: `[ ]` pending
- `RPK-05`: `[ ]` pending
- `Track B`: `[ ]` queued post-launch

## Mandatory Restatement Before Phase Work

Before starting any checklist item in this plan:

- [ ] Paste `Constitution Restatement` template from `docs/execution-constitution.md` into session/job summary.
- [ ] Confirm scope sentence references exact `RPK-*` task ID.

## Track A - Restaurant Launch Execution Checklist

### RPK-00 - Contract lock and launch support map

**Status:** `[x]` completed

- [x] RPK-00-0: Constitution restatement logged for this phase and no deviation required.
- [x] RPK-00-a: Add explicit launch support map (`restaurant=full`, others planned).
- [x] RPK-00-b: Lock global intake invariants in shared contracts.
- [x] RPK-00-c: Define intake source and eligibility contract types.
- [x] RPK-00-d: Sync source-of-truth contract docs and references.

### RPK-01 - Signup and business context alignment

**Status:** `[x]` completed

- [x] RPK-01-0: Constitution restatement logged for this phase and no deviation required.
- [x] RPK-01-a: Keep industry selection path as canonical signup input.
- [x] RPK-01-b: Add optional Google Place capture for restaurant signup with explicit skip.
- [x] RPK-01-c: Persist place metadata on business profile when provided.
- [x] RPK-01-d: Verify non-restaurant signup behavior is unchanged.

### RPK-02 - Shopping core intake behavior

**Status:** `[x]` completed

- [x] RPK-02-0: Constitution restatement logged for this phase and no deviation required.
- [x] RPK-02-a: Keep barcode scan as explicit inventory-eligible intake source.
- [x] RPK-02-b: Implement produce quick search autosuggest in shopping mode.
- [x] RPK-02-c: Add quantity-first add-to-cart flow from produce search.
- [x] RPK-02-d: Mark produce-search-added items as inventory-eligible.
- [x] RPK-02-e: Enforce manual/shelf-label launch policy as expense-only.

### RPK-03 - Receipt decoupling and confirmation flow

**Status:** `[x]` completed

- [x] RPK-03-0: Constitution restatement logged for this phase and no deviation required.
- [x] RPK-03-a: Remove or gate receipt direct-commit inventory behavior.
- [x] RPK-03-b: Keep receipt parse/review and expense posting path intact.
- [x] RPK-03-c: Add parsed-produce checklist dialog for not-yet-added items.
- [x] RPK-03-d: Add actions `yes`, `no`, `select all`, `resolve later`.
- [x] RPK-03-e: Auto-advance highlight behavior after each decision.

### RPK-04 - Inventory Fix Later integration

**Status:** `[ ]` pending

- [ ] RPK-04-0: Constitution restatement logged for this phase and no deviation required.
- [ ] RPK-04-a: Extend Fix Later task taxonomy for unresolved purchase confirmations.
- [ ] RPK-04-b: Add inventory queue surface/filter for unresolved purchase tasks.
- [ ] RPK-04-c: Ensure tasks are resolvable line-by-line later.

### RPK-05 - Receipt photo visibility and commit guardrails

**Status:** `[ ]` pending

- [ ] RPK-05-0: Constitution restatement logged for this phase and no deviation required.
- [ ] RPK-05-a: Add explicit `View Photo` CTA in digital receipt detail.
- [ ] RPK-05-b: Enforce commit eligibility to block ineligible inventory writes.
- [ ] RPK-05-c: Preserve full expense ledger behavior for all receipt lines.
- [ ] RPK-05-d: Keep idempotent commit behavior intact.
- [ ] RPK-05-e: Add launch hardening controls (feature flag/rollback switch/smoke coverage).

## Track B - Multi-Industry Continuation (Post-Launch Queue)

- [ ] B-01: Centralize packaging contracts into one matrix registry.
- [ ] B-02: Expand module metadata for prominence and relevance.
- [ ] B-03: Add industry nav priority map and default workspace behavior.
- [ ] B-04: Add feature-flag and capability maps by industry.
- [ ] B-05: Add integration recommendation maps and analytics defaults.
- [ ] B-06: Add dry-run/apply backfill alignment flow for existing businesses.

## Contracts and Interfaces to Add or Expand

- [ ] `defaultEnabledModulesByIndustry`
- [ ] `featureFlagsByIndustry`
- [ ] `industryCapabilityMatrix`
- [ ] `industryNavPriorityMap`
- [ ] `industryIntegrationRecommendationMap`
- [ ] `industryLaunchSupportMap`
- [ ] `intake_source` contract vocabulary
- [ ] `inventory_eligibility` contract vocabulary

## Validation Gate (Expanded)

A task in this plan can move to `[x]` only when all applicable checks pass:

- [ ] Targeted tests pass.
- [ ] Typecheck passes (`npx tsc --noEmit --incremental false`).
- [ ] Targeted lint passes.
- [ ] Diff size is proportional to task scope and recorded.
- [ ] No unrelated files modified by this slice.
- [ ] No new dependencies introduced, or approved deviation reference recorded.
- [ ] No new environment variables introduced, or approved deviation reference recorded.
- [ ] Scoped git commit created for each completed checklist step before advancing.
- [ ] Commit hash and title recorded in job summary/changelog.
- [ ] `Latest Update` and `Pick Up Here` synced.
- [ ] `docs/master-plan-v2.md` task status synced.
- [ ] `docs/codebase-changelog.md` entry added with touched-file log.

## Deviation Proposal Workflow

- [ ] If scope/dependency/env changes are needed, create a `Deviation Proposal` using `docs/execution-constitution.md` template.
- [ ] Mark affected task `[!]` blocked until approved.
- [ ] Do not execute deviation work before approval is recorded.

## Acceptance Criteria (Track A)

- [ ] Inventory additions are explicit-only and eligibility-gated.
- [ ] Receipts remain expense-visible without direct inventory write side effects.
- [ ] Parsed-produce checklist supports yes/no/select-all/resolve-later correctly.
- [ ] Resolve-later decisions appear in Inventory Fix Later queue and are resolvable.
- [ ] Receipt detail includes working `View Photo` CTA when image exists.

## Documentation Sync Requirements

- [ ] Update this plan status/checklists.
- [ ] Update `docs/master-plan-v2.md` status/checklists.
- [ ] Append changelog entry with a single touched-files block.
- [ ] Update `docs/codebase-overview.md` when behavior/architecture changes.
- [ ] Create one scoped git commit per completed checklist step and record commit hash in changelog.
