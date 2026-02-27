# Master Plan v1 - Cross-Plan Canonical Execution Guide

Status: Active (single source of execution order for remaining plans)
Created: 2026-02-27
Last Updated: 2026-02-27
Primary Purpose: centralize completed-plan history, open-plan sequencing, and a durable handoff checklist for all engineers/agents.

## How To Use This File

1. Start each session by reading:
   - `## Last Left Off Here`
   - `## Canonical Order Checklist`
2. Claim exactly one or two adjacent checklist items.
3. Execute and validate.
4. Update:
   - this file (checklist + latest job summary + next left-off marker)
   - the source plan file(s) touched
   - `docs/codebase-changelog.md` (always)
   - `docs/codebase-overview.md` (when behavior/architecture/canonical paths changed)

## 🔒 Database & Prisma Integrity Contract (Required)

### Database & Prisma Integrity Contract (Non-Negotiable)

Prisma schema is the single source of truth for database structure. Conversation memory and previous code must not be treated as authoritative.

When a task requires creating, editing, or interacting with any database-backed logic (read/write/query/migration/schema reference), the following steps are mandatory before any code changes are made.

1️⃣ Canonical Schema Source

The database schema is defined by:

- `prisma/schema.prisma`
- the most recent migration file under `prisma/migrations/`
- any database-specific documentation in `/docs` explicitly marked as authoritative

No assumptions about table or column names may be made from memory.

2️⃣ Required Preflight Before Any DB Change

Before writing or modifying any code that touches the database:

Open and read:

- `prisma/schema.prisma`
- the latest migration folder (highest timestamp)

Confirm:

- table/model name
- column names
- column types
- nullability
- indexes
- relations

Run targeted search:

- `rg -n "<model_or_table_name>" src app test`

Review all current usages to ensure consistency.

3️⃣ Hard Rules

- Never invent a new column if an equivalent field already exists.
- Never rename a column without updating all dependent logic.
- Never introduce schema-light shadow fields in code without explicit plan approval.
- Never assume optional vs required; verify in schema.
- Never assume enum values; verify in schema.
- Never bypass Prisma types by using raw SQL unless explicitly required.

4️⃣ Migration Rules

If schema change is required:

- verify no existing field satisfies requirement
- update `schema.prisma`
- generate migration
- review migration SQL for correctness
- update related types
- update documentation:
  - `docs/codebase-overview.md`
  - changelog entry

Do not proceed with feature logic until migration passes typecheck and local validation.

5️⃣ Preflight Evidence Requirement

Any task that touches the database must include in its Job Summary:

- schema files reviewed
- migration reviewed
- whether change reused existing schema or required new field
- confirmation that naming aligns with canonical Prisma schema

Tasks that do not include this evidence cannot be marked `[x]`.

## Autonomous Execution Contract (Required)

Use this contract when the instruction is "continue from master plan" or equivalent.

1. Determine the active task deterministically:
   - If any checklist item is `[~]`, pick the first `[~]` in top-to-bottom order.
   - Else pick the first `[ ]` in top-to-bottom order whose prerequisite section is complete.
2. Run scoped implementation preflight before any edits (see `## Scoped Preflight Gate`).
3. Execute only the selected task scope from its source plan section.
4. Run validation gates (see `## Validation Gate`).
5. If gates pass and task scope is complete:
   - mark selected task `[x]`
   - update `## Last Left Off Here` to the next checklist task
   - append a new top entry to `## Latest Job Summary`
   - append a new top entry to `docs/codebase-changelog.md`
   - recalculate `## Completion Percentage`
6. Continue automatically to the next checklist task unless a stop condition is hit.

Hard rules:
- Only one task can be `[~]` at a time.
- Never skip ahead of an earlier open task.
- Never move from `[ ]` to `[x]` without validation evidence.
- Never start a blocked task dependency chain.

Stop conditions:
- unresolved failing tests/lint/typecheck for the scoped task
- source-plan dependency or product decision blocker
- migration/data-risk blocker requiring explicit signoff
- missing credentials/service access required to execute safely

If stopped:
- mark task `[!]` with blocker details in `## Latest Job Summary`
- include exact unblock requirement
- do not start later checklist items

## Scoped Preflight Gate (No Duplicate Code)

Before writing code for each task, the agent must confirm whether scoped implementation already exists.

Required preflight actions:
1. Read the relevant source plan section for the selected task ID.
2. Run targeted codebase scans for existing scope:
   - `rg -n "<task keywords>" src app test docs`
   - `rg --files src app test | rg "<scope pattern>"`
3. Review matching files to decide: reuse, refactor, remove/move, or extend.
4. Create new files only if required scope is truly missing.

Required preflight evidence in job summary/changelog entry:
- files reviewed for existing implementation
- what was reused/refactored/moved/removed
- why any new file was necessary

## Validation Gate

A task can be marked `[x]` only if all applicable gates pass.

- Targeted tests for changed scope: pass
- Type check (`npx tsc --noEmit --incremental false`): pass
- Targeted lint for changed files: pass
- Source plan `Latest Update` or status markers updated
- Master plan checklist, left-off marker, and completion percentages updated
- Changelog entry added with `Suggested Commit Title`

## Auto-Advance Sequence Gates

- Start `IN-*` only after `RC-19` is `[x]`.
- Start `UI-*` only after `IN-08` and `RC-19` are `[x]`.
- Start `QA-*` only after `UI-06` is `[x]`.
- Start `OC-*` only after `QA-01` is `[x]`.

## Completion Percentage (Update Every Slice)

Use the `Canonical Order Checklist` statuses as the source of truth.

- Strict completion % formula:
  - `([x] count / total checklist items) * 100`
- Weighted progress % formula:
  - `(([x] count + 0.5 * [~] count) / total checklist items) * 100`

Current snapshot (2026-02-27):

- Total checklist items: `38`
- `[x]` complete: `24`
- `[~]` in progress: `0`
- Strict completion: `63.16%`
- Weighted progress: `63.16%`
- **Income Integrations Plan (IN-00 through IN-08): COMPLETE**
- **UI-03 complete: capability gating service — resolveVisibleIntents() drives Hub visibility**

Update rule after each slice:

1. Update checklist statuses first.
2. Recalculate strict + weighted percentages.
3. Update this section.
4. Include both percentages in the handoff response to the user.

## Documentation Inventory Reviewed (2026-02-27)

| File | Classification | Status Snapshot | Notes |
|---|---|---|---|
| `docs/app-structure-refactor-agent-playbook.md` | Refactor execution plan | Complete (manual smoke deferred to user) | Phases 0-8 marked complete. |
| `docs/combined-plan-coordination.md` | Cross-plan coordination | Complete (manual smoke deferred to user) | Historical coordination record. |
| `docs/inventoryintakeplan.md` | Feature implementation plan | Complete (Phases 0/A/B/C/D/E complete) | Remaining items are user QA/manual smoke only. |
| `docs/inventoryintakeplan.phase0-audit.md` | Historical prerequisite audit | Completed (deprecated) | Superseded by `inventoryintakeplan.md`. |
| `docs/inventoryintakeplan.progress-handoff.md` | Historical handoff | Historical snapshot | Superseded by later work in `inventoryintakeplan.md`. |
| `docs/receipt-post-ocr-correction-plan.md` | Active feature plan | Complete (`[x]` through RC-19) | Plan closed with non-blocking follow-ups tracked separately. |
| `docs/income-integrations-onboarding-plan.md` | Active feature plan | In progress (`[x]` phases 0-2, `[ ]` phases 3-7) | OAuth core infrastructure shipped; first provider pilot/sync phases pending. |
| `docs/unified-inventory-intake-refactor-plan.md` | Active refactor plan | Planning-only, not implemented | Depends on preserving behavior while regrouping IA/session model. |
| `docs/operational-calendar-schedule-plan.md` | Active feature plan | Planning-only, sequencing-locked | Explicitly blocked until other active plans are complete. |
| `docs/codebase-overview.md` | Architecture reference | Active (living document) | Must stay aligned with implementation reality. |
| `docs/codebase-changelog.md` | Change history | Active (living document) | Append newest entries at top. |
| `docs/initialprd.md` | Legacy product document | Reference only | Original problem framing. |
| `ALAMI_OS_MIGRATION.md` | Legacy migration plan | Partial historical completion (Phase 1 complete; later phases pending) | Useful historical context, not current canonical execution plan. |
| `README.md` | Project bootstrap README | Generic template | Not execution-planning material. |
| `test/fixtures/receipt-correction/README.md` | Test fixture guidance | Active support doc | Relevant to receipt correction tuning/coverage. |
| `skills/TabScanner/SKILLS.md` | Local skill reference | Reference | TabScanner integration best practices. |

