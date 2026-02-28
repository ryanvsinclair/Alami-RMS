# Master Plan v2 - Canonical Restaurant Launch Refactor Tracker

Status: ACTIVE - restaurant launch major refactor in progress
Created: 2026-02-27
Last Updated: 2026-02-28
Primary Purpose: canonical sequencing and progress tracker for launch-critical restaurant refactor work.

## Compressed Invariant Block (Read First Every Session)

- Restaurant launch support is the only launch-critical target.
- No product forks; use shared engines with industry packaging.
- No silent scope expansion; use the deviation proposal workflow.
- Receipts do not auto-create inventory.
- Inventory writes are explicit and eligibility-gated.
- Unresolved parsed-produce decisions must route to Inventory Fix Later.
- RTS V1 uses one order per table session; post-confirm edits append items on the same order.
- RTS orders collapse from kitchen queue when all items are terminal and close only on host done/paid.
- UI tasks must follow design constitution: no glow/gradients/new ad-hoc colors, homepage tokens only, structural UI only.
- Each completed checklist step must have a scoped git commit before advancing.
- A task cannot close unless validation includes:
  - proportional diff review
  - unrelated-file review
  - dependency-change review
  - environment-variable review
- Canonical doc sync is required for each completed slice.

Constitution source: `docs/execution-constitution.md`

## How To Use This File

1. Start each session by reading:
   - `## Last Left Off Here`
   - `## Canonical Order Checklist`
2. Claim exactly one or two adjacent checklist items.
3. Run preflight and mandatory restatement before editing.
4. Execute and validate.
5. Update:
   - this file (checklist + latest job summary + next left-off marker)
   - touched source plan files
   - `docs/codebase-changelog.md` (always)
   - `docs/codebase-overview.md` when behavior/architecture changed
6. Commit checkpoint:
   - create one scoped git commit for each completed checklist step before moving to the next step

## Immutable Constitution Reference (Required)

- Canonical non-negotiables are defined in `docs/execution-constitution.md`.
- These rules apply to every active initiative in this plan.
- Source plans must not contradict this constitution.
- UI and UX work must follow the `UI and UX Design Constitution` section in that file.

## Mandatory Restatement Before Task Execution (Required)

Before any task work starts, add a short restatement to the session/job summary using the constitution template:

- Task ID
- Exact scope sentence
- Invariants confirmed
- Validation controls confirmed
- UI/UX confirmations (required when task touches UI)

A task is not allowed to move to `[~]` until this restatement exists.

## Explicit Deviation Proposal Mechanism (No Silent Scope Expansion)

If scope, dependency, or env surface must change:

1. Create a `Deviation Proposal` block using the constitution template.
2. Mark the task `[!]` blocked in this master checklist.
3. Do not execute the deviation until approved.
4. After approval, update affected source plans and this master plan before implementation.

## Database and Prisma Integrity Contract (Required)

Prisma schema is authoritative for DB-backed work.

Before any DB-related change:

1. Read `prisma/schema.prisma`.
2. Read the latest migration SQL.
3. Confirm model/field names, nullability, relations, indexes, and enums.
4. Run targeted usage scan before edits:
   - `rg -n "<model_or_table_name>" src app test docs`

Hard rules:

- Never assume DB field names from memory.
- Never add shadow fields if equivalent schema already exists.
- Never mark DB tasks complete without preflight evidence in job summary/changelog.

## Autonomous Execution Contract (Required)

Use this when asked to continue from the master plan.

1. Determine active task deterministically:
   - if any item is `[~]`, pick the first `[~]` top-to-bottom
   - else pick the first eligible `[ ]` top-to-bottom
2. Run scoped preflight before edits.
3. Execute only selected task scope.
4. Run validation gates.
5. If complete, mark `[x]` and sync docs.
6. Continue to next item unless a stop condition exists.

Hard rules:

- Only one task may be `[~]` at a time.
- Do not skip earlier open tasks.
- Do not move `[ ]` to `[x]` without validation evidence.

Stop conditions:

- failing validation for the scoped task
- unresolved dependency or product decision blocker
- unapproved deviation request

## Scoped Preflight Gate (No Duplicate Code)

Before coding each task:

1. Read the exact source-plan phase for the selected task ID.
2. Search existing implementation first:
   - `rg -n "<task keywords>" src app test docs`
   - `rg --files src app test | rg "<scope pattern>"`
3. Decide reuse/refactor/extend before creating files.
4. Record preflight evidence in job summary/changelog.

## Validation Gate (Expanded)

A task can be marked `[x]` only if all applicable checks pass.

1. Targeted tests for changed scope pass.
2. Typecheck passes: `npx tsc --noEmit --incremental false`.
3. Targeted lint passes for changed files.
4. Diff-size proportionality recorded:
   - changed file count
   - line delta summary
   - reason this size matches task scope
5. Unrelated-file check recorded:
   - confirm no unrelated files were modified
   - if unrelated dirty files exist, confirm they were not altered by this slice
6. Dependency check recorded:
   - confirm no new dependencies were added
   - if added, approved deviation reference is required
7. Environment-variable check recorded:
   - confirm no new env vars were introduced
   - if introduced, approved deviation reference is required
8. UI governance check recorded for UI-touching tasks:
   - no new hex/tailwind accent colors introduced without approval
   - no glow/gradient/decorative motion introduced
   - no major layout hierarchy repositioning in autonomous refactor slices
9. Source plan status/update/pickup pointer synced.
10. Master plan checklist, left-off marker, and completion snapshot synced.
11. Changelog entry appended with suggested commit title and a single touched-files log block.
12. Per-step commit checkpoint recorded:
    - a scoped git commit exists for this completed step
    - commit hash and message are recorded in job summary/changelog

## Auto-Advance Sequence Gates

- Start `RPK-01+` only after `RPK-00` is `[x]`.
- Start `RPK-03+` only after `RPK-02` is `[x]`.
- Start `RPK-04+` only after `RPK-03` is `[x]`.
- Start `RTS-01+` only after `RTS-00` is `[x]`.
- Start `RTS-03+` only after `RTS-02` is `[x]`.
- Start `RTS-04+` only after `RTS-03` is `[x]`.
- Start `RTS-05` only after `RTS-04` is `[x]`.
- Start `UX-L-00` only after `IMG-L-00` is `[x]`.
- Start `LG-00` only after `RPK-05`, `RTS-05`, `IMG-L-00`, and `UX-L-00` are `[x]`.
- Resume `DI-*` only after `LG-00` is fully `[x]`.

## Completion Percentage (Update Every Slice)

Use `Canonical Order Checklist` statuses as source of truth.

- Strict completion % formula:
  - `([x] count / total launch-critical checklist items) * 100`
