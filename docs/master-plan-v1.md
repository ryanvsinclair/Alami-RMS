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
- `[x]` complete: `7`
- `[~]` in progress: `0`
- Strict completion: `18.42%`
- Weighted progress: `18.42%`

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
| `docs/receipt-post-ocr-correction-plan.md` | Active feature plan | In progress (`[~]` phases 0/1/1.5, later phases pending) | Current highest-priority in-flight implementation plan. |
| `docs/income-integrations-onboarding-plan.md` | Active feature plan | Not started (`[ ]` phases 0-7) | Implementation-ready plan, no phases completed yet. |
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

## Non-Completed Plan Review

### 1) `docs/receipt-post-ocr-correction-plan.md` (in progress)

Latest Update section review:
- Produce normalization layer was added (9-prefix PLU normalization, organic keyword stripping, produce candidate gating).
- `CorrectedReceiptLine` now includes `plu_code`, `produce_match`, `organic_flag`.
- Phase 0 foundation is implemented; RC-10 closeout completed threshold tuning + fixture expansion to 20 scenarios.
- Phase 1.5 schema-backed persistence is implemented for minimal produce metadata (`plu_code`, `organic_flag` on `ReceiptLineItem`); multilingual hardening and Phase 2+ remain.

Remaining high-impact work:
- Execute Phases 4-6 (hybrid parser, feedback loop, rollout hardening).

### 2) `docs/income-integrations-onboarding-plan.md` (not started)

Latest Update section review:
- No `Latest Update` section present.

Remaining work snapshot:
- All implementation phases 0-7 are still `[ ]`.
- Core dependencies/open decisions still need closure (MVP provider order, historical sync window, scheduler platform, canonical source timeline).

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
- [ ] RC-16 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 4 hybrid structured parser upgrades.
- [ ] RC-17 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 5 historical feedback loop integration.
- [ ] RC-18 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 6 rollout hardening (threshold tuning, versioning, diagnostics, safe enforce promotion).
- [ ] RC-19 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then close receipt plan with validation evidence and final status updates.

### C. Implement Income Integrations Onboarding Plan

- [ ] IN-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then finalize Phase 0 design/schema contracts and security model decisions.
- [ ] IN-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then ship Phase 1 provider catalog + onboarding UI (no OAuth yet).
- [ ] IN-02 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 2 provider-agnostic OAuth core.
- [ ] IN-03 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 first provider pilot end-to-end (connect -> token storage -> sync -> dashboard projection).
- [ ] IN-04 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 4 restaurant-provider rollout (Uber Eats + DoorDash + POS set chosen by product/engineering).
- [ ] IN-05 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 5 scheduled sync + webhook hardening.
- [ ] IN-06 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 6 reporting/home income-layer improvements.
- [ ] IN-07 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 7 production hardening + security/compliance checklist completion.
- [ ] IN-08 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then mark income integrations plan complete with changelog + overview sync.

### D. Execute Unified Inventory Intake Refactor (after receipt + income are stable)

- [ ] UI-00 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then finalize Phase 0 vocabulary/contracts in code/docs.
- [ ] UI-01 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then add Phase 1 Inventory Intake Hub shell (intent-first entry).
- [ ] UI-02 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then unify Phase 2 session orchestration to intake lifecycle.
- [ ] UI-03 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 capability gating (industry-aware visibility/ordering).
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

- Current task ID: `RC-16`
- Current task: `Phase 4 hybrid structured parser upgrades`
- Status: `READY`
- Last updated: `2026-02-27`
- Primary source plan section:
  - `docs/receipt-post-ocr-correction-plan.md` -> `Phase 4 - Structured parsing upgrade (hybrid parser)`

## Documentation Sync Checklist (Run Every Session)

- [ ] Source plan file(s) updated (`Latest Update`, status markers, and pickup pointer).
- [ ] Completion Percentage section updated (strict + weighted values recalculated).
- [ ] `docs/master-plan-v1.md` checklist + left-off marker + latest job summary updated.
- [ ] Autonomous contract invariants verified (single `[~]`, no skipped earlier tasks, no blocked-task bypass).
- [ ] `docs/codebase-changelog.md` appended with newest entry at top.
- [ ] `docs/codebase-overview.md` updated if behavior/architecture/canonical path descriptions changed.

## Latest Job Summary (Append New Entries At Top)

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