## Completed Plan Ledger

- [x] `docs/app-structure-refactor-agent-playbook.md` complete through Phase 8 (manual integrated smoke still a user/final-QA task).
- [x] `docs/combined-plan-coordination.md` complete (cross-plan sequencing closed out).
- [x] `docs/inventoryintakeplan.md` complete through Phases 0/A/B/C/D/E.
- [x] `docs/inventoryintakeplan.phase0-audit.md` completed as prerequisite audit (historical/deprecated).
- [x] `docs/inventoryintakeplan.progress-handoff.md` completed as historical handoff snapshot (superseded).
- [x] `docs/receipt-post-ocr-correction-plan.md` complete through Phase 6 closeout (`RC-19`) with deferred non-blocking follow-ups documented.

## Non-Completed Plan Review

### 1) `docs/receipt-post-ocr-correction-plan.md` (complete)

Latest Update section review:
- Produce normalization layer was added (9-prefix PLU normalization, organic keyword stripping, produce candidate gating).
- `CorrectedReceiptLine` now includes `plu_code`, `produce_match`, `organic_flag`.
- Phase 0 foundation is implemented; RC-10 closeout completed threshold tuning + fixture expansion to 20 scenarios.
- Phase 1.5 schema-backed persistence is implemented for minimal produce metadata (`plu_code`, `organic_flag` on `ReceiptLineItem`), and RC-16/RC-17/RC-18/RC-19 parser + historical-loop + rollout-hardening + closeout synchronization are complete.

Remaining high-impact work:
- None in-plan; broader multilingual fixture breadth and optional backfill/admin tooling are documented as non-blocking follow-ups.

### 2) `docs/income-integrations-onboarding-plan.md` (in progress)

Latest Update section review:
- Phase 0 (`IN-00`) and Phase 1 (`IN-01`) remain complete.
- Phase 2 (`IN-02`) OAuth core infrastructure is now implemented:
  - Prisma models/migration for `BusinessIncomeConnection` and `IncomeOAuthState`
  - token encryption utility and OAuth state hashing/PKCE orchestration
  - provider-agnostic OAuth adapter registry with env-driven provider configuration
  - OAuth start/callback API routes with owner/manager role enforcement
  - provider cards now expose connect links for env-configured providers

Remaining work snapshot:
- Phases 3-7 remain `[ ]` and pending implementation.
- Next required implementation slice is `IN-03` (first provider pilot end-to-end).

### 3) `docs/unified-inventory-intake-refactor-plan.md` (planning-only)

Latest Update section review:
- No `Latest Update` section present.

Remaining work snapshot:
- Phase 0-5 migration strategy is defined, but implementation has not started.
- Must preserve behavior and keep compatibility routes/wrappers during transition.

### 4) `docs/operational-calendar-schedule-plan.md` (planning-only, blocked)

Latest Update section review:
- No `Latest Update` section present.

Remaining work snapshot:
- Entire rollout is pending and explicitly blocked behind completion of:
  - unified intake regrouping implementation
  - receipt post-OCR correction implementation stabilization
  - income integrations core onboarding/integration readiness
  - final integrated smoke expectations from refactor closeout

## Canonical Order Checklist (Single Best Continuation Path)

Status legend:
- `[ ]` not started
- `[~]` in progress
- `[x]` completed
- `[!]` blocked

### A. Coordination Baseline

- [x] MP-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then create master plan and complete cross-doc status audit (2026-02-27).
- [ ] MP-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then keep this file as the only canonical execution order tracker for remaining open plans.

### B. Finish Receipt Post-OCR Correction Plan First (current in-flight plan)

- [x] RC-10 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then complete Phase 1 remaining items: threshold tuning, expanded fixture corpus, historical plausibility signal wiring.
- [x] RC-11 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then complete Phase 1 tax hardening: province resolution hierarchy hardening + ON/QC tax fixture assertions + raw-text totals robustness.
- [x] RC-12 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then complete Phase 1.5 service layer: implement `receipt-produce-lookup.service.ts` (PLU + fuzzy lookup with province/language preference + EN fallback).
- [x] RC-13 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then resolve persistence decision for parse/produce metadata and implement approved schema-light or schema-backed path.
- [x] RC-14 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 2 parse confidence persistence + receipt review UI indicators.
- [x] RC-15 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 store-specific parse profile memory.
- [x] RC-16 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 4 hybrid structured parser upgrades.
- [x] RC-17 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 5 historical feedback loop integration.
- [x] RC-18 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 6 rollout hardening (threshold tuning, versioning, diagnostics, safe enforce promotion).
- [x] RC-19 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then close receipt plan with validation evidence and final status updates.

### C. Implement Income Integrations Onboarding Plan

- [x] IN-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then finalize Phase 0 design/schema contracts and security model decisions.
- [x] IN-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then ship Phase 1 provider catalog + onboarding UI (no OAuth yet).
- [x] IN-02 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 2 provider-agnostic OAuth core.
- [x] IN-03 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 first provider pilot end-to-end (connect -> token storage -> sync -> dashboard projection).
- [x] IN-04 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 4 restaurant-provider rollout (Uber Eats + DoorDash + POS set chosen by product/engineering).
- [x] IN-05 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 5 scheduled sync + webhook hardening.
- [x] IN-06 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 6 reporting/home income-layer improvements.
- [x] IN-07 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 7 production hardening + security/compliance checklist completion.
- [x] IN-08 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then mark income integrations plan complete with changelog + overview sync.

### D. Execute Unified Inventory Intake Refactor (after receipt + income are stable)

- [x] UI-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then finalize Phase 0 vocabulary/contracts in code/docs.
- [x] UI-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then add Phase 1 Inventory Intake Hub shell (intent-first entry).
- [x] UI-02 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then unify Phase 2 session orchestration to intake lifecycle.
- [x] UI-03 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 capability gating (industry-aware visibility/ordering).
- [ ] UI-04 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 4 navigation consolidation with compatibility routes/wrappers retained.
- [ ] UI-05 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then execute Phase 5 cleanup/deprecation after adoption checks, with rollback safety.
- [ ] UI-06 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then mark unified intake plan complete with changelog + overview sync.

### E. Close Existing Deferred QA Gates Before Schedule Plan

- [ ] QA-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then run deferred manual integrated smoke for refactor + inventory enrichment queue + active intake paths.
- [ ] QA-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then confirm all manual QA follow-ups from completed plans are closed and documented.

### F. Start Operational Calendar Plan Only After Gates Pass