- Weighted progress % formula:
  - `(([x] count + 0.5 * [~] count) / total launch-critical checklist items) * 100`

Current snapshot (2026-02-28):

- Launch-critical checklist items total: `50`
- Launch-critical `[x]`: `29`
- Launch-critical `[~]`: `0`
- Strict completion: `58.00%`
- Weighted progress: `58.00%`
- Parked post-launch checklist items (DI): `7` (excluded from launch completion %)

Update rule after each slice:

1. Update checklist statuses first.
2. Recalculate strict and weighted percentages.
3. Update this section.

## Context

- `docs/master-plan-v1.md` is archived and complete.
- v2 is rebased from DI-first to restaurant-launch-first.
- DI remains important but is parked until launch-critical restaurant work is complete.

Canonical source plans in this cycle:

1. `docs/business-industry-packaging-refactor-plan.md` (RPK)
2. `docs/restaurant-table-service-plan.md` (RTS)
3. `docs/item-image-enrichment-plan.md` (IMG)
4. `docs/inventory-shopping-ux-redesign-plan.md` (UX)
5. `docs/document-intake-pipeline-plan.md` (DI, parked post-launch)

## Program Posture

Launch-critical support target:

- `restaurant`: full support at launch
- all other business types: planned continuation after launch

Current active launch streams:

- RPK (restaurant packaging and intake 1-8)
- RTS (table QR + host/kitchen ops)
- IMG-L (launch slice only)
- UX-L (launch slice only)

Parked stream:

- DI (document intake), post-launch queue

## Last Left Off Here

- Current task ID: `RTS-03-d`
- Current task: `Post-confirm edits append items on same order`
- Status: `NOT STARTED`
- Last updated: `2026-02-28`
- Note: RTS-03-c confirmation timer fields completed; continue deterministic order with RTS-03-d.

## Canonical Order Checklist

Status legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` completed
- `[!]` blocked

### Initiative RPK - Restaurant Packaging + Intake Slice (1-8)

Plan doc: `docs/business-industry-packaging-refactor-plan.md`

#### Phase RPK-00 - Contract lock and launch support map

- [x] RPK-00-a: Add explicit launch support map (`restaurant=full`, others planned)
- [x] RPK-00-b: Lock global intake invariants in shared contracts
- [x] RPK-00-c: Define intake item eligibility/source contract types

#### Phase RPK-01 - Signup and business context alignment

- [x] RPK-01-a: Keep industry selection path as canonical
- [x] RPK-01-b: Restaurant signup optional Google Place capture with skip
- [x] RPK-01-c: Persist place metadata on business profile when supplied

#### Phase RPK-02 - Shopping core intake behavior

- [x] RPK-02-a: Barcode path remains explicit inventory-eligible source
- [x] RPK-02-b: Produce quick-search autosuggest + quantity add in shopping mode
- [x] RPK-02-c: Manual/shelf-label launch policy enforced as expense-only

#### Phase RPK-03 - Receipt decoupling and confirmation flow

- [x] RPK-03-a: Remove/gate direct receipt->inventory commit behavior
- [x] RPK-03-b: Parsed produce checklist with yes/no/select-all
- [x] RPK-03-c: Add `resolve later` action and persistence path

#### Phase RPK-04 - Inventory Fix Later integration

- [x] RPK-04-a: Extend Fix Later task taxonomy for unresolved purchase confirmations
- [x] RPK-04-b: Add inventory queue UI entry/filter for unresolved purchases

#### Phase RPK-05 - Receipt detail and commit guardrails

- [x] RPK-05-a: Add explicit `View Photo` CTA in digital receipt detail
- [x] RPK-05-b: Enforce commit eligibility to prevent ineligible inventory writes
- [x] RPK-05-c: Preserve full expense ledger recording behavior

### Initiative RTS - Restaurant Table QR + Host/Kitchen Ops

Plan doc: `docs/restaurant-table-service-plan.md`

#### Phase RTS-00 - Schema/module/contracts

- [x] RTS-00-a: Add table-service models/enums
- [x] RTS-00-b: Add `table_service` module and guards
- [x] RTS-00-c: Add core shared contracts for menu/table/order flows

#### Phase RTS-01 - Menu and table setup

- [x] RTS-01-a: Menu CRUD (manual) + CSV import
- [x] RTS-01-b: Dining table CRUD and static QR generation

#### Phase RTS-02 - QR router and diner landing

- [x] RTS-02-a: Implement `/scan/t/[token]` resolver
- [x] RTS-02-b: Session-aware branch (member->host, otherwise public)
- [x] RTS-02-c: Implement `/r/[publicSlug]` diner landing with menu-first UX
- [x] RTS-02-d: Show review CTA only when `google_place_id` exists

#### Phase RTS-03 - Host order confirmation flow

- [x] RTS-03-a: Host table order composer
- [x] RTS-03-b: Confirm order -> kitchen ticket creation
- [x] RTS-03-c: Start 30-minute due timer at confirmation
- [ ] RTS-03-d: Post-confirm edits append new items on same order (no amendment table in V1)

#### Phase RTS-04 - Kitchen queue operations

- [ ] RTS-04-a: FIFO queue by confirmation time
- [ ] RTS-04-b: Item status lifecycle includes `pending`, `preparing`, `ready_to_serve`, `served`, `cancelled`
- [ ] RTS-04-c: Collapse order from queue when all items are terminal (`served`/`cancelled`) while keeping order open
- [ ] RTS-04-d: Host `done/paid` action closes order and closes table session
- [ ] RTS-04-e: Overdue visual urgency without queue reordering

#### Phase RTS-05 - Profile mode toggle and launch hardening

- [ ] RTS-05-a: Add Host/Kitchen mode toggle in profile
- [ ] RTS-05-b: Kitchen mode auto-redirects `/` to kitchen queue
- [ ] RTS-05-c: Add explicit temporary note for future role-based refactor
- [ ] RTS-05-d: Launch smoke tests for QR/host/kitchen core loop

### Initiative IMG-L - Launch Slice from Item Image Enrichment

Source plan: `docs/item-image-enrichment-plan.md`

Launch scope only:

- [ ] IMG-L-00-a: Complete IMG-00 schema/contracts
- [ ] IMG-L-00-b: Complete IMG-01 resolver/storage service
- [ ] IMG-L-00-c: Launch does not require enrichment runs or pre-populated produce images

Deferred post-launch:

- IMG-02 (full PLU enrichment run)
- IMG-03 (nightly barcode mirror job)

### Initiative UX-L - Launch Slice from Inventory/Shopping UX Plan

Source plan: `docs/inventory-shopping-ux-redesign-plan.md`

Launch scope only:

- [ ] UX-L-00-a: Implement UX-00 shared primitives needed by launch workflows
- [ ] UX-L-00-b: Wire UX-00 primitives into required restaurant launch surfaces only
- [ ] UX-L-00-c: Defer UX-01 and UX-02 (plus remaining UX backlog) to post-launch

Deferred post-launch:

- full UX-01 through UX-04 redesign backlog

### Initiative LG - Integrated Launch Gate

Test format lock:

- Write new smoke tests as needed for launch gate coverage.
- Prefer `node --test` integration-style tests.
- Use Playwright only where browser-only behavior cannot be validated otherwise.

- [ ] LG-00-a: End-to-end intake 1-8 regression pass
- [ ] LG-00-b: End-to-end QR actor split pass
- [ ] LG-00-c: Host->kitchen queue lifecycle pass
- [ ] LG-00-d: Timer and queue advancement behavior pass
- [ ] LG-00-e: Multi-tenant isolation and permission checks pass

## Post-Launch Queue (Parked)

### Initiative DI - Document Intake Pipeline (Parked)

Plan doc: `docs/document-intake-pipeline-plan.md`
Current state: parked, not cancelled.
Re-entry trigger: launch gate `LG-00` fully complete.
Resume point: `DI-00`.

High-level parked checklist:

- [ ] DI-00 schema/contracts
- [ ] DI-01 capture/isolation
- [ ] DI-02 parse/score
- [ ] DI-03 vendor mapping/trust setup
- [ ] DI-04 inbox/post flow
- [ ] DI-05 trust-gated auto-post
- [ ] DI-06 analytics layer

## Chat Pass-Through Coverage Audit (2026-02-28)

Plans discussed in this chat and doc coverage status:

1. Restaurant Table QR + Host/Kitchen Ops Plan (Restaurant-Only V1)
   - status: covered
   - doc: `docs/restaurant-table-service-plan.md`
2. Business Packaging Plan Update: Restaurant Launch Intake Slice (1-8)
   - status: covered
   - doc: `docs/business-industry-packaging-refactor-plan.md` (Track A)
3. Restaurant-first canonical sequencing for major refactor
   - status: covered
   - doc: `docs/master-plan-v2.md`

No additional missing plan docs were identified from the current chat scope after this update.

## Documentation Sync Checklist (Run Every Session)

- [ ] Source plan file(s) updated (`Latest Update`, status markers, and `Pick Up Here`).
- [ ] Mandatory restatement recorded for the executed task(s).
- [ ] Validation evidence recorded, including proportional diff, unrelated-file check, dependency check, env-var check.
- [ ] For UI-touching tasks, design restatement and UI governance checks recorded (tokens-only, no glow/gradient, no unauthorized layout redesign).
- [ ] Master checklist + left-off marker + completion percentage updated.
- [ ] `docs/codebase-changelog.md` appended with newest entry at top.
- [ ] Single touched-files log included in that changelog entry (all files touched this slice).
- [ ] `docs/codebase-overview.md` updated when behavior/architecture/canonical paths changed.
- [ ] Scoped git commit created for the completed step and commit hash recorded in job summary/changelog.

## Completion Snapshot

- Launch-critical initiatives active: `5` (RPK, RTS, IMG-L, UX-L, LG)
- Launch-critical items complete: `29`
- Parked post-launch initiatives: `1` (DI)

## Latest Job Summary

### 2026-02-28 - RTS-03-c confirmation timestamps and 30-minute due timer enforced

- Constitution Restatement:
  - Task ID: `RTS-03-c`
  - Scope: set `confirmed_at` and `due_at = confirmed_at + 30 minutes` at host confirmation time.
  - Invariants confirmed: one-order-per-session preserved; no guest/public routing changes; no post-confirm append behavior implemented in this slice.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural host detail messaging update only.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content prisma/schema.prisma`
  - `Get-Content src/features/table-service/server/order.service.ts`
  - `Get-Content src/features/table-service/ui/HostOrderComposerPageClient.tsx`
  - `rg -n "RTS-03-c|confirmed_at|due_at|30-minute|timer" docs/master-plan-v2.md docs/restaurant-table-service-plan.md src/features/table-service/server/order.service.ts app/(dashboard)/service/host/page.tsx src/features/table-service/ui/HostOrderComposerPageClient.tsx`
