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
- Phase 0 foundation is implemented; Phase 1 numeric/tax slices are implemented but still open for tuning/hardening.
- Phase 1.5 scaffold is started; lookup/persistence/multilingual hardening remain.

Remaining high-impact work:
- Finish Phase 1 tuning/hardening and tax fixture coverage.
- Complete Phase 1.5 produce lookup service + language fallback + persistence decision.
- Execute Phases 2-6 (parse confidence UI, store memory, hybrid parser, feedback loop, rollout hardening).

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

- [~] RC-10 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then complete Phase 1 remaining items: threshold tuning, expanded fixture corpus, historical plausibility signal wiring.
- [ ] RC-11 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then complete Phase 1 tax hardening: province resolution hierarchy hardening + ON/QC tax fixture assertions + raw-text totals robustness.
- [ ] RC-12 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then complete Phase 1.5 service layer: implement `receipt-produce-lookup.service.ts` (PLU + fuzzy lookup with province/language preference + EN fallback).
- [ ] RC-13 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then resolve persistence decision for parse/produce metadata and implement approved schema-light or schema-backed path.
- [ ] RC-14 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 2 parse confidence persistence + receipt review UI indicators.
- [ ] RC-15 Pre-check existing scoped implementation first (reuse/refactor/remove/move before creating new code/files), then implement Phase 3 store-specific parse profile memory.
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

- Current task ID: `RC-10`
- Current task: `Continue RC-10 threshold tuning + fixture expansion after historical plausibility wiring and quality-gate slices`
- Status: `IN PROGRESS (history wiring + quality gates + observability + fixture corpus 15/20 complete)`
- Last updated: `2026-02-27`
- Primary source plan section:
  - `docs/receipt-post-ocr-correction-plan.md` -> `Phase 1 - Numeric sanity + dual interpretation + totals check`
- Completion condition for this marker:
  - mark `RC-10` complete
  - append a new entry to `## Latest Job Summary`
  - move this marker to `RC-11`

## Documentation Sync Checklist (Run Every Session)

- [ ] Source plan file(s) updated (`Latest Update`, status markers, and pickup pointer).
- [ ] `docs/master-plan-v1.md` checklist + left-off marker + latest job summary updated.
- [ ] `docs/codebase-changelog.md` appended with newest entry at top.
- [ ] `docs/codebase-overview.md` updated if behavior/architecture/canonical path descriptions changed.

## Latest Job Summary (Append New Entries At Top)

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