- [ ] OC-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then confirm all start-gate prerequisites from `docs/operational-calendar-schedule-plan.md` in writing.
- [ ] OC-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 0 activation/baseline.
- [ ] OC-02 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 1 manual/internal operational calendar.
- [ ] OC-03 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 2 provider-sync foundation.
- [ ] OC-04 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 scheduling-platform expansion.
- [ ] OC-05 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 4 cross-feature suggestion layer.
- [ ] OC-06 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 5 hardening/metrics/ops readiness.
- [ ] OC-07 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then mark operational calendar plan complete and archive this master plan into v2 (if needed).

## Last Left Off Here (Update This Block First)

- Current task ID: `UI-04`
- Current task: `Unified Inventory Intake Refactor — Phase 4 navigation consolidation (compatibility routes/wrappers retained)`
- Status: `READY`
- Last updated: `2026-02-27`
- Primary source plan section:
  - `docs/unified-inventory-intake-refactor-plan.md` -> `Phase 4`
- Note: UI-03 (Phase 3 capability gating) is **COMPLETE**. `intake-capability.service.ts` + 17 tests shipped; Hub updated to `resolveVisibleIntents()`; tsc/eslint clean.

## Documentation Sync Checklist (Run Every Session)

- [ ] Source plan file(s) updated (`Latest Update`, status markers, and pickup pointer).
- [ ] Completion Percentage section updated (strict + weighted values recalculated).
- [ ] `docs/master-plan-v1.md` checklist + left-off marker + latest job summary updated.
- [ ] Autonomous contract invariants verified (single `[~]`, no skipped earlier tasks, no blocked-task bypass).
- [ ] `docs/codebase-changelog.md` appended with newest entry at top.
- [ ] `docs/codebase-overview.md` updated if behavior/architecture/canonical path descriptions changed.

## Latest Job Summary (Append New Entries At Top)

### 2026-02-27 - UI-03 complete: capability gating service
- Suggested Commit Title: `feat(ui-03): add capability gating service and wire to IntakeHubClient`
- Completed:
  - Ran UI-03 preflight scans:
    - `grep -rn "IntakeCapability|INTAKE_CAPABILITIES|capability.*gat" src/ app/` → no prior capability-gating logic outside contracts
    - `IntakeHubClient.tsx` used hardcoded `INTENT_REQUIRED_MODULE` constant — identified as the code to replace
    - Phase 3 scope: pure functions only; no schema, no DB, no service rewrites
  - UI-03 scoped additions:
    - `src/features/intake/shared/intake-capability.service.ts`:
      - `ALWAYS_AVAILABLE_CAPABILITIES`: `{manual_entry}` — universally active
      - `INDUSTRY_CAPABILITIES`: per-industry additive capability sets (5 industries)
      - `MODULE_GATED_CAPABILITIES`: `{supplier_sync: "integrations"}`
      - `resolveIntakeCapabilities(industryType, enabledModules)`: full resolution with null=unconstrained
      - `isIntentVisible(intent, capabilities)`: true if any required cap is active
      - `resolveVisibleIntents(industryType, enabledModules)`: combines ordering + visibility
    - `src/features/intake/shared/index.ts`: barrel updated to re-export capability service
    - `src/features/intake/ui/IntakeHubClient.tsx`: removed `INTENT_REQUIRED_MODULE`; delegates to `resolveVisibleIntents()`
    - `src/features/intake/shared/intake-capability.service.test.mjs`: 17 unit tests (5 suites)
  - No schema migration; no existing service/behavior changes
  - Validation gates all pass:
    - `node --test src/features/intake/shared/intake-capability.service.test.mjs` → PASS 17/17
    - `npx tsc --noEmit --incremental false` → PASS
    - `npx eslint` targeted on touched files → PASS
  - Completion: 24/38 = 63.16%
- Next: `UI-04` (`docs/unified-inventory-intake-refactor-plan.md` Phase 4 — navigation consolidation)

### 2026-02-27 - UI-02 complete: intake session orchestration adapter layer
- Suggested Commit Title: `feat(ui-02): add intake session orchestration adapter layer`
- Completed:
  - Ran UI-02 preflight scans:
    - `grep -rn "ShoppingSessionStatus|ReceiptStatus" src/features/intake/` → nothing — clean slate
    - `grep -rn "IntakeSessionStatus" src/ app/` → only in intake.contracts.ts — no prior adapter
    - Confirmed ShoppingSessionStatus enum: `draft|reconciling|ready|committed|cancelled`
    - Confirmed ReceiptStatus enum: `pending|parsing|review|committed|failed`
    - Phase 2 scope: adapter-layer only — no schema changes, no service rewrites
  - UI-02 scoped additions (reuse-first, no new DB/service logic):
    - `src/features/intake/shared/intake-session.contracts.ts`:
      - `shoppingStatusToIntakeStatus`: 5 status mappings + safe unknown default
      - `receiptStatusToIntakeStatus`: 5 status mappings + safe unknown default
      - `IntakeSessionSummary` DTO: lightweight read-only unified projection
      - `buildIntakeSessionRoute`: intent-aware resume route builder (preserves existing routes)
      - `deriveIntentFromSessionOrigin`: origin → intent adapter
    - `src/features/intake/shared/index.ts`: barrel updated to re-export new contracts
    - `src/features/intake/shared/intake-session.contracts.test.mjs`: 18 unit tests (4 suites)
  - No schema migration required; no existing service/behavior changes
  - Validation gates all pass:
    - `node --test src/features/intake/shared/intake-session.contracts.test.mjs` → PASS 18/18
    - `npx tsc --noEmit --incremental false` → PASS
    - `npx eslint` targeted on touched files → PASS
  - Completion: 23/38 = 60.53%
- Next: `UI-03` (`docs/unified-inventory-intake-refactor-plan.md` Phase 3 — capability gating)

### 2026-02-27 - UI-01 complete: Intake Hub shell live at /intake
- Suggested Commit Title: `feat(ui-01): add Inventory Intake Hub shell with intent-first entry cards`
- Completed:
  - Ran UI-01 preflight scans:
    - `find src/features/intake -type f` → only Phase 0 contracts; no UI yet — new ui/ path required
    - `rg -n "IntakeHubClient|/intake" app src components` → no existing intake hub implementation
    - Reviewed `src/features/receiving/shared/ui/ReceivePageClient.tsx` for card pattern to reuse styling
    - Reviewed `components/nav/bottom-nav.tsx` for nav wiring approach
  - UI-01 scoped additions (reuse-first, no duplicate services):
    - `src/features/intake/ui/IntakeHubClient.tsx`:
      - `INTAKE_INTENT_ORDER_BY_INDUSTRY[industryType]` drives card order
      - `supplier_sync` card filtered by `integrations` module gate via `useBusinessConfig()`
      - `INTENT_HREF` map: `live_purchase → /shopping`, `bulk_intake → /receive`, `supplier_sync → /integrations`
      - Reuses existing `@/shared/config/business-context` and `@/features/intake/shared` contracts
    - `app/(dashboard)/intake/page.tsx`: thin route wrapper only
    - `components/nav/bottom-nav.tsx`: `/intake` nav entry added (replaced standalone `/receive`; Receive still reachable via Hub)
  - No schema migration required
  - All existing routes (/shopping, /receive, /receive/barcode, /receive/receipt, etc.) fully operational
  - Validation gates all pass:
    - `npx tsc --noEmit --incremental false` → PASS
    - `npx eslint` targeted on touched files → PASS
  - Completion: 22/38 = 57.89%
- Next: `UI-02` (`docs/unified-inventory-intake-refactor-plan.md` Phase 2 — session orchestration unification)