- Implementation:
  - Updated confirmation write path in `src/features/table-service/server/order.service.ts`:
    - on create: sets `confirmed_at` and computes `due_at = confirmed_at + 30 minutes`
    - on existing-order fallback: backfills missing timer fields for older rows
  - Updated host ticket surface to display `confirmed_at` and `due_at`.
  - Updated host confirm helper messaging to reflect active due-timer behavior at confirmation.
- Validation:
  - `npx eslint "src/features/table-service/server/order.service.ts" "src/features/table-service/ui/HostOrderComposerPageClient.tsx" "app/(dashboard)/service/host/page.tsx" "app/actions/modules/table-service.ts"` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 2 (order confirmation service + host composer ticket/timer display)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-03-c timer-field behavior.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-03-c scope files plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `4de9240` (`feat(rts-03): set confirmed_at and 30-minute due_at on confirm`).

### 2026-02-28 - RTS-03-b confirm action now creates kitchen ticket immediately

- Constitution Restatement:
  - Task ID: `RTS-03-b`
  - Scope: implement host confirm action that immediately creates kitchen ticket records from current draft lines.
  - Invariants confirmed: one-order-per-session preserved via unique `table_session_id`; no guest-ordering/public-path changes; no queue/timer lifecycle scope expansion in this slice.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural host workflow updates only, no new design token additions.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content prisma/schema.prisma`
  - `Get-Content app/actions/modules/table-service.ts`
  - `Get-Content app/(dashboard)/service/host/page.tsx`
  - `Get-Content src/features/table-service/ui/HostOrderComposerPageClient.tsx`
  - `Get-Content src/features/table-service/shared/table-service.contracts.ts`
  - `rg -n "ConfirmKitchenOrderInput|AppendKitchenOrderItemsInput|kitchenOrder|KitchenOrder|confirm" app src/features/table-service docs/master-plan-v2.md docs/restaurant-table-service-plan.md --glob '!**/generated/**'`
- Implementation:
  - Added `src/features/table-service/server/order.service.ts`:
    - `confirmKitchenOrder(...)` transactional create of `KitchenOrder` and nested `KitchenOrderItem` rows
    - `getKitchenOrderForSession(...)` read path for host workspace
    - active-session and available-menu-item validation during confirmation
  - Exported order service via `src/features/table-service/server/index.ts`.
  - Extended table-service action wrapper (`app/actions/modules/table-service.ts`) with:
    - `confirmKitchenOrder(...)`
    - `getKitchenOrderForSession(...)`
  - Updated host route (`app/(dashboard)/service/host/page.tsx`) to load existing kitchen ticket state for the active session.
  - Updated host composer UI to:
    - call confirm action
    - create ticket immediately from draft lines
    - render created-ticket state and prevent duplicate confirmation
  - Updated shared order contracts so `ConfirmKitchenOrderInput` carries item lines.
- Validation:
  - `npx eslint "app/(dashboard)/service/host/page.tsx" "app/actions/modules/table-service.ts" "src/features/table-service/server/order.service.ts" "src/features/table-service/server/index.ts" "src/features/table-service/shared/table-service.contracts.ts" "src/features/table-service/ui/HostOrderComposerPageClient.tsx"` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 6 (host route + host UI + action wrapper + order service + server barrel + shared contract update)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-03-b immediate ticket-creation behavior.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-03-b scope files plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `d1d0a35` (`feat(rts-03): create kitchen ticket immediately on host confirm`).

### 2026-02-28 - RTS-03-a host table order composer draft UI completed

- Constitution Restatement:
  - Task ID: `RTS-03-a`
  - Scope: build host table order composer UI for table session context with item selection, quantity, and per-line notes.
  - Invariants confirmed: one-order-per-session contract remains unchanged; no guest ordering or public-scan behavior changes; no queue lifecycle mutations introduced.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural workspace composition only; no new color tokens, no glow/gradient additions.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content app/(dashboard)/service/host/page.tsx`
  - `Get-Content src/features/table-service/server/table.service.ts`
  - `Get-Content src/features/table-service/server/menu.service.ts`
  - `Get-Content prisma/schema.prisma`
  - `Get-Content prisma/migrations/20260228130000_table_service_module_backfill/migration.sql`
  - `rg -n "RTS-03|host|kitchen ticket|TableSession|KitchenOrder|order composer" docs/master-plan-v2.md docs/restaurant-table-service-plan.md`
  - `rg -n "table-service|TableSession|KitchenOrder|service/host|scan/t|/r/" app src lib prisma --glob '!node_modules/**'`
