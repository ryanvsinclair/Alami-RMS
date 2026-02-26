# Combined Plan Coordination (App Structure Refactor + Inventory Intake Plan)

Status: Active
Created: 2026-02-26
Last Updated: 2026-02-26
Purpose: Coordinate execution across `docs/app-structure-refactor-agent-playbook.md` and `docs/inventoryintakeplan.md` so work happens in the safest order with minimal overlap/duplication.

## Index
1. [How To Use This Coordination File](#how-to-use-this-coordination-file)
2. [Source Plans and Authority Rules](#source-plans-and-authority-rules)
3. [Current Combined Snapshot](#current-combined-snapshot)
4. [What Has Already Been Done (Cross-Plan View)](#what-has-already-been-done-cross-plan-view)
5. [Conflict / Overlap Matrix](#conflict--overlap-matrix)
6. [Canonical File Locations For Inventory Plan Work (Current Refactor State)](#canonical-file-locations-for-inventory-plan-work-current-refactor-state)
7. [Recommended Combined Execution Sequence](#recommended-combined-execution-sequence)
8. [Combined Task Board (Track Here First)](#combined-task-board-track-here-first)
9. [Session Workflow (Required)](#session-workflow-required)
10. [Dual-Update Checklist (This File + Source Plans)](#dual-update-checklist-this-file--source-plans)
11. [Active Work Lock (Coordination Layer)](#active-work-lock-coordination-layer)
12. [Coordination Handoff Log](#coordination-handoff-log)
13. [Decision Rules / Escalation](#decision-rules--escalation)
14. [Notes / Deferred Cross-Plan Items](#notes--deferred-cross-plan-items)

## How To Use This Coordination File

This file is the "traffic controller" for the two existing plans.

Use it to:
- choose the next safest task across both plans
- avoid working in files that are about to move
- avoid duplicate edits in wrappers vs canonical implementations
- keep both source plans updated after each completed task

This file does **not** replace the source plans.
- It sequences them.
- It records cross-plan decisions.
- It points to the right source plan to update after each task.

## Source Plans and Authority Rules

### Source plans
- App structure refactor plan: `docs/app-structure-refactor-agent-playbook.md`
- Inventory intake feature plan: `docs/inventoryintakeplan.md`

### Authority rules (important)
- Structure/phase sequencing for file moves and wrappers:
  - `docs/app-structure-refactor-agent-playbook.md` is authoritative.
- Feature behavior, rollout goals, barcode/receipt intelligence work:
  - `docs/inventoryintakeplan.md` is authoritative.
- When they overlap:
  - Use this coordination file to choose order and file targets.

### Update rule
When a task here is completed:
1. Mark it complete in this file.
2. Update the corresponding section(s) in the relevant source plan(s).
3. Add a short handoff note in this file.

## Current Combined Snapshot

Snapshot taken from both plans on 2026-02-26.

### App Structure Refactor Playbook status
Source: `docs/app-structure-refactor-agent-playbook.md`

- Current phase: `Phase 4 complete - Ready for Phase 5`
- Completed phases:
  - Phase 0
  - Phase 1
  - Phase 2 (shopping server split)
  - Phase 3 (shopping UI split)
  - Phase 4 (receipt/receiving server split)
- Next planned phase:
  - Phase 5 (receive UI page split + shared receive contracts/constants)

### Inventory Intake Plan status
Source: `docs/inventoryintakeplan.md`

- Completed:
  - Phase 0
  - Phase A
  - Phase B
  - Phase C
- Partial:
  - Phase E (observability/hardening) -- web fallback hardening/counters plus layered barcode-provider aggregate counters are done; abuse controls/background retries and broader derived metrics remain
- Not started:
  - Phase D (enrichment queue)

### Immediate tension / coordination risk
- Inventory Plan Phase E currently targets shopping web fallback + barcode provider hardening/metrics.
- Refactor Phase 7 later targets shared/domain/server module moves and import cleanup.
- If Phase 7 starts before Phase E finishes, churn and duplicate edits are likely.

## What Has Already Been Done (Cross-Plan View)

This section exists so future agents do not re-do completed work from either plan.

### Completed structure refactor work (relevant to inventory plan)
- Shopping server logic has been split into `src/features/shopping/server/*` and `app/actions/modules/shopping.ts` is now a thin wrapper.
- Shopping UI has started to split (hook/contracts extracted); route page is partially reduced but not fully decomposed yet.
- Receipt/receiving server logic has been split into:
  - `src/features/receiving/receipt/server/*`
  - `src/features/receiving/photo/server/*`
- `app/actions/modules/receipts.ts` and `app/actions/modules/ocr.ts` are now thin wrappers.

### Completed inventory-intake work (relevant to refactor plan)
- Barcode resolver layered provider system is implemented (Phase B complete).
- Global barcode cache/provenance logic is implemented and validated.
- Shopping web fallback hardening + process-local aggregate counters are partially implemented (Phase E partial).
- Receipt aliasing work is partially implemented (Phase C partial) but needs migration/apply/verification completion.

## Conflict / Overlap Matrix

Use this table before choosing work.

| Work Item | Likely Files | Overlap with Refactor Phase 5 | Overlap with Refactor Phase 6 | Overlap with Refactor Phase 7 | Recommendation |
|---|---|---:|---:|---:|---|
| Inventory Phase C verification (receipt aliasing migration/generate/verify) | `prisma/*`, receipt matching/services | Low | Low | Medium | Do now (quick closure) |
| Inventory Phase E web fallback validation/tuning | `lib/modules/shopping/web-fallback.ts` | Low | Low | High | Do before Phase 7 |
| Inventory Phase E barcode-provider metrics/hardening | `app/actions/core/barcode-resolver*.ts`, adapters | Low | Medium (inventory-related refactor may touch adjacent files) | High | Do before Phase 7 |
| Refactor Phase 5 receive UI split | `app/(dashboard)/receive/*`, `src/features/receiving/*/ui/*` | N/A | Low | Low | Safe to do in parallel with Inventory Phase E if different agent scopes are locked |
| Refactor Phase 6 inventory/contacts/staff extraction | `app/(dashboard)/inventory*`, `contacts`, `staff`, `app/actions/core/*` | N/A | N/A | Medium | Prefer after Inventory Phase E barcode-provider metrics to reduce overlap |
| Inventory Phase D enrichment queue | new feature + storage/queue infra | Low | Medium | High | Plan after E, ideally on stabilized/refactored infra target |
| Refactor Phase 7 infra/domain moves | broad `lib/*` -> `src/*` | Low | Medium | N/A | Delay until Inventory C/E hotspot work is stable |

## Canonical File Locations For Inventory Plan Work (Current Refactor State)

Use these locations to avoid editing thin wrappers unnecessarily.

### Inventory Plan Phase C (receipt aliasing) -- likely canonical targets now
- Receipt/receiving service logic:
  - `src/features/receiving/receipt/server/*` (canonical)
- Thin wrappers (do not add logic here unless necessary):
  - `app/actions/modules/receipts.ts`
  - `app/actions/modules/ocr.ts`
- Shared matching logic (still canonical in legacy path until Phase 7):
  - `lib/core/matching/receipt-line.ts`
  - `lib/core/matching/receipt-line-core.ts`
- Schema / migrations:
  - `prisma/schema.prisma`
  - `prisma/migrations/*`

### Inventory Plan Phase E (web fallback + barcode providers) -- likely canonical targets now
- Shopping web fallback provider logic (still canonical in legacy path):
  - `lib/modules/shopping/web-fallback.ts`
- Barcode provider stack / resolver (still canonical in legacy path):
  - `app/actions/core/barcode-resolver.ts`
  - `app/actions/core/barcode-resolver-core.ts`
  - `app/actions/core/barcode-resolver-cache.ts`
  - `app/actions/core/barcode-providers.ts`
  - `app/actions/core/barcode-provider-adapters/*`
- Shopping server wrapper may call into extracted services:
  - `app/actions/modules/shopping.ts` (wrapper/entrypoint)
- Shopping extracted services (canonical for orchestration changes introduced by refactor):
  - `src/features/shopping/server/*`

### Refactor Phase 5 (receive UI split) -- canonical targets
- `src/features/receiving/shared/*`
- `src/features/receiving/*/ui/*`
- Route shells remain at:
  - `app/(dashboard)/receive/*`

## Recommended Combined Execution Sequence

This is the current best logical order that respects both plans and minimizes conflict.

### Sequence Summary (recommended)
1. Close Inventory Plan Phase C verification (small, correctness-oriented).
2. Finish Inventory Plan Phase E immediate hardening items (especially web fallback + barcode provider metrics/hardening).
3. Continue App Refactor Phase 5 (receive UI split + shared receive constants/contracts).
4. Continue App Refactor Phase 6 (inventory/contacts/staff extraction) after Phase E barcode-provider work is stable.
5. Re-assess Inventory Plan Phase D (enrichment queue) design in the refactored structure.
6. Start App Refactor Phase 7 only after Inventory Phase E hotspot work is stabilized/landed.
7. Complete remaining refactor cleanup (Phases 7/8) and then continue larger inventory D/E extensions.

### Why this order
- Phase C closure is small and reduces lingering uncertainty in receipt aliasing.
- Phase E currently touches hotspot files that are likely to move later in Refactor Phase 7.
- Refactor Phase 5 focuses on receive UI files and is low-overlap with inventory hardening.
- Refactor Phase 7 is the main churn risk for Inventory Phase E/D.

### Parallel work rule (if multiple agents)
Safe parallel pairing:
- Agent A: Inventory Phase E web fallback/barcode metrics hardening
- Agent B: Refactor Phase 5 receive UI split

Unsafe parallel pairing (avoid):
- Inventory Phase E barcode-provider hardening + Refactor Phase 7 infra/domain moves

## Combined Task Board (Track Here First)

Status legend:
- `[ ]` not started
- `[~]` in progress / partial
- `[x]` complete
- `[!]` blocked

### Coordination Setup
- [x] CMB-00 Create this coordination document
  - Source plans to sync after creation: `none (initial creation only)`

### Near-Term Execution (Recommended Next)
- [x] CMB-01 Confirm both source plans are still current before starting new code work
  - Check:
    - `docs/app-structure-refactor-agent-playbook.md` `Update Here`
    - `docs/inventoryintakeplan.md` `Current Status` + `Pick Up Here`
  - Output:
    - update `Current Combined Snapshot` if statuses changed
  - Result:
    - confirmed refactor playbook is at Phase 4 complete / Phase 5 next
    - inventory plan Phase C status was stale and corrected during CMB-02

- [x] CMB-02 Close Inventory Plan Phase C verification / migration closure
  - Source plan linkage:
    - `docs/inventoryintakeplan.md` Phase C + `Current Status`
  - Expected work:
    - migration apply/generate/verification for place-scoped receipt aliasing
    - runtime/flow verification notes
  - Risk:
    - low to medium (DB/runtime verification)
  - Must update after completion:
    - `docs/inventoryintakeplan.md` `Latest Update`
    - `docs/inventoryintakeplan.md` `Current Status`
    - `docs/inventoryintakeplan.md` `Pick Up Here`
  - Result:
    - `prisma migrate status` -> up to date
    - `prisma validate` -> success
    - generated client inspection confirms `receiptItemAlias` delegate/types present
    - `tsc --noEmit --incremental false` -> pass
    - `receipt-line-core` tests -> 10/10 pass
    - inventory plan docs updated to mark Phase C complete

- [x] CMB-03 Inventory Plan Phase E step 2: validate current web fallback hardening slice
  - Source plan linkage:
    - `docs/inventoryintakeplan.md` `Pick Up Here` item 2
  - Expected work:
    - run `npx tsc --noEmit --incremental false`
    - optional manual `Try Web/AI Suggestion` flow check for metrics logs
  - Must update after completion:
    - `docs/inventoryintakeplan.md` `Latest Update`
    - `docs/inventoryintakeplan.md` `Pick Up Here`
  - Result:
    - static validation completed (`tsc --noEmit --incremental false` pass)
    - optional manual metrics-log inspection deferred

- [x] CMB-04 Inventory Plan Phase E step 3: tighten retry/rate-limit behavior for repeated transient web fallback failures
  - Primary files (expected):
    - `lib/modules/shopping/web-fallback.ts`
  - Must update after completion:
    - `docs/inventoryintakeplan.md` `Latest Update`
    - `docs/inventoryintakeplan.md` `Pick Up Here`
  - Result:
    - added process-local transient failure streak tracking (time-windowed) for Serper web fallback
    - repeated transient failures (`timeout` / `network_error` / retriable `5xx`) now trigger temporary self-cooldown escalation
    - enriched logs for cooldowns caused by repeated transient failures (not only explicit `429`)
    - successful Serper responses reset the transient failure streak
    - `npx tsc --noEmit --incremental false` -> PASS

- [x] CMB-05 Inventory Plan Phase E step 4: add aggregate counters for layered barcode providers
  - Primary files (expected):
    - `app/actions/core/barcode-resolver.ts`
    - `app/actions/core/barcode-providers.ts`
    - `app/actions/core/barcode-resolver-core.ts`
    - optional adapter files in `app/actions/core/barcode-provider-adapters/*`
  - Must update after completion:
    - `docs/inventoryintakeplan.md` `Latest Update`
    - `docs/inventoryintakeplan.md` `Pick Up Here`
    - maybe `Current Status` if Phase E status meaningfully changes
  - Result:
    - added process-local aggregate barcode-provider metrics in `app/actions/core/barcode-resolver.ts` via provider `lookup()` wrappers
    - tracks per-provider hit/miss/error/throttle counts, timeout/error-code counts, fallback depth histograms, and latency summaries
    - periodic structured console summaries added for resolver/provider aggregate metrics
    - `npx tsc --noEmit --incremental false` -> PASS

### Refactor Continuation (Low-Overlap, Next)
- [ ] CMB-06 App Refactor Phase 5: split receive UI pages + shared receive contracts/constants
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 5
  - Expected work areas:
    - `src/features/receiving/shared/*`
    - `src/features/receiving/*/ui/*`
    - thin route shells under `app/(dashboard)/receive/*`
  - Must update after completion:
    - `docs/app-structure-refactor-agent-playbook.md` `Update Here`
    - phase ledger + handoff log

- [ ] CMB-07 App Refactor Phase 6: inventory/contacts/staff extraction
  - Prerequisite:
    - complete or stabilize CMB-05 (barcode provider hardening/metrics)
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 6
  - Must update after completion:
    - `docs/app-structure-refactor-agent-playbook.md` `Update Here`
    - phase ledger + handoff log

### Medium-Term Decision Gate
- [ ] CMB-08 Decide when to implement Inventory Plan Phase D (enrichment queue) relative to Refactor Phase 7
  - Decision options:
    - implement D after Refactor Phase 7 (preferred if D needs new infra structure)
    - implement a minimal D slice before Phase 7 but directly in target `src/*` locations
  - Record decision in:
    - this file (`Coordination Handoff Log`)
    - `docs/inventoryintakeplan.md` `Pick Up Here`

### High-Churn Refactor (Delay Until Hotspots Stable)
- [ ] CMB-09 App Refactor Phase 7: shared/domain/server infrastructure moves + import cleanup
  - Prerequisite:
    - inventory Phase E hotspot changes (CMB-04/CMB-05) landed and stable
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 7

- [ ] CMB-10 App Refactor Phase 8: wrapper retirement + final cleanup
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 8

## Session Workflow (Required)

Every session should follow this order:

1. Read this file's `Current Combined Snapshot` and `Combined Task Board`.
2. Pick the next appropriate task from this file (usually the first unchecked item in the active band).
3. Claim `Active Work Lock (Coordination Layer)` in this file.
4. Claim the relevant lock/status in the source plan:
   - refactor playbook `Active Work Lock`, and/or
   - inventory plan `Latest Update` / `Pick Up Here` note if starting work immediately
5. Do the code work in canonical files (not wrappers) when applicable.
6. Run validation.
7. Update this file task status + handoff log.
8. Update the corresponding source plan(s).
9. Clear locks.

## Dual-Update Checklist (This File + Source Plans)

Use this checklist at the end of every completed task.

### Always update this coordination file
- [ ] Mark task status in `Combined Task Board`
- [ ] Append a short note in `Coordination Handoff Log`
- [ ] Update `Current Combined Snapshot` if phase/status changed
- [ ] Clear/update `Active Work Lock (Coordination Layer)`

### If task belongs to app structure refactor plan
- [ ] Update `docs/app-structure-refactor-agent-playbook.md` `Update Here`
- [ ] Update `Active Work Lock` there
- [ ] Add/append handoff log entry there
- [ ] Mark phase checklist / phase ledger progress there

### If task belongs to inventory intake plan
- [ ] Update `docs/inventoryintakeplan.md` `Latest Update`
- [ ] Update `docs/inventoryintakeplan.md` `Pick Up Here (Next Continuation)`
- [ ] Update `docs/inventoryintakeplan.md` `Current Status` if a phase status changed
- [ ] Mark any phase-specific checklist line(s) in `docs/inventoryintakeplan.md`

## Active Work Lock (Coordination Layer)

Prevent cross-plan collisions here before editing code.

- Status: `OPEN`
- Agent: `Unclaimed`
- Date: `2026-02-26`
- Combined task ID(s): `Next: CMB-06`
- Scope:
  - `Unclaimed`
- Expected files:
  - `app/(dashboard)/receive/*`
  - `src/features/receiving/*/ui/*`
  - `src/features/receiving/shared/*`
- Source plan(s) to update on completion:
  - `docs/app-structure-refactor-agent-playbook.md`
  - `docs/combined-plan-coordination.md`

## Coordination Handoff Log

Append new entries at the top.

### 2026-02-26 - CMB-05 completed (Phase E layered barcode-provider aggregate counters)
- Agent: `Codex`
- Scope:
  - add process-local aggregate metrics for layered barcode provider calls in `app/actions/core/barcode-resolver.ts`
  - capture provider outcome/error/timeout counts, fallback depth histograms, and latency summaries
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Source plan updates:
  - `docs/inventoryintakeplan.md` `Latest Update` entry added
  - `docs/inventoryintakeplan.md` `Pick Up Here` item 4 marked complete
  - `docs/inventoryintakeplan.md` `Pick Up Here` item 5 marked complete (Phase E wording/status refreshed)
  - `docs/inventoryintakeplan.md` `Current Status` + detailed Phase E status wording refreshed
- Next recommended:
  - `CMB-06` (App Refactor Phase 5 receive UI split) if continuing the combined sequence
  - inventory Phase E next slices: stricter abuse/rate limiting, then unresolved barcode background retry scheduling

### 2026-02-26 - CMB-04 completed (Phase E repeated transient web fallback failure cooldown hardening)
- Agent: `Codex`
- Scope:
  - tighten Serper retry/cooldown behavior in `lib/modules/shopping/web-fallback.ts`
  - add repeated transient failure cooldown escalation + clearer cooldown logs
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Source plan updates:
  - `docs/inventoryintakeplan.md` `Latest Update` entry added
  - `docs/inventoryintakeplan.md` `Pick Up Here` item 3 marked complete
  - `docs/inventoryintakeplan.md` primary continuation task advanced to Phase E step 4
- Next recommended:
  - `CMB-05` (add aggregate counters for layered barcode providers)
  - `CMB-06` (App Refactor Phase 5 receive UI split) only if a separate agent owns a non-overlapping scope

### 2026-02-26 - CMB-02/CMB-03 completed (Phase C closure verification + Phase E validation checkpoint)
- Agent: `Codex`
- Scope:
  - close inventory plan Phase C status mismatch
  - run verification commands
  - advance Phase E validation checkpoint
- Validation run:
  - `npx prisma migrate status` -> up to date
  - `npx prisma validate --schema prisma/schema.prisma` -> success
  - `npx tsc --noEmit --incremental false` -> PASS
  - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -> 10/10 PASS
- Source plan updates:
  - `docs/inventoryintakeplan.md` `Current Status` updated (Phase C -> complete)
  - `docs/inventoryintakeplan.md` `Pick Up Here` item 2 marked complete
  - `docs/inventoryintakeplan.md` `Latest Update` entry added
- Next recommended:
  - `CMB-04` (tighten retry/rate-limit policy for repeated transient web fallback failures)
  - `CMB-05` (barcode provider aggregate counters)

### 2026-02-26 - Coordination document created
- Agent: `Codex`
- Scope:
  - compared `inventoryintakeplan.md` vs `app-structure-refactor-agent-playbook.md`
  - created combined sequencing/tracking document
- Key findings:
  - No inherent conflict between plans.
  - Main conflict risk is Inventory Phase E hotspot work vs Refactor Phase 7 infra/domain moves.
  - Refactor playbook is further along than initially assumed (Phase 4 complete).
- Changes:
  - added `docs/combined-plan-coordination.md`
- Recommended next:
  - `CMB-02` (close Inventory Phase C verification/migration closure) or `CMB-03` (validate current Phase E hardening slice)

## Decision Rules / Escalation

Use these rules when work spans both plans or touches moved files.

### Rule 1: Prefer canonical implementation files
- If a refactor phase already extracted logic into `src/features/*`, edit there.
- Keep `app/actions/*` wrappers thin unless the task explicitly changes action contract/entrypoint behavior.

### Rule 2: Do not start Refactor Phase 7 while Inventory Phase E hotspot work is actively in progress
Hotspot files include:
- `lib/modules/shopping/web-fallback.ts`
- `app/actions/core/barcode-resolver*.ts`
- `app/actions/core/barcode-providers.ts`
- `app/actions/core/barcode-provider-adapters/*`

### Rule 3: If a task requires touching both a wrapper and canonical file
- Apply behavior changes in the canonical file first.
- Update wrapper only if export shape/wiring needs to change.
- Record both in source plan handoff notes to avoid duplicate edits later.

### Rule 4: When uncertain whether a refactor phase changes the canonical path for an inventory task
- Check `docs/app-structure-refactor-agent-playbook.md` `Handoff Log` and phase completion ledger first.
- If still ambiguous, record a short note in this file and choose the least invasive path (usually current canonical + wrapper stability).

### Rule 5: Phase status changes must be reflected in the original plan
This file can track progress, but the authoritative phase status lives in the source plan.

## Notes / Deferred Cross-Plan Items

- Item image bucket / item-image persistence is deferred and should not be mixed into structure refactor tasks unless explicitly approved.
- Shopping receipt image path consistency cleanup is a valid improvement but not a prerequisite for the current combined sequence.
- If Inventory Phase D (enrichment queue) starts before Refactor Phase 7:
  - implement directly in target `src/*` locations where possible
  - document exact canonical paths in both this file and the refactor playbook