### 2026-02-27 - UI-00 complete: Unified Inventory Intake Phase 0 vocabulary/contracts
- Suggested Commit Title: `chore(ui-00): add intake vocabulary contracts — Phase 0 complete`
- Completed:
  - Ran UI-00 preflight scans:
    - `rg --files src/features/intake` → path did not exist — new feature path required
    - `rg -n "IntakeIntent|IntakeCapability|INTAKE_INTENTS|live_purchase|bulk_intake|supplier_sync" src app lib` → no prior implementation found
    - Phase 0 scope confirmed as contracts-only: no DB interaction, no behavior changes
  - UI-00 scoped additions (new feature path, no duplicate code):
    - `src/features/intake/shared/intake.contracts.ts`:
      - `INTAKE_INTENTS` + `IntakeIntent` (`live_purchase`, `bulk_intake`, `supplier_sync`)
      - `INTAKE_SESSION_STATUSES` + `IntakeSessionStatus` (5 lifecycle states)
      - `INTAKE_TERMINAL_STATUSES` readonly set
      - `INTAKE_CAPABILITIES` + `IntakeCapability` (7 capability flags)
      - `INTAKE_INTENT_ORDER_BY_INDUSTRY`: canonical intent ordering per IndustryType
      - `INTAKE_INTENT_LABELS`, `INTAKE_INTENT_DESCRIPTIONS`: UI display strings
      - `INTAKE_INTENT_CAPABILITIES`: per-intent capability sets
    - `src/features/intake/shared/index.ts`: barrel re-export
  - No schema migration required (contracts only)
  - All existing flows unmodified; no behavior changes introduced
  - Validation gates all pass:
    - `npx tsc --noEmit --incremental false` → PASS
    - `npx eslint` targeted on new files → PASS
  - Completion: 21/38 = 55.26%
- Next: `UI-01` (`docs/unified-inventory-intake-refactor-plan.md` Phase 1 — Intake Hub shell)

### 2026-02-27 - IN-08 complete: INCOME INTEGRATIONS PLAN CLOSED — all phases 0-8 done
- Suggested Commit Title: `chore(in-08): close income integrations plan — all phases complete`
- Completed:
  - Verified all phase statuses: Phase 0-7 all `[x]`, Security checklist 7/7 `[x]`
  - Added Phase 8 closure section to source plan with deferred items tracked
  - Updated `Pick Up Here` in source plan: PLAN COMPLETE → next is UI-00
  - Updated master plan: IN-08 `[x]`, Left Off Here → UI-00
  - Updated master plan snapshot: 20/38 = 52.63%
  - Updated codebase-overview.md and codebase-changelog.md
  - No new code changes — documentation closure only
  - Deferred (non-blocking): rate-limit/backoff, active alerting, reporting endpoints, reconciliation sync
  - Completion: 20/38 = 52.63%
- Next: `UI-00` (`docs/unified-inventory-intake-refactor-plan.md` Phase 0 — vocabulary/contracts)

### 2026-02-27 - IN-07 complete: production hardening + security/compliance — token expiry guard, scope audit, key rotation
- Suggested Commit Title: `feat(in-07): add token expiry guard, provider scope audit, and key rotation runbook`
- Completed:
  - Ran IN-07 preflight scans:
    - Confirmed `token_expires_at` already on `BusinessIncomeConnection` — no new column needed
    - Confirmed `status="expired"` already in `IncomeConnectionStatus` enum — no migration needed
    - Confirmed `mapDatabaseStatusToCardStatus` already maps `expired→error` — card shows "Reconnect" automatically
  - IN-07 scoped additions (reuse-first):
    - `connections.repository.ts`: added `markIncomeConnectionExpired` (status="expired", last_error_code="token_expired")
    - `sync.service.ts`: token expiry guard before lock check; expired connections → `failed` in cron (not `skipped`)
    - `oauth.contracts.ts`: `INCOME_PROVIDER_OAUTH_SCOPES` (read-only scopes per provider) + `INCOME_TOKEN_KEY_VERSION="v1"` with 4-step rotation runbook
    - `sync.service.test.mjs`: 3 new token expiry guard tests (14 total)
  - Security checklist: 7/7 items `[x]` — fully complete
  - Validation gates all pass:
    - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS 14/14
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted eslint on all touched files -> PASS
  - Completion: 19/38 = 50.00%
- Next: `IN-08` (`docs/income-integrations-onboarding-plan.md` Phase 8 — mark plan complete, final changelog + overview sync)

### 2026-02-27 - IN-06 complete: connection health indicators + stale sync warnings
- Suggested Commit Title: `feat(in-06): add connection health indicators, stale sync warnings, and error message surface`
- Completed:
  - Ran IN-06 preflight scans:
    - Confirmed `lastSyncAt` already in contract + catalog — just needed staleness check
    - Confirmed `last_error_message` already on `BusinessIncomeConnection` — no new schema migration needed
    - Confirmed Badge component already has `warning` variant — reused directly
  - IN-06 scoped additions (reuse-first):
    - `SYNC_STALE_THRESHOLD_MS = 24h` constant + `syncStale: boolean` field in `income-connections.contracts.ts`
    - `lastErrorMessage: string | null` field in `income-connections.contracts.ts`
    - `provider-catalog.ts`: computes `syncStale` (connected, no sync or >24h ago), populates `lastErrorMessage` from DB
    - `IncomeProviderConnectCard.tsx`: `Sync Stale` warning badge when `syncStale=true`; "no sync run yet" prompt for stale+never-synced; error message for `status="error"` cards
    - `provider-catalog.test.mjs`: added `syncStale=false` + `lastErrorMessage=null` assertions for unconnected cards
  - Validation gates all pass:
    - `npx tsx --test ...provider-catalog.test.mjs ...oauth.service.test.mjs` -> PASS 6/6
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted eslint on all touched files -> PASS
  - Completion: 18/38 = 47.37%
- Next: `IN-07` (`docs/income-integrations-onboarding-plan.md` Phase 7 — production hardening + security/compliance)

### 2026-02-27 - IN-05 complete: scheduled sync + webhook hardening — cron runner, sync lock guard, webhook verification endpoints
- Suggested Commit Title: `feat(in-05): add scheduled sync cron runner, sync lock guard, and webhook verification endpoints`
- Completed:
  - Ran IN-05 preflight scans:
    - Confirmed `INCOME_SYNC_SCHEDULER_STRATEGY = "internal_cron_route"` already defined in shared contracts
    - Confirmed `BusinessIncomeConnection.last_webhook_at` already exists in schema — no new migration needed
    - Confirmed `ExternalSyncLog.status = "running"` can be reused as DB soft lock — reuse-first principle applied
  - IN-05 scoped additions:
    - Sync lock guard in `runProviderManualSync`: `ExternalSyncLog.findFirst` where `status="running"` and `started_at >= (now - 10min)` — scoped per `business_id + source`; stale (>10 min) locks auto-ignored by Prisma `gte` filter
    - `runAllProvidersCronSync`: iterates `CRON_PROVIDER_CONFIGS` (godaddy_pos, uber_eats, doordash), finds all `connected` connections, syncs each independently — lock conflicts → `skipped`, real errors → `failed`, no abort
    - `app/api/integrations/sync/cron/route.ts`: `INCOME_CRON_SECRET` Bearer auth, calls `runAllProvidersCronSync`, returns `{ attempted, succeeded, skipped, failed, details[] }`
    - `src/features/integrations/server/webhook-crypto.ts`: `verifyHmacSha256Signature` (HMAC-SHA256, `crypto.timingSafeEqual`) + `readRawBody`
    - `app/api/integrations/webhooks/uber-eats/route.ts`: `X-Uber-Signature: sha256=<hex>` verification via `INCOME_WEBHOOK_SECRET_UBER_EATS`, `last_webhook_at` update
    - `app/api/integrations/webhooks/doordash/route.ts`: `X-DoorDash-Signature: <hex>` verification via `INCOME_WEBHOOK_SECRET_DOORDASH`
    - `sync.service.test.mjs` extended to 11 tests: 3 new sync lock guard tests (non-stale blocks, null proceeds, stale passes through); fixed `input.now` fallback to `nowOverride` in testable fn
  - Validation gates all pass:
    - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS 11/11
    - `node --test src/features/integrations/providers/uber-eats.provider.test.mjs src/features/integrations/providers/doordash.provider.test.mjs` -> PASS 25/25
    - `npx tsx --test ...provider-catalog.test.mjs ...oauth.service.test.mjs` -> PASS 6/6
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted eslint on all touched files -> PASS
  - Completion: 17/38 = 44.74%