- Implementation:
  - Replaced host placeholder with real composer surface at `app/(dashboard)/service/host/page.tsx`.
  - Added `src/features/table-service/ui/HostOrderComposerPageClient.tsx` with:
    - available menu-item line add
    - per-line quantity and notes editing
    - line removal
    - subtotal and quantity summary
    - disabled confirm CTA reserved for `RTS-03-b`
  - Wired host page to pull menu setup data and pass only `isAvailable=true` menu items into composer.
  - Exported new host composer UI from `src/features/table-service/ui/index.ts`.
- Validation:
  - `npx eslint "app/(dashboard)/service/host/page.tsx" "src/features/table-service/ui/HostOrderComposerPageClient.tsx" "src/features/table-service/ui/index.ts"` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 3 (host page wiring + new composer UI + UI index export)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-03-a host composer construction.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-03-a scope files plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `023d012` (`feat(rts-03): add host table order composer draft UI`).

### 2026-02-28 - RTS-02-d review CTA gating completed (RTS-02 phase closed)

- Constitution Restatement:
  - Task ID: `RTS-02-d`
  - Scope: show public review CTA only when `google_place_id` exists and close remaining public-scan constraints for RTS-02.
  - Invariants confirmed: no forced login from public scan flow; no guest ordering/session-join functionality exposed.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural CTA addition only.
- Preflight evidence:
  - `Get-Content app/r/[publicSlug]/page.tsx`
  - `Get-Content app/scan/t/[token]/page.tsx`
  - `rg -n "google_place_id|review|/r/|scan/t|guest" app src prisma docs`
- Implementation:
  - Added `Leave a Review` CTA in public landing.
  - Render-gated CTA so it appears only when `business.google_place_id` exists.
  - Confirmed public-scan flow keeps guest users out of login requirement and ordering/session-join actions.
  - Closed RTS-02 source-plan residual checks (`RTS-02-e`, `RTS-02-f`) as satisfied by current branch/landing behavior.
- Validation:
  - `npx eslint "app/r/[publicSlug]/page.tsx"` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 1 (public landing CTA gate)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-02-d CTA gate behavior.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-02-d paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `000ab65` (`feat(rts-02): gate public review CTA on google_place_id`).

### 2026-02-28 - RTS-02-c public diner landing menu-first UX implemented

- Constitution Restatement:
  - Task ID: `RTS-02-c`
  - Scope: implement menu-first public landing at `/r/[publicSlug]` for non-member scan path.
  - Invariants confirmed: no guest ordering/joining behavior added, menu visibility remains business-scoped and availability-filtered.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural landing composition only; no unauthorized design-system expansion.
- Preflight evidence:
  - `Get-Content app/r/[publicSlug]/page.tsx`
  - `Get-Content prisma/schema.prisma`
  - `rg -n "menu-first|MenuItem|is_available|publicSlug|/r/" app src prisma docs`
- Implementation:
  - Expanded `/r/[publicSlug]` route from placeholder to menu-first rendering:
    - business header + optional address
    - category-grouped visible menu items
    - uncategorized items section fallback
    - empty-state when no available menu items
  - Enforced `is_available=true` filter for diner-facing menu output.
  - Preserved review CTA for follow-on RTS-02-d slice.
- Validation:
  - `npx eslint "app/r/[publicSlug]/page.tsx"` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 1 (public landing page)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-02-c public menu-first landing behavior.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-02-c paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `9d87f95` (`feat(rts-02): implement menu-first /r/[publicSlug] diner landing`).

### 2026-02-28 - RTS-02-b session-aware branch implemented

- Constitution Restatement:
  - Task ID: `RTS-02-b`
  - Scope: add scan-path branching so members route to host workflow and guests/non-members route to public landing.
  - Invariants confirmed: no forced login from scan route; session-aware host routing preserved; guest flow remains non-ordering in this baseline.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural routing pages only.
- Preflight evidence:
  - `Get-Content app/scan/t/[token]/page.tsx`
  - `Get-Content src/features/table-service/server/table.service.ts`
  - `Get-Content app/(dashboard)/service/layout.tsx`
  - `rg -n "scan/t|service/host|/r/|getOrCreateActiveTableSession|membership" app src docs`
- Implementation:
  - Updated scan resolver route:
    - member of scanned business -> redirect to `/service/host` and open/create active table session
    - non-member/guest -> redirect to `/r/[publicSlug]`
  - Added `getOrCreateActiveTableSession(...)` server helper.
  - Added host workspace baseline page at `app/(dashboard)/service/host/page.tsx`.
  - Added public landing continuity route at `app/r/[publicSlug]/page.tsx` (menu-first UX delivered in RTS-02-c).
- Validation:
  - `npx eslint "app/scan/t/[token]/page.tsx" "app/(dashboard)/service/host/page.tsx" "app/r/[publicSlug]/page.tsx" src/features/table-service/server/table.service.ts src/features/table-service/server/index.ts` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 4 (scan branch logic + session helper + host/public branch route baselines)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-02-b branch behavior.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-02-b paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `0350abb` (`feat(rts-02): add member-vs-public scan routing branches`).

### 2026-02-28 - RTS-02-a scan-token resolver baseline completed

- Constitution Restatement:
  - Task ID: `RTS-02-a`
  - Scope: implement `/scan/t/[token]` resolver route and server-side token resolution primitive only.
  - Invariants confirmed: static `DiningTable.qr_token` mapping preserved; no login-forcing behavior introduced; no guest-ordering behavior introduced.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural resolver page only.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content src/features/table-service/server/table.service.ts`
  - `Get-Content app/(dashboard)/service/tables/page.tsx`
  - `rg -n "scan/t|qr_token|resolveDiningTableByQrToken|DiningTable" app src prisma docs`
- Implementation:
  - Added `resolveDiningTableByQrToken(...)` in table-service server service.
  - Added public route `app/scan/t/[token]/page.tsx`:
    - resolves token to table + business context
    - returns 404 when token is unknown
    - shows baseline resolver confirmation payload
  - Kept member/public branching for follow-on RTS-02-b/c tasks.
- Validation:
  - `npx eslint src/features/table-service/server/table.service.ts "app/scan/t/[token]/page.tsx" src/features/table-service/server/index.ts` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 2 (resolver service extension + scan route)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-02-a resolver baseline.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-02-a paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `94962a6` (`feat(rts-02): add table scan token resolver route baseline`).

### 2026-02-28 - RTS-01-b dining-table CRUD and static scan-token generation completed

- Constitution Restatement:
  - Task ID: `RTS-01-b`
  - Scope: implement dining-table CRUD and static QR token generation surfaces under module-gated table-service setup.
  - Invariants confirmed: static per-table token model preserved, no guest ordering scope added, table-service module/industry guard remains enforced.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural setup UI only; no unauthorized visual system changes.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content app/actions/modules/table-service.ts`
  - `Get-Content src/features/table-service/server/guard.ts`
  - `Get-Content src/features/table-service/shared/table-service.contracts.ts`
  - `rg -n "DiningTable|qr_token|service/tables|table_service|scan/t" app src prisma docs`
- Implementation:
  - Added table-service setup route page:
    - `app/(dashboard)/service/tables/page.tsx`
  - Added dining-table server service:
    - list/create/update/delete operations
    - unique static token generation + regeneration (`tbl_<uuid>`)
  - Added table-service action wrappers for dining-table operations.
  - Added table setup UI with:
    - table CRUD controls
    - token display
    - copyable static scan URL output
    - token regeneration control
  - Confirmed menu item availability toggle (`isAvailable`) remains wired in menu setup (RTS-01-e closure).
- Validation:
  - `npx eslint app/actions/modules/table-service.ts "app/(dashboard)/service/layout.tsx" "app/(dashboard)/service/menu/page.tsx" "app/(dashboard)/service/tables/page.tsx" src/features/table-service/server/menu-csv.ts src/features/table-service/server/menu.service.ts src/features/table-service/server/table.service.ts src/features/table-service/server/index.ts src/features/table-service/ui/MenuSetupPageClient.tsx src/features/table-service/ui/TableSetupPageClient.tsx src/features/table-service/ui/index.ts src/features/table-service/shared/table-service.contracts.ts` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx prisma migrate status` -> PASS
- Diff proportionality:
  - changed runtime files: 5 (table service + actions + tables route/UI + export updates)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly aligned with RTS-01-b dining-table CRUD + static token generation scope.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-01-b paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `d5b8ab0` (`feat(rts-01): add dining-table CRUD and static scan-token setup route`).

### 2026-02-28 - RTS-01-a menu CRUD and CSV import completed

- Constitution Restatement:
  - Task ID: `RTS-01-a`
  - Scope: implement manual menu CRUD and CSV import in module-gated table-service setup surface.
  - Invariants confirmed: no guest ordering scope, module + industry guard enforced, one-order-per-session/same-order append invariants unchanged.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural setup UI only; no new design-token systems introduced.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content app/actions/modules/shopping.ts`
  - `Get-Content src/features/shopping/server/contracts.ts`
  - `Get-Content src/features/contacts/ui/ContactsPageClient.tsx`
  - `rg -n "table_service|menu|csv|service/menu|requireModule|MenuCategory|MenuItem" app src prisma docs`
- Implementation:
  - Added module-gated dashboard route:
    - `app/(dashboard)/service/layout.tsx`
    - `app/(dashboard)/service/menu/page.tsx`
  - Added table-service menu actions wrapper:
    - `app/actions/modules/table-service.ts`
  - Added menu server layer:
    - CSV parsing helper (`menu-csv.ts`)
    - menu CRUD/import service (`menu.service.ts`)
  - Added setup UI:
    - category CRUD
    - menu item CRUD (including `isAvailable`/sort order)
    - CSV import textarea + import result summary
  - Preserved business scoping and table-service access guard (`requireTableServiceAccess`).
- Validation:
  - `npx eslint app/actions/modules/table-service.ts "app/(dashboard)/service/layout.tsx" "app/(dashboard)/service/menu/page.tsx" src/features/table-service/server/menu-csv.ts src/features/table-service/server/menu.service.ts src/features/table-service/server/index.ts src/features/table-service/ui/MenuSetupPageClient.tsx src/features/table-service/ui/index.ts src/features/table-service/shared/table-service.contracts.ts src/features/table-service/shared/index.ts src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx prisma migrate status` -> PASS
- Diff proportionality:
  - changed runtime files: 9 (route/layout, module actions, service parser/service, UI, shared exports/contracts adjustments)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly aligned with RTS-01-a menu CRUD + CSV import scope.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-01-a paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `ab00d50` (`feat(rts-01): add table-service menu CRUD and CSV import setup route`).

### 2026-02-28 - RTS-00-c shared contracts baseline completed (RTS-00 phase closed)