- Next: `IN-06` (`docs/income-integrations-onboarding-plan.md` Phase 6 — reporting + home/dashboard improvements)

### 2026-02-27 - IN-04 complete: restaurant rollout providers (Uber Eats + DoorDash) — adapters, generic sync runner, routes, catalog wiring
- Completed:
  - Ran IN-04 preflight scans:
    - Confirmed `uber_eats` + `doordash` already in `FinancialSource` enum and home dashboard income breakdown
    - Confirmed `lib/modules/integrations/uber-eats.ts` + `doordash.ts` are stubs with no normalization — built fresh in feature path
  - IN-04 scoped additions (reuse-first):
    - `src/features/integrations/providers/uber-eats.provider.ts`:
      - field-priority normalization: id/order_id/workflow_uuid -> externalId, total_price/gross_earnings -> gross, service_fee/uber_fee/commission -> fees, payout_amount/net_earnings -> net, currency_code fallback, placed_at/ordered_at date chain
    - `src/features/integrations/providers/doordash.provider.ts`:
      - field-priority normalization: id/delivery_id/order_id/external_delivery_id -> externalId, subtotal/order_total -> gross, commission_amount/fee -> fees, payout_amount -> net, delivery_status -> payoutStatus, store_name description fallback
    - Generalized `sync.service.ts` to `runProviderManualSync` (shared DRY runner for all providers)
    - `runUberEatsManualSync` + `runDoorDashManualSync` public entry points using generic runner
    - `app/api/integrations/sync/uber-eats/manual/route.ts`
    - `app/api/integrations/sync/doordash/manual/route.ts`
    - Provider catalog: `SYNC_ENABLED_PROVIDERS` set + `SYNC_ROUTE_BY_PROVIDER` + `buildSyncHref` — adding future providers requires one line each
  - Provider adapter tests: 25 normalization unit tests (13 Uber Eats + 12 DoorDash)
  - All 39 targeted tests pass (25 provider + 8 sync + 6 catalog/oauth)
  - `npx tsc --noEmit` -> PASS; targeted eslint -> PASS
  - Updated source/master plans, completion % (42.11%), overview, and changelog
- Remaining:
  - Start `IN-05` (scheduled sync + webhook hardening)
- Next:
  - `IN-05` in `docs/income-integrations-onboarding-plan.md`

### 2026-02-27 - IN-03 complete: GoDaddy POS pilot end-to-end sync validation + last_sync_at dashboard visibility
- Completed:
  - Ran IN-03 preflight scans for existing pilot implementation:
    - `find src/features/integrations -type f` -> confirmed full list of existing files
    - reviewed `sync.service.ts`, `godaddy-pos.provider.ts`, `connections.repository.ts`, `provider-catalog.ts`, dashboard home server
    - confirmed full pilot path (connect -> token storage -> sync -> FinancialTransaction projection) was architecturally complete from prior slices
  - Re-verified DB/Prisma contract inputs (no schema change required for IN-03):
    - `prisma/schema.prisma` reviewed
    - latest migration: `prisma/migrations/20260228013000_income_event_pilot/migration.sql`
  - IN-03 scoped additions (reuse-first, no duplicate services):
    - Added `src/features/integrations/server/sync.service.test.mjs` (8 tests):
      - missing connection / missing token error paths
      - full sync 90-day window gate
      - incremental sync `last_sync_at` date gate
      - IncomeEvent upsert + FinancialTransaction projection shape assertions
      - multiple event isolation
      - provider fetch error -> connection error + failed sync log
      - zero events completes cleanly
    - Fixed `sync.service.ts` JSON field type assertions (`Prisma.InputJsonValue`) for typecheck compliance
    - Extended `IncomeProviderConnectionCard` contract: added `lastSyncAt: string | null`
    - Extended `listIncomeProviderConnectionCardsForBusiness` to populate `lastSyncAt`
    - Updated `IncomeProviderConnectCard` UI to display "Last synced: ..." on connected cards
    - Updated `IncomeSourceSetupStep` copy to reflect pilot live state
  - Completed validation gates:
    - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS (8/8)
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched integration files -> PASS
  - Updated source/master plans, completion percentages, overview, and changelog for IN-03 completion.
- Remaining:
  - Start `IN-04` (restaurant rollout providers: Uber Eats + DoorDash + additional POS).
- Next:
  - `IN-04` in `docs/income-integrations-onboarding-plan.md`