- Constitution Restatement:
  - Task ID: `RTS-00-c`
  - Scope: add shared table-service contracts for menu/table/session/order flows and lock one-order-per-session append semantics.
  - Invariants confirmed: one order per table session, post-confirm edits append items on same order, no amendment table in V1, restaurant-only launch posture preserved.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: no UI changes in this slice.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content src/features/receiving/shared/contracts.ts`
  - `Get-Content src/features/shopping/server/contracts.ts`
  - `rg -n "contracts|one_order_per_session|append|KitchenOrderItemStatus|table_service" src/features/table-service src/features`
- Implementation:
  - Added `src/features/table-service/shared/table-service.contracts.ts` with:
    - module and status constants
    - terminal-status constants
    - one-order-per-session and same-order-append invariant lock constants
    - menu/table/session/order DTO contracts
  - Added `src/features/table-service/shared/index.ts` re-export surface.
  - Added `src/features/table-service/shared/table-service.contracts.test.ts` contract invariant coverage.
  - Closed RTS-00-d in source plan based on explicit tenant/authorization boundary guard baseline from RTS-00-b (`requireTableServiceAccess` with restaurant + module checks).
- Validation:
  - `npx eslint src/features/table-service/shared/table-service.contracts.ts src/features/table-service/shared/index.ts src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 3 (shared contracts + index + invariant test)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-00-c shared contracts and phase closeout documentation.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-00-c code/doc paths.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `b9b757d` (`feat(rts-00): add shared table-service contracts and lock order-flow invariants`).

### 2026-02-28 - RTS-00-b table_service module registration and guard baseline completed

- Constitution Restatement:
  - Task ID: `RTS-00-b`
  - Scope: register `table_service` module and add baseline access guard wiring without implementing RTS UI/workflows yet.
  - Invariants confirmed: restaurant-only launch target for table-service workflows; no product fork; module gating remains explicit and business-scoped.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: no UI changes in this slice.
- Preflight evidence:
  - `Get-Content lib/modules/registry.ts`
  - `Get-Content lib/config/presets.ts`
  - `Get-Content lib/core/modules/guard.ts`
  - `Get-Content lib/core/auth/tenant.ts`
  - `rg -n "defaultModules|MODULE_REGISTRY|requireModule|business_modules|table_service" lib src app prisma`
- Implementation:
  - Added module definition `table_service` and registered it in `MODULE_REGISTRY`.
  - Updated restaurant default provisioning modules to include `table_service`.
  - Added `requireTableServiceAccess()` guard helper (`src/features/table-service/server/guard.ts`) enforcing:
    - `industry_type === "restaurant"`
    - `table_service` module enabled
  - Added and applied additive migration `20260228130000_table_service_module_backfill` to enable `table_service` for existing restaurant businesses.
- Validation:
  - `npx prisma migrate deploy` -> PASS
  - `npx prisma validate` -> PASS
  - `npx prisma migrate status` -> PASS
  - `npx eslint lib/modules/table-service/index.ts lib/modules/registry.ts lib/config/presets.ts src/features/table-service/server/guard.ts src/features/table-service/server/index.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 6 (module definition/registry, presets, table-service guard, additive data migration)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-00-b module and guard baseline requirements.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS-00-b code/doc paths.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `634310d` (`feat(rts-00): register table_service module and add access guard baseline`).

### 2026-02-28 - RTS-00-a table-service schema baseline completed

- Constitution Restatement:
  - Task ID: `RTS-00-a`
  - Scope: add additive table-service models/enums/indexes in Prisma and DB migrations only.
  - Invariants confirmed: restaurant-only launch scope, one active table session at a time, one order per session, post-confirm edits append items to same order.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: no UI changes in this slice.
- Preflight evidence:
  - `Get-Content docs/restaurant-table-service-plan.md`
  - `Get-Content prisma/schema.prisma`
  - `Get-Content prisma/migrations/20260228102000_receipt_inventory_decisions/migration.sql`
  - `rg -n "table_service|table session|kitchen|menu|qr_token|DiningTable|KitchenOrder" src app test docs prisma`
- Implementation:
  - Added Prisma enum `KitchenOrderItemStatus` with values `pending|preparing|ready_to_serve|served|cancelled`.
  - Added Prisma models: `DiningTable`, `MenuCategory`, `MenuItem`, `TableSession`, `KitchenOrder`, `KitchenOrderItem`.
  - Added required constraints/indexes:
    - `DiningTable`: per-business table-number uniqueness + global `qr_token` uniqueness
    - `KitchenOrder`: one order per table session (`table_session_id` unique)
    - `TableSession`: DB partial unique index for one active session per table (`closed_at IS NULL`)
  - Created and applied additive migration `20260228123000_rts00_table_service_schema`.
  - Regenerated Prisma client after schema/migration updates.
- Validation:
  - `npx prisma migrate deploy` -> PASS
  - `npx prisma validate` -> PASS
  - `npx prisma migrate status` -> PASS
  - `npx prisma generate` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 2 (`prisma/schema.prisma`, new migration SQL)
  - changed docs: source/master/overview/changelog sync
  - proportionality reason: exactly scoped to RTS-00-a schema and additive migration baseline.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice modified only RTS schema/migration and required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `33833ef` (`feat(rts-00): add table-service schema baseline models and indexes`).

### 2026-02-28 - RPK-05 receipt photo CTA and commit guardrails completed

- Constitution Restatement:
  - Task ID: `RPK-05`
  - Scope: add explicit `View Photo` CTA and harden commit eligibility while preserving expense-ledger behavior.
  - Invariants confirmed: no product fork, receipts do not auto-create inventory, inventory writes explicit/eligibility-gated, unresolved produce remains routed to Fix Later.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural UI updates only, no unauthorized theme/layout redesign.
- Preflight evidence:
  - `Get-Content src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx`
  - `Get-Content src/features/home/ui/HomeTransactionsLayer.tsx`
  - `Get-Content app/actions/core/transactions.ts`
  - `Get-Content src/features/shopping/server/commit.service.ts`
  - `Get-Content -LiteralPath 'app/(dashboard)/shopping/orders/[id]/page.tsx'`
  - `rg -n "View Photo|commit|inventory_decision|expense|receipt" src app`
- Implementation:
  - Added explicit `View Photo` CTA in receipt detail (`signed_image_url`) with direct open-in-new-tab link.
  - Added explicit receipt-linked `View Photo` cues in home transactions and shopping order detail.
  - Hardened `commitReceiptTransactions` eligibility guardrails:
    - line->inventory mapping must still match receipt line eligibility at commit time
    - pending/ineligible produce lines are blocked from inventory commit
  - Preserved shopping expense-ledger behavior and added explicit metadata `inventory_transaction_count` for commit observability.
  - Preserved idempotent receipt commit behavior.
- Validation:
  - `npx eslint src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx src/features/home/ui/HomeTransactionsLayer.tsx app/actions/core/transactions.ts src/features/shopping/server/commit.service.ts "app/(dashboard)/shopping/orders/[id]/page.tsx"` -> PASS (no errors; existing Next `<img>` warning remains on shopping order detail image)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `node --test src/domain/parsers/receipt.test.mjs src/domain/parsers/receipt-correction-core.test.mjs` -> PASS
- Diff proportionality:
  - changed runtime files: 5 (receipt detail/home/order UI + commit guardrails + expense metadata)
  - changed docs: canonical source/master/overview/changelog sync
  - proportionality reason: exactly aligned to RPK-05 checklist scope.
- Unrelated-file check:
  - pre-existing unrelated local files remained untouched; this slice changed only RPK-05 paths plus required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `2e2afc0` (`feat(rpk-05): add view-photo CTA and harden receipt commit eligibility`).

### 2026-02-28 - RPK-04 Fix Later unresolved purchase-confirmation queue integration completed

- Constitution Restatement:
  - Task ID: `RPK-04`
  - Scope: extend Fix Later taxonomy for unresolved purchase confirmations and add queue entry/filter support in Inventory UI.
  - Invariants confirmed: no product fork, receipts do not auto-create inventory, inventory writes explicit/eligibility-gated, unresolved produce routed to Fix Later.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural UI only, no new glow/gradient/ad-hoc color systems.
- Preflight evidence:
  - `Get-Content src/features/inventory/shared/enrichment-queue.contracts.ts`
  - `Get-Content src/features/inventory/server/inventory.repository.ts`
  - `Get-Content src/features/inventory/server/inventory.service.ts`
  - `Get-Content src/features/inventory/ui/InventoryListPageClient.tsx`
  - `Get-Content src/features/inventory/ui/use-enrichment-dismissals.ts`
- Implementation:
  - Added `review_purchase_confirmation` to enrichment task taxonomy.
  - Added `findReceiptPurchaseConfirmationsToResolve(...)` repository query for receipt lines marked `inventory_decision=resolve_later`.
  - Extended inventory enrichment queue derivation with purchase-confirmation candidate source and summary counts.
  - Added Inventory queue UI badge and dedicated `Unresolved purchases` filter view.
  - Preserved per-task actions (`Done`, `Snooze`, `Skip`) so purchase-confirmation tasks are resolvable line-by-line.
- Validation:
  - `npx eslint src/features/inventory/shared/enrichment-queue.contracts.ts src/features/inventory/server/inventory.repository.ts src/features/inventory/server/inventory.service.ts src/features/inventory/ui/InventoryListPageClient.tsx src/features/inventory/ui/use-enrichment-dismissals.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed runtime files: 4 (inventory contracts/repository/service/UI)
  - changed docs: canonical source/master/overview/changelog sync
  - proportionality reason: directly scoped to RPK-04 taxonomy + queue filter requirements.