### 2026-02-27 - IN-02 complete: provider-agnostic OAuth core infrastructure (schema + services + routes)
- Completed:
  - Ran IN-02 preflight scans for existing OAuth/integration scope:
    - `rg -n "## Phase 2|OAuth core infrastructure|BusinessIncomeConnection|IncomeOAuthState|token encryption|callback|PKCE|state" docs/income-integrations-onboarding-plan.md docs/master-plan-v1.md`
    - `rg -n "oauth|pkce|IncomeOAuthState|BusinessIncomeConnection|INCOME_TOKEN_ENCRYPTION_KEY|integrations/oauth|webhooks" src app lib prisma`
  - Re-verified DB/Prisma contract inputs before schema change:
    - `prisma/schema.prisma`
    - latest migration before slice: `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
  - Implemented Phase 2 schema + migration:
    - added enums `IncomeProvider`, `IncomeConnectionStatus`
    - added models `BusinessIncomeConnection`, `IncomeOAuthState`
    - added migration `20260228010000_income_oauth_core_infrastructure`
  - Implemented provider-agnostic OAuth core:
    - env-driven OAuth adapter registry (`src/features/integrations/providers/registry.ts`)
    - state repository + connection repository + AES-256-GCM token crypto
    - OAuth start/callback orchestration service with hashed one-time state + PKCE
    - API routes:
      - `app/api/integrations/oauth/[provider]/start/route.ts`
      - `app/api/integrations/oauth/[provider]/callback/route.ts`
    - owner/manager role enforcement in connect/callback entrypoints
  - Updated provider cards to emit connect links when provider OAuth env config is present.
  - Completed validation gates:
    - `npx prisma generate` -> PASS
    - `npx prisma validate` -> PASS
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched OAuth/integration files -> PASS
  - Updated source/master plans, completion percentages, overview, and changelog for IN-02 completion.
- Remaining:
  - Start `IN-03` provider pilot (first live provider connect -> sync -> dashboard projection path).
- Next:
  - `IN-03` in `docs/income-integrations-onboarding-plan.md`

### 2026-02-27 - IN-01 complete: provider catalog and onboarding/integrations UI shell (no OAuth)
- Completed:
  - Ran IN-01 scoped preflight scans and reused existing signup/auth/module patterns:
    - `rg -n "## Phase 1|Phase 1 - Provider catalog|onboarding|income-sources|Connect" docs/income-integrations-onboarding-plan.md`
    - `rg -n "onboarding|income sources|integrations page|Connect Your Income Sources|industry_type" app src lib`
    - reviewed existing baselines:
      - `app/auth/signup/page.tsx`
      - `app/actions/core/auth.ts`
      - `components/nav/bottom-nav.tsx`
      - `lib/modules/integrations/*.ts`
      - `lib/config/presets.ts`
  - Implemented IN-01 scope only:
    - provider-catalog filtering/sorting service and connection DTO contracts
    - onboarding + integrations UI shell components (status cards, connect-coming-soon state)
    - new onboarding and dashboard integrations routes/wrappers
    - signup industry card/radio UI upgrade preserving `industry_type` contract
    - module-gated integrations nav item
    - targeted provider-catalog test coverage
  - No schema changes or migrations required for IN-01.
  - Completed validation gates:
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs` -> PASS (2/2)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched integrations/signup/onboarding/nav files -> PASS
  - Updated source/master plans, completion percentages, overview, and changelog for IN-01 completion.
- Remaining:
  - Start `IN-02` (OAuth core infrastructure, token/state persistence models, callback/start framework).
- Next:
  - `IN-02` in `docs/income-integrations-onboarding-plan.md`

### 2026-02-27 - IN-00 complete: income integrations phase-0 contracts and decision lock finalized
- Completed:
  - Ran IN-00 preflight scans for existing scope and reusable integration paths:
    - `rg -n "Phase 0|provider catalog|BusinessIncomeConnection|IncomeOAuthState|IncomeEvent|token encryption|security checklist|Open Decisions" src app test docs`
    - `rg --files src app test | rg "integrations|onboarding|oauth|income"`
    - reviewed current integration stubs and module wiring:
      - `lib/modules/integrations/types.ts`
      - `lib/modules/integrations/{godaddy-pos,uber-eats,doordash}.ts`
      - `app/actions/core/financial.ts`
      - `lib/config/presets.ts`
  - Re-verified DB/Prisma contract inputs for schema-contract alignment:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
    - no schema change required in IN-00 (contract finalization slice only).
  - Finalized Phase 0 decisions in source plan:
    - Open Decision 1 resolved to `1a` (GoDaddy POS-first pilot path)
    - Open Decision 2 resolved to `2b` (90-day default historical sync)
    - scheduler strategy locked to internal cron route
    - canonical source strategy locked to `IncomeEvent` + MVP `FinancialTransaction` projection
    - `SkipTheDishes` deferred to post-MVP
  - Added Phase 0 feature-contract scaffolding (types/constants only):
    - `src/features/integrations/shared/provider-catalog.contracts.ts`
    - `src/features/integrations/shared/income-events.contracts.ts`
    - `src/features/integrations/shared/oauth.contracts.ts`
    - `src/features/integrations/shared/index.ts`
  - Updated master-plan checklist/left-off/completion percentages for `IN-00` completion and auto-advance to `IN-01`.
- Remaining:
  - Start `IN-01` (provider catalog + onboarding UI shell; no OAuth implementation in this slice).
- Next:
  - `IN-01` in `docs/income-integrations-onboarding-plan.md`

### 2026-02-27 - RC-19 complete: receipt plan closeout synchronized with final validation evidence
- Completed:
  - Ran RC-19 preflight scans for closeout scope across source plan + master plan + overview/changelog synchronization points.
  - Revalidated the stabilized receipt-correction stack for closeout evidence:
    - `npx tsx --test src/features/receiving/receipt/server/receipt-correction.service.test.mjs` -> PASS (2/2)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs` -> PASS (3/3)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction/workflow/repository/profile files -> PASS
  - Updated receipt source plan phase statuses and pickup marker to closed/completed state.
  - Updated master plan checklist and completion percentages for RC-19 completion.
  - Appended closeout changelog entry and overview sync for final receipt-plan state.
- Remaining:
  - Auto-advance to `IN-00` (income integrations onboarding plan Phase 0).
- Next:
  - `IN-00` in `docs/income-integrations-onboarding-plan.md`

### 2026-02-27 - RC-18 complete: rollout hardening (safe enforce guardrails, diagnostics payloads, and guard metrics)
- Completed:
  - Ran RC-18 preflight scans across phase scope and existing correction/workflow/profile paths:
    - `rg -n "Phase 6 - Hardening and rollout expansion|RC-18|threshold tuning|parser versioning|safe enforce|diagnostics|backfill" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md docs/codebase-overview.md`
    - `rg -n "parser_version|mode|shadow|enforce|threshold|tolerance|diagnostics|metrics|backfill|reparse" src/features/receiving/receipt/server src/domain/parsers`
  - Reused existing correction-service orchestration and added scoped hardening only:
    - enforce rollout guard evaluator with configurable thresholds
    - per-receipt enforce->shadow fallback when guard conditions fail
    - correction summary diagnostics (`requested_mode`, guard status, reason counts)
    - workflow metrics aggregation for rollout guard status/reasons
    - parse-profile signal accumulation for rollout guard reasons
  - Added targeted correction hardening tests:
    - `receipt-correction.service.test.mjs` for enforce fallback/pass behavior
  - Completed validation gates:
    - `npx tsx --test src/features/receiving/receipt/server/receipt-correction.service.test.mjs` -> PASS (2/2)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs` -> PASS (3/3)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction/workflow/repository/profile files -> PASS
- Remaining:
  - Start `RC-19` receipt-plan closeout.
- Next:
  - `RC-19` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-17 complete: outcome-aware historical feedback loop (confirmed/matched priors + fuzzy fallback + price proximity gate)
- Completed:
  - Ran RC-17 preflight scans across source-plan + workflow/repository/parser integration paths:
    - `rg -n "Phase 5 - Historical matching feedback loop|RC-17|store + SKU memory|price proximity|learning from user edits" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md`
    - `rg -n "historical|historical_price_hints|feedback|confirmed|matched_item_id|price proximity|fuzzy" src/features/receiving/receipt src/domain/parsers`
    - `rg --files src/features/receiving/receipt src/domain/parsers | rg "receipt"`
  - Reused existing receipt historical hint pipeline and extended it with outcome-aware feedback logic instead of creating duplicate services:
    - `findRecentReceiptLinePriceSamples(...)` now returns line status + matched item linkage
    - historical hint builder now prioritizes confirmed/matched feedback pools, then falls back to fuzzy-name priors when exact keys are missing
    - added price-proximity suppression for weak far-distance priors
  - Kept correction-core purity by injecting upgraded priors through existing feature-layer hint orchestration.
  - Optional learning from user edits is now active via existing review persistence (`ReceiptLineItem.status` + `matched_item_id`) feeding future priors.
  - Added targeted workflow-level regression tests for historical prior behavior:
    - `receipt-workflow.historical-hints.test.mjs` (feedback-prior preference, fuzzy fallback, proximity gate)
  - Completed validation gates:
    - `npx tsx --test src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs` -> PASS (3/3)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched workflow/repository/history-test files -> PASS
- Remaining:
  - Start `RC-18` (Phase 6 hardening and rollout expansion).
- Next:
  - `RC-18` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-16 complete: hybrid raw-text parser upgrades + parser prior consumption from store profile
- Completed:
  - Ran RC-16 preflight scans across source-plan + parser/workflow code paths and reused canonical parser + workflow files:
    - `rg -n "Phase 4 - Structured parsing upgrade|RC-16|section detection|multi-line item|numeric cluster|tax-line extraction" docs/receipt-post-ocr-correction-plan.md`
    - `rg -n "section|summary|footer|tax line|multi-line|numeric cluster|parseReceiptText|HST|GST|QST|TPS|TVQ" src/domain/parsers src/features/receiving/receipt test/fixtures/receipt-correction`
    - `rg --files src/domain/parsers src/features/receiving/receipt | rg "receipt"`
  - Reused and upgraded `src/domain/parsers/receipt.ts` rather than creating parallel parser files:
    - added section classification for item vs summary/tax/footer lines
    - added numeric-cluster parsing (`qty x unit_price line_total`) and safer terminal amount extraction
    - added two-line wrapped-description merge support
    - added optional parser hints (`provinceHint`, `skuPositionHint`) with PLU-safe SKU stripping defaults
  - Consumed store-profile priors in raw-text workflow parser invocation:
    - `parseAndMatchReceipt(...)` now passes `provinceHint`/`skuPositionHint` to parser
  - Extended profile-prior derivation with optional SKU-position hint dominance logic (`prefix` vs `suffix`).
  - Expanded parser + profile tests and updated affected parsed-text Walmart fixtures where header noise is now skipped.
  - Completed validation gates:
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (7/7)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched parser/workflow/profile files -> PASS
- Remaining:
  - Start `RC-17` (Phase 5 historical feedback loop integration).
- Next:
  - `RC-17` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-15 complete: dedicated parse-profile memory table + profile-prior read/write and review-feedback learning
- Completed:
  - Resolved RC-15 open decisions with explicit product direction:
    - Open Decision 2 -> Option A (`ReceiptParseProfile` dedicated table)
    - Open Decision 7 -> Option B (persist interpreted province/tax signals in both `receipt.parsed_data` and profile memory)
  - Ran RC-15 preflight scans across plan + codebase and reused existing receipt workflow/repository paths:
    - `rg -n "Phase 3 - Store-specific pattern memory|ReceiptParseProfile|Open Decisions|dedicated table|Supplier JSON" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md prisma/schema.prisma`
    - `rg -n "ReceiptParseProfile|parse profile|profile_key|store profile|signals|stats" src app test prisma`
  - Re-verified DB/Prisma contract inputs before schema edits:
    - `prisma/schema.prisma`
    - latest migration before slice: `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`
  - Implemented schema + migration + orchestration for profile memory:
    - added `ReceiptParseProfile` model and `20260227230000_receipt_parse_profile_memory` migration
    - added `receipt-parse-profile.service.ts` with deterministic keying, correction-summary signal/stat accumulation, and province-prior derivation gates
    - wired prior resolution + safe persistence in both receipt workflows
    - wired line-review confirm/skip feedback updates into profile stats
  - Completed validation gates:
    - `npx prisma generate` -> PASS
    - `npx prisma validate` -> PASS
    - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (4/4)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched receipt profile/workflow/repository/schema files -> PASS
- Remaining:
  - Start `RC-16` (Phase 4 hybrid structured parser upgrades).
- Next:
  - `RC-16` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-15 blocked: store-profile persistence contract decision required
- Completed:
  - Ran RC-15 preflight scans across plan + codebase for existing implementation:
    - `rg -n "Phase 3 - Store-specific pattern memory|ReceiptParseProfile|Open Decisions|dedicated table|Supplier JSON" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md prisma/schema.prisma`
    - `rg -n "ReceiptParseProfile|parse profile|profile_key|store profile|signals|stats" src app test prisma`
  - Re-verified DB/Prisma contract inputs before any schema work:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`
  - Confirmed no existing `ReceiptParseProfile` schema/service implementation is present.
- Blocker:
  - Source plan keeps RC-15 persistence contract unresolved:
    - `docs/receipt-post-ocr-correction-plan.md` -> Open Decision 2 (dedicated table vs supplier JSON)
    - `docs/receipt-post-ocr-correction-plan.md` -> Open Decision 7 (tax/province signal persistence target)
  - Autonomous contract requires halt on unresolved source-plan/product decisions.
- Unblock requirement (exact):
  - explicit decision for RC-15 persistence path:
    - Option A: dedicated `ReceiptParseProfile` table
    - Option B: `Supplier` JSON field
  - explicit decision whether interpreted province/tax structure signals persist in `receipt.parsed_data` only or also in store profile memory.
- Next:
  - `RC-15` remains `[!]` until the two persistence decisions are provided.

### 2026-02-27 - RC-14 complete: parse-confidence metadata persisted and review UI indicators separated from match confidence
- Completed:
  - Ran RC-14 preflight scans across plan + codebase and reused existing receipt workflow/repository/review UI paths:
    - `docs/receipt-post-ocr-correction-plan.md` (Phase 2 + pickup section)
    - `prisma/schema.prisma`
    - latest migration before slice: `prisma/migrations/20260227190000_receipt_line_item_produce_metadata/migration.sql`
    - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
    - `src/features/receiving/receipt/server/receipt.repository.ts`
    - `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx`
    - `src/features/receiving/receipt/ui/ReceiptLineItemRow.tsx`
  - Implemented schema-backed line-level parse metadata persistence on `ReceiptLineItem`:
    - `parse_confidence_score Decimal(4,3)?`
    - `parse_confidence_band MatchConfidence?`
    - `parse_flags Json?`
    - `parse_corrections Json?`
  - Added migration `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`.
  - Wired metadata persistence from correction-core output in both receipt ingestion workflows while preserving match-confidence semantics.
  - Updated receipt review UI to show parse-confidence indicators separately from match confidence and surface parse flags for medium/low parse-confidence lines.
  - Completed validation gates:
    - `npx prisma generate` -> PASS
    - `npx prisma validate` -> PASS
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched receipt workflow/repository/UI/shared-contract files -> PASS
- Remaining:
  - Start `RC-15` (Phase 3 store-specific parse profile memory).
- Next:
  - `RC-15` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-13 complete: schema-backed minimal produce metadata persistence on ReceiptLineItem
- Completed:
  - RC-13 persistence decision resolved to schema-backed by explicit product direction.
  - Ran scoped preflight scans across plan + codebase and reused existing line-item write path:
    - `prisma/schema.prisma`
    - `src/features/receiving/receipt/server/receipt.repository.ts`
    - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - Implemented minimal nullable schema additions on `ReceiptLineItem` only:
    - `plu_code Int?`
    - `organic_flag Boolean?`
  - Added migration `prisma/migrations/20260227190000_receipt_line_item_produce_metadata/migration.sql`.
  - Updated receipt repository line-item create path to persist `plu_code` and `organic_flag` (no extra columns/tables; no over-modeling).
  - Regenerated Prisma client via `npx prisma generate`.
  - Completed validation gates:
    - `npx prisma validate` -> PASS
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched repository/schema paths -> PASS
- Remaining:
  - Start `RC-14` (Phase 2 parse-confidence persistence + receipt review UI indicators).
- Next:
  - `RC-14` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-13 blocked: parse/produce persistence path requires explicit approval
- Completed:
  - Ran RC-13 preflight scans across plan + codebase to check for an already approved persistence path and existing implementation.
  - Re-reviewed DB contract inputs for potential schema impact:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
  - Confirmed current code stores produce enrichment in correction output only (`plu_code`, `produce_match`, `organic_flag`) with no persisted `ReceiptLineItem` fields yet.
- Blocker:
  - Source plan still lists this as an explicit open decision requiring product/engineering confirmation:
    - `docs/receipt-post-ocr-correction-plan.md` -> `Open Decisions` item 1 (`ReceiptLineItem` columns now vs schema-light `receipt.parsed_data` only).
  - Master-plan rule prohibits introducing schema-light shadow persistence without explicit approval.
- Unblock requirement (exact):
  - Provide explicit decision for RC-13:
    - Option A: schema-light persistence in `receipt.parsed_data` only
    - Option B: schema-backed persistence via new `ReceiptLineItem` columns/migration
  - After decision, continue RC-13 implementation and validation on that approved path.
- Next:
  - `RC-13` remains blocked until persistence-path approval is provided.

### 2026-02-27 - RC-12 complete: produce lookup service wired (PLU/fuzzy + province language preference + EN fallback)
- Completed:
  - Ran scoped preflight scans (`rg -n` + `rg --files`) for produce lookup/service-layer paths; confirmed `receipt-produce-lookup.service.ts` did not exist and reused existing correction-core/workflow contracts instead of duplicating pipelines.
  - Verified DB/Prisma preflight for `produce_items` access:
    - reviewed `prisma/schema.prisma`
    - reviewed latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
    - confirmed RC-12 required no schema change (service-layer read path only).
  - Implemented `src/features/receiving/receipt/server/receipt-produce-lookup.service.ts` with:
    - PLU-first lookup via `produce_items` composite key (`plu_code`, `language_code`)
    - fuzzy-name lookup with trigram similarity scoring + produce keyword gating
    - province-aware language order (`QC: FR -> EN`, default `EN`) and deterministic EN fallback handling
  - Wired lookup enrichment into `runReceiptPostOcrCorrection(...)` so correction lines receive canonical `produce_match` metadata post-core while keeping domain parsing logic DB-free.
  - Added targeted service tests in `src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` (preferred-language behavior, EN fallback, fuzzy match path, non-produce skip).
  - Completed validation gates:
    - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched correction/produce-lookup files -> PASS
- Remaining:
  - Start `RC-13` persistence decision + implementation for parse/produce metadata.
- Next:
  - `RC-13` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-11 complete: province hierarchy hardening + ON/QC tax assertion expansion + raw-text totals robustness
- Completed:
  - Ran scoped preflight scans (`rg -n` and `rg --files`) across `src/app/test/docs` to identify existing tax/province/totals correction logic and reused existing correction-core/workflow/fixture harness paths.
  - Verified DB/Prisma integrity preflight for DB-touching workflow orchestration:
    - reviewed `prisma/schema.prisma`
    - reviewed latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
    - confirmed no schema change was required for RC-11 scope.
  - Implemented Google Place Details-first province resolution in receipt workflow (`google_place_id` -> place details -> address fallback) with in-process place-id cache.
  - Hardened raw-text totals extraction for hyphenated/french labels and split/comma-decimal trailing amount formats.
  - Expanded ON/QC tax interpretation coverage with new mismatch/incomplete fixtures and assertions (ON hint override, ON GST-only warn, QC HST-only warn, QC TPS-only incomplete warn, QC French-label comma-decimal pass).
  - Completed validation gates:
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14)
    - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27)
    - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched parser/correction/workflow/fixture-doc files -> PASS
- Remaining:
  - Start `RC-12` service-layer produce lookup implementation (`receipt-produce-lookup.service.ts` + province/language preference + EN fallback wiring).
- Next:
  - `RC-12` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-10 closeout: workflow-aligned threshold tuning + fixture corpus expanded to 20
- Completed:
  - Tuned correction-core historical plausibility scoring to require `sample_size >= 4` before applying history-based score adjustments.
  - Added threshold-boundary correction-core tests (`sample_size: 3` no-op, `sample_size: 4` steer).
  - Expanded receipt-correction fixture corpus from 18 to 20 scenarios with:
    - discount-heavy parsed-text + generic `Tax 13%` label scenario
    - sub-threshold historical hint no-op scenario
  - Ran full RC-10 validation gates (core tests, fixture tests, parser tests, `tsc`, targeted `eslint`) and all passed.
- Remaining:
  - Start `RC-11` tax hardening (province hierarchy + richer ON/QC assertions + raw-text totals robustness).
- Next:
  - `RC-11` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - Master plan hardened for autonomous step-by-step execution
- Completed:
  - Added an `Autonomous Execution Contract` with deterministic task selection and auto-advance behavior.
  - Added explicit hard rules (single in-progress task, no skipping, no unvalidated completion).
  - Added stop conditions and blocked-task protocol to prevent silent drift into unrelated work.
  - Added `Scoped Preflight Gate` and required preflight evidence to enforce reuse/refactor-first implementation.
  - Added `Validation Gate` and section dependency gates (`RC -> IN -> UI -> QA -> OC`).
- Next:
  - Continue `RC-10` under the new autonomous contract until completion criteria are met.

### 2026-02-27 - Process update: completion percentage block added
- Completed:
  - Added a dedicated `Completion Percentage` section with strict and weighted formulas.
  - Added a per-slice update rule so percentages are recalculated every slice.
  - Added completion-percentage refresh to the session documentation checklist.
- Next:
  - Continue `RC-10` to 20 fixtures + threshold tuning closeout.

### 2026-02-27 - RC-10 continuation: parser noise hardening + tax assertion fixture expansion (18/20)
- Completed:
  - Hardened raw-text parser skip filters for subtotal/total and dotted/Quebec tax-label summary lines.
  - Added machine-checkable `tax_interpretation` assertions in fixture harness.
  - Added parser unit tests and expanded fixture corpus to 18 scenarios.
- Remaining:
  - Expand fixture corpus to 20 scenarios.
  - Continue threshold/margin tuning using shadow metrics.
- Next:
  - `RC-10` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-10 continuation: quality gates + observability + fixture corpus expansion
- Completed:
  - Added historical hint quality gates (min sample size + recency lookback) in feature-layer hint derivation.
  - Added historical hint observability fields to correction summary/metrics aggregation.
  - Expanded fixture corpus from 12 to 15 scenarios and aligned harness tax-label detection to workflow behavior.
- Remaining:
  - Continue threshold/margin tuning against shadow metrics.
  - Expand fixtures to 18-20 representative scenarios before RC-10 closeout.
- Next:
  - `RC-10` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - RC-10 started: historical plausibility wiring + first fixture expansion
- Completed:
  - Added feature-layer historical receipt-line price hint retrieval and median hint derivation.
  - Passed line-level historical hints into correction core for both parsed-text and TabScanner paths.
  - Added history-aware scoring/selection guardrails in correction core.
  - Expanded coverage with new core tests and a new history-guided fixture.
- Remaining:
  - Continue RC-10 threshold tuning against shadow metrics + expanded fixture set.
  - Add more representative fixtures (discount-heavy/noisy/mixed-tax patterns) before RC-10 closeout.
- Next:
  - `RC-10` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - Added mandatory per-step pre-check anti-duplication disclaimer
- Completed:
  - Updated every Canonical Order checklist item (MP/RC/IN/UI/QA/OC) to include a mandatory pre-check instruction.
  - The pre-check now explicitly requires reviewing current scoped implementation first and preferring reuse/refactor/remove/move over creating duplicate code/files.
- Next:
  - `RC-10` in `docs/receipt-post-ocr-correction-plan.md`

### 2026-02-27 - Master Plan v1 created
- Completed:
  - Reviewed all markdown docs currently in repository scope.
  - Classified completed vs non-completed plan docs.
  - Consolidated open-plan sequencing into one canonical checklist.
  - Added explicit `Last Left Off Here` marker and recurring documentation-sync checklist.
- Next:
  - `RC-10` in `docs/receipt-post-ocr-correction-plan.md`

## Session Entry Template (Copy For Each New Work Session)

```
### YYYY-MM-DD - <short job title>
- Engineer/Agent:
- Task IDs completed:
- Source plan sections updated:
- Files changed:
- Validation run:
- Blockers/risks:
- Next task ID:
```