- Unrelated-file check:
  - pre-existing unrelated local changes remained untouched; this slice modified only inventory queue paths and required canonical docs.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `6b2af75` (`feat(rpk-04): add unresolved purchase confirmation queue taxonomy and filter`).

### 2026-02-28 - RPK-03 receipt decoupling and produce decision gate completed

- Constitution Restatement:
  - Task ID: `RPK-03`
  - Scope: gate direct receipt inventory commit and add explicit parsed-produce decision checklist (`yes/no/select all/resolve later`) with persistence.
  - Invariants confirmed: no product fork, receipts do not auto-create inventory, inventory writes explicit/eligibility-gated, unresolved produce remains routed for Fix Later follow-up.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
  - UI/UX confirmation: structural UI only, no glow/gradient additions, homepage tokens unchanged.
- Preflight evidence:
  - `rg -n "commitReceiptTransactions|ReceiptReceivePageClient|updateLineItemMatch|produce_lookup|resolve later" app/actions src/features/receiving src/features/inventory prisma/schema.prisma`
  - `Get-Content app/actions/core/transactions.ts`
  - `Get-Content app/actions/modules/receipts.ts`
  - `Get-Content src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx`
  - `Get-Content src/features/receiving/receipt/server/line-item.service.ts`
  - `Get-Content src/features/receiving/receipt/server/receipt.repository.ts`
  - `Get-Content prisma/schema.prisma`
- Implementation:
  - Added additive receipt-line decision persistence (`ReceiptInventoryDecision`, `inventory_decided_at`) and applied additive migration `20260228102000_receipt_inventory_decisions`.
  - Added receipt module actions:
    - `setReceiptProduceDecision` for explicit `add_to_inventory` / `expense_only` / `resolve_later`.
    - `finalizeReceiptReview` to compute eligible commit set and allow commit completion with zero inventory writes.
  - Added server-side guardrails in `commitReceiptTransactions`:
    - block commit when produce decisions are pending
    - block produce-line commit unless explicitly marked `add_to_inventory`
  - Updated receipt review UI with parsed-produce checklist decisions (`yes/no/resolve later`, `select all yes/no`) and auto-advance highlight behavior.
  - Preserved receipt parse/review flow and expense-only outcomes.
- Validation:
  - `npx prisma db execute --file prisma/migrations/20260228102000_receipt_inventory_decisions/migration.sql` -> PASS
  - `npx prisma migrate resolve --applied 20260228102000_receipt_inventory_decisions` -> PASS
  - `npx prisma migrate status` -> PASS
  - `npx prisma validate` -> PASS
  - `npx prisma generate` -> PASS
  - `npx eslint app/actions/modules/receipts.ts app/actions/core/transactions.ts src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx src/features/receiving/shared/contracts.ts src/features/receiving/receipt/server/line-item.service.ts src/features/receiving/receipt/server/receipt.repository.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
  - `node --test src/domain/parsers/receipt.test.mjs src/domain/parsers/receipt-correction-core.test.mjs` -> PASS
  - `node --test src/features/intake/shared/intake-capability.service.test.mjs src/features/intake/shared/intake-session.contracts.test.mjs` -> PASS
- Diff proportionality:
  - changed runtime files: 8 (`receipt` action/service/ui/contracts + additive schema/migration)
  - changed docs: canonical source/master/overview/changelog sync
  - proportionality reason: exactly maps to RPK-03 scope (gate + checklist + persistence) with required governance sync.
- Unrelated-file check:
  - repository had pre-existing dirty files and untracked docs before this slice; only RPK-03 paths and mandatory canonical docs were changed in this slice.
- Dependency check: no new dependencies.
- Env-var check: no new environment variables.
- Commit checkpoint: `d9257b8` (`feat(rpk): complete launch intake slices through rpk-03`).

### 2026-02-28 - RPK-02 shopping intake policy completed

- Constitution Restatement:
  - Task ID: `RPK-02`
  - Scope: implement shopping produce autosuggest + quantity add and enforce intake-source eligibility policy in commit flow
  - Invariants confirmed: no product fork, receipts do not auto-create inventory, inventory writes explicit/eligibility-gated, unresolved produce routes to Fix Later
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check
- Preflight evidence:
  - `rg -n "produce|quick search|shelf|manual|input_method|inventory_eligibility" app/(dashboard)/shopping/page.tsx src/features/shopping app/actions/modules/shopping.ts`
  - `Get-Content app/(dashboard)/shopping/page.tsx`
  - `Get-Content src/features/shopping/ui/use-shopping-session.ts`
  - `Get-Content app/actions/modules/shopping.ts`
  - `Get-Content src/features/shopping/server/commit.service.ts`
- Implementation:
  - Added `searchProduceCatalog` shopping action and hook-driven produce autosuggest UI with quantity-first add.
  - Added per-item intake source + eligibility metadata at shopping item creation.
  - Enforced expense-only policy for manual/shelf-label sources in commit service while preserving expense ledger posting.
  - Preserved barcode and produce-search paths as inventory-eligible.
- Validation:
  - `npx eslint app/actions/modules/shopping.ts src/features/shopping/server/commit.service.ts src/features/shopping/ui/use-shopping-session.ts app/(dashboard)/shopping/page.tsx` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed files: 12
  - line delta: shopping action/server/hook/page + required canonical docs
  - proportionality reason: directly matches RPK-02 scope and required status sync
- Unrelated-file check:
  - pre-existing dirty files existed; this slice touched shopping intake-policy paths and required canonical docs only
- Dependency check: no new dependencies
- Env-var check: no new env vars

### 2026-02-28 - RPK-01 signup alignment completed with additive business place metadata

- Constitution Restatement:
  - Task ID: `RPK-01`
  - Scope: keep industry selection canonical and add optional restaurant place capture persisted on business profile
  - Invariants confirmed: no product fork, receipts do not auto-create inventory, inventory writes explicit/eligibility-gated, unresolved produce routes to Fix Later
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check
- Preflight evidence:
  - `Get-Content app/auth/signup/page.tsx`
  - `Get-Content app/actions/core/auth.ts`
  - `Get-Content lib/core/auth/tenant.ts`
  - `rg -n "industry_type|google_place|formatted_address|latitude|longitude|ensureBusinessForUser" app/auth app/actions lib/core src/server prisma/schema.prisma`
- Implementation:
  - Preserved canonical `industry_type` selection path in signup.
  - Added optional restaurant place capture fields with skip-safe behavior in signup UI.
  - Added additive `Business` place metadata columns and provisioning persistence path.
  - Applied migration using safe fallback because `prisma migrate dev` hit pre-existing `P3006` shadow-db issue; executed SQL via `prisma db execute`, marked applied, and verified migration status up to date.
- Validation:
  - `npx prisma db execute --file prisma/migrations/20260228060000_business_profile_place_metadata/migration.sql` -> PASS
  - `npx prisma migrate resolve --applied 20260228060000_business_profile_place_metadata` -> PASS
  - `npx prisma migrate status` -> PASS (schema up to date)
  - `npx prisma generate` -> PASS
  - `npx prisma validate` -> PASS
  - `npx eslint app/auth/signup/page.tsx app/actions/core/auth.ts lib/core/auth/tenant.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed files: 14
  - line delta: additive signup + provisioning + schema + required canonical docs
  - proportionality reason: aligns with RPK-01 scope plus required status/changelog sync
- Unrelated-file check:
  - pre-existing dirty docs existed; this slice touched only RPK-01 code paths and required canonical docs
- Dependency check: no new dependencies
- Env-var check: no new env vars

### 2026-02-28 - RPK-00 contract baseline executed and closed

- Constitution Restatement:
  - Task ID: `RPK-00`
  - Scope: add launch support map and shared intake contracts only; no runtime flow rewiring
  - Invariants confirmed: no product fork, receipts do not auto-create inventory, inventory writes explicit/eligibility-gated, unresolved produce routes to Fix Later
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check
- Preflight evidence:
  - `rg -n "launch support|inventory_eligibility|intake_source|Fix Later" src app docs`
  - `rg -n "InputMethod|input_method|barcode|receipt|manual|shelf" src/features app/actions src/domain`
  - `Get-Content src/features/intake/shared/intake.contracts.ts`
  - `Get-Content lib/config/presets.ts`
- Implementation:
  - Added explicit launch support map in `lib/config/presets.ts` (`restaurant=full`, others=`planned`).
  - Added intake invariant lock + source/eligibility contracts in `src/features/intake/shared/intake.contracts.ts`.
  - Synced source-plan and master-plan progression pointers to `RPK-01`.
- Validation:
  - `node --test src/features/intake/shared/intake-capability.service.test.mjs` -> PASS (17/17)
  - `node --test src/features/intake/shared/intake-session.contracts.test.mjs` -> PASS (18/18)
  - `npx eslint src/features/intake/shared/intake.contracts.ts lib/config/presets.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - changed files: 11
  - line delta: contract/config + canonical doc sync only
  - proportionality reason: matches a contract-baseline phase touching shared vocab + required trackers
- Unrelated-file check:
  - repository had pre-existing dirty docs; this slice touched only RPK-00 contract/config paths and required canonical docs
- Dependency check: no new dependencies
- Env-var check: no new env vars

### 2026-02-28 - stall-point decision lock applied across RTS/RPK/LG/UX-L/IMG-L

- Locked RTS V1 schema/lifecycle decisions in source plan and synced checklist phrasing in canonical tracker.
- Removed amendment-ticket assumption; confirmed same-order append model for post-confirm host edits.
- Locked LG-00 smoke format to new `node --test` integration-style coverage, with Playwright only for browser-only gaps.
- Narrowed launch UX slice to UX-00 primitives only; deferred UX-01/UX-02 explicitly.
- Confirmed IMG launch scope as IMG-00 + IMG-01 only with no enrichment-run requirement.

### 2026-02-28 - ui and ux constitution rules embedded in canonical execution flow

- Added UI design constraints into compressed invariants and immutable constitution references.
- Expanded validation gate with explicit UI governance checks for UI-touching tasks.
- Added documentation sync requirement for UI design restatement evidence.
- Propagated UX governance to active source plans and UX redesign checklist workflow.

### 2026-02-28 - v2 governance hardening and execution format normalization

- Added compact invariant block and constitution reference to resist context compaction drift.
- Added mandatory task restatement requirement before task execution.
- Added explicit deviation proposal mechanism and blocking behavior for unapproved changes.
- Expanded validation gate with proportional-diff, unrelated-file, dependency, and env-var controls.
- Preserved restaurant-first canonical checklist ordering.

## Session Entry Template (Copy For Each New Work Session)

```
### YYYY-MM-DD - <short job title>
- Engineer/Agent:
- Task IDs completed:
- Constitution restatement logged:
- Source plan sections updated:
- Files changed:
- Validation run:
- Diff proportionality evidence:
- Unrelated-file check result:
- Dependency change check result:
- Env-var change check result:
- Commit checkpoint (hash + title):
- Blockers/risks:
- Next task ID:
```
