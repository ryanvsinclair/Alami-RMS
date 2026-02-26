# Combined Plan Coordination (App Structure Refactor + Inventory Intake Plan)

Status: Complete (manual smoke deferred to user)
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

Snapshot re-synced from both plans on 2026-02-26 (final closeout).

### App Structure Refactor Playbook status
Source: `docs/app-structure-refactor-agent-playbook.md`

- Current phase: `Phase 8 complete (all phases 0-8 done; manual smoke deferred to user)`
- Completed phases:
  - Phase 0
  - Phase 1
  - Phase 2 (shopping server split)
  - Phase 3 (shopping UI split)
  - Phase 4 (receipt/receiving server split)
  - Phase 5 (receive UI split + shared receive contracts/constants)
  - Phase 6 (inventory/contacts/staff extraction)
  - Phase 7 (shared/domain/server infrastructure moves + import cleanup)
  - Phase 8 (wrapper retirement decisions documented, accepted exceptions finalized, definition of done marked)

### Inventory Intake Plan status
Source: `docs/inventoryintakeplan.md`

- All phases complete:
  - Phase 0 (mandatory audit)
  - Phase A (safe internal layer)
  - Phase B (external provider integrations)
  - Phase C (place-scoped receipt aliasing)
  - Phase D (enrichment queue -- derived queue, persistent task state, expanded candidate sources, queue observability)
  - Phase E (observability/hardening)

### Immediate tension / coordination risk
- None. Both plans are complete. The only remaining item is user manual smoke testing across all core flows.

## What Has Already Been Done (Cross-Plan View)

This section exists so future agents do not re-do completed work from either plan.

### Completed structure refactor work (relevant to inventory plan)
- Shopping server logic has been split into `src/features/shopping/server/*` and `app/actions/modules/shopping.ts` is now a thin wrapper.
- Shopping UI split is complete (feature UI/hooks extracted and route shell thinned).
- Receipt/receiving server logic has been split into:
  - `src/features/receiving/receipt/server/*`
  - `src/features/receiving/photo/server/*`
- `app/actions/modules/receipts.ts` and `app/actions/modules/ocr.ts` are now thin wrappers.
- Receive UI route pages have been split into `src/features/receiving/*/ui/*` and `src/features/receiving/shared/*`, with thin wrappers under `app/(dashboard)/receive/*`; manual receive smoke validation passed and Phase 5 is complete.
- Inventory, contacts, and staff route/server extraction is complete (Phase 6).
- Shared/domain/server wrapper slices and `src/features/*` legacy import cleanup are complete (Phase 7); Phase 8 remains for wrapper retirement/final verification.

### Completed inventory-intake work (relevant to refactor plan)
- Barcode resolver layered provider system is implemented (Phase B complete).
- Global barcode cache/provenance logic is implemented and validated.
- Shopping web fallback hardening/metrics, layered barcode-provider metrics, strict barcode lookup abuse controls, background retries for unresolved barcodes, and derived-rate summaries are implemented (Phase E complete).
- Receipt aliasing work is complete (Phase C complete).

## Conflict / Overlap Matrix

Use this table before choosing work.

Note: The original high-churn conflict it highlighted (Inventory Phase E vs Refactor Phase 7) has been resolved. For current work, prioritize Phase 8 wrapper-retirement/final-verification decisions and Inventory Phase D kickoff sequencing.

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
- Shared matching logic / DB adapter (still canonical in legacy path after Phase 7 wrapper pass):
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
1. Keep this coordination file synchronized whenever either source plan advances (so the next agent does not follow stale tasks).
2. Kick off App Refactor Phase 8 (wrapper audit/retirement decisions + final verification pass), as recommended by the refactor playbook.
3. Start Inventory Plan Phase D kickoff (minimal optional enrichment tracking + non-blocking "fix later" flow) once Phase 8 scope/risks are clarified.
4. If Phase D begins before Phase 8 completes, implement in canonical `src/*`/current canonical files only and avoid adding new wrapper dependencies.
5. Reassess overlap after the first Phase D slice and continue whichever plan remains active.

### Why this order
- Both source plans have advanced beyond the original conflict point, so the main risk is now stale coordination guidance.
- Refactor Phase 8 is the last refactor cleanup gate before wrapper retirement and final verification.
- Inventory Phase D is the next functional feature slice and can proceed safely if it targets canonical paths.

### Parallel work rule (if multiple agents)
Safe parallel pairing:
- Agent A: Refactor Phase 8 wrapper audit/final verification docs + validation
- Agent B: Inventory Phase D design/kickoff in canonical feature/server paths (if file scopes do not overlap)

Unsafe parallel pairing (avoid):
- Refactor Phase 8 wrapper removal + Inventory Phase D implementation touching the same wrapper/canonical modules

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
- [x] CMB-06 App Refactor Phase 5: split receive UI pages + shared receive contracts/constants
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 5
  - Expected work areas:
    - `src/features/receiving/shared/*`
    - `src/features/receiving/*/ui/*`
    - thin route shells under `app/(dashboard)/receive/*`
  - Result (2026-02-26):
    - shared receive UI contracts + unit options added
    - all receive route pages extracted to `src/features/receiving/*/ui/*` (plus `shared/ui`)
    - receive route files converted to thin wrappers
    - `ItemNotFound` now uses shared receive unit options + shared item result type
    - `npx tsc --noEmit --incremental false` -> PASS
    - manual smoke validation passed for `/receive` hub + barcode/manual/photo/receipt flows and receipt detail view (user-reported)
  - Must update after completion:
    - `docs/app-structure-refactor-agent-playbook.md` `Update Here`
    - phase ledger + handoff log

- [x] CMB-07 App Refactor Phase 6: inventory/contacts/staff extraction
  - Prerequisite:
    - complete or stabilize CMB-05 (barcode provider hardening/metrics)
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 6
  - Result:
    - inventory, contacts, and staff routes/actions were extracted into `src/features/*` UI/server modules
    - thin route/action wrappers preserved
    - refactor playbook Phase 6 marked complete
  - Must update after completion:
    - `docs/app-structure-refactor-agent-playbook.md` `Update Here`
    - phase ledger + handoff log

### Medium-Term Decision Gate
- [x] CMB-08 Decide when to implement Inventory Plan Phase D (enrichment queue) relative to Refactor Phase 7
  - Decision options:
    - implement D after Refactor Phase 7 (preferred if D needs new infra structure)
    - implement a minimal D slice before Phase 7 but directly in target `src/*` locations
  - Record decision in:
    - this file (`Coordination Handoff Log`)
    - `docs/inventoryintakeplan.md` `Pick Up Here`
  - Result:
    - Phase D was deferred while Inventory Phase E and Refactor Phase 7 were completed
    - Refactor Phase 7 is now complete, so the original decision gate is resolved
    - Current next decision is sequencing Phase D kickoff vs Phase 8 final cleanup

### High-Churn Refactor (Delay Until Hotspots Stable)
- [x] CMB-09 App Refactor Phase 7: shared/domain/server infrastructure moves + import cleanup
  - Prerequisite:
    - inventory Phase E hotspot changes (CMB-04/CMB-05) landed and stable
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 7
  - Result:
    - shared/domain/server wrapper slices were added and `src/features/*` legacy imports were cleaned up
    - refactor playbook Phase 7 marked complete; current phase is Phase 8 ready

- [x] CMB-10 App Refactor Phase 8: wrapper retirement + final cleanup
  - Source plan linkage:
    - `docs/app-structure-refactor-agent-playbook.md` Phase 8
  - Final result (2026-02-26):
    - kickoff audit completed; file-level wrapper keep/defer/remove matrix drafted (all 41 wrappers categorized)
    - final static verification executed (`tsc`, targeted tests) and localhost route HEAD smoke passed
    - zero wrapper removals this phase (all wrappers classified keep/keep-for-now/defer-retirement)
    - Phase 8 accepted exceptions finalized and documented (shopping route deviation, baseline lint failures, ESM test path issue, zero removals, manual smoke deferral)
    - Phase 8 marked complete in phase ledger; definition of done items marked
    - manual core-flow smoke deferred to user for integrated QA pass

- [x] CMB-11 Inventory Plan Phase D: optional enrichment tracking + non-blocking "fix later" flow
  - Source plan linkage:
    - `docs/inventoryintakeplan.md` Phase D
  - Final result (2026-02-26):
    - slice 1 (kickoff): schema-light derived "Fix Later Queue" in Inventory using existing metadata
    - slice 2 (task state): persistent enrichment task actions (complete/defer/snooze) via client-side localStorage hook
    - slice 3 (expanded sources): receipt matching (suggested/unresolved lines), shopping pairing (unresolved barcodes, missing-on-receipt, extra-on-receipt), normalization gaps (missing category, short names)
    - slice 4 (observability): queue observability summaries (candidate source breakdown, queue health stats, multi-source items, oldest candidate age)
    - UI: per-item expandable action panel, per-task + bulk actions, undo toast, receipt/shopping badges, collapsible queue stats panel
    - no schema changes; server-side persistent enrichment task table deferred
    - Phase D marked complete in inventory plan

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

- Status: `CLOSED -- all plan work complete`
- Agent: `N/A`
- Date: `2026-02-26`
- Combined task ID(s): `All CMB tasks complete (CMB-00 through CMB-11)`
- Scope:
  - `No active work. Both plans are complete. Only user manual smoke testing remains.`
- Expected files:
  - `None (documentation-only updates going forward if needed)`
- Source plan(s) to update on completion:
  - `N/A`

## Coordination Handoff Log

Append new entries at the top.

### 2026-02-26 - Final closeout: both plans complete, all CMB tasks closed
- Agent: `Claude Opus`
- Scope:
  - complete CMB-11 (Inventory Phase D items 12+13: expanded enrichment candidate sources + queue observability summaries)
  - close CMB-10 (App Refactor Phase 8: accepted exceptions documented, phase ledger closed, definition of done marked)
  - close all three planning documents
- Code changes:
  - `src/features/inventory/server/inventory.repository.ts` (3 new repository queries)
  - `src/features/inventory/server/inventory.service.ts` (expanded queue with 4-source parallel fetch, dedup, new task types, `EnrichmentQueueObservability` type)
  - `src/features/inventory/server/index.ts` (barrel export updated)
  - `src/features/inventory/ui/InventoryListPageClient.tsx` (receipt/shopping badges, collapsible queue stats, `showStats` state)
  - `src/features/inventory/ui/use-enrichment-dismissals.ts` (observability pass-through)
- Documentation changes:
  - `docs/inventoryintakeplan.md`: Phase D marked complete, Latest Update added, Current Status refreshed, Pick Up Here shows all phases done
  - `docs/app-structure-refactor-agent-playbook.md`: Phase 8 marked complete in ledger, accepted exceptions finalized, definition of done items marked, handoff entries added
  - `docs/combined-plan-coordination.md`: CMB-10 + CMB-11 marked complete, snapshot updated, lock closed
- Validation:
  - `npx tsc --noEmit --incremental false` -> PASS
  - targeted eslint on inventory files -> PASS
  - `node --test app/actions/core/barcode-resolver-cache.test.mjs` -> PASS (5/5)
  - `node --test --experimental-transform-types lib/core/matching/receipt-line-core.test.mjs` -> PASS (10/10)
- Remaining (user task only):
  - Manual smoke test across all core flows (login, dashboard, receive barcode/photo/receipt, inventory enrichment queue, shopping, staff, contacts)

### 2026-02-26 - CMB-11 continuation (persistent enrichment task state/actions added to Fix Later queue)
- Agent: `Claude Opus`
- Scope:
  - continue CMB-11 by adding persistent task state/actions (complete/defer/snooze) for the non-blocking enrichment queue
  - implement client-side localStorage dismissal hook and UI action controls
- Changed files:
  - `src/features/inventory/server/inventory.service.ts` (added types: `EnrichmentTaskAction`, `EnrichmentTaskDismissal`, `EnrichmentDismissalMap`, `ENRICHMENT_SNOOZE_HOURS`)
  - `src/features/inventory/server/index.ts` (barrel export updated)
  - `src/features/inventory/ui/use-enrichment-dismissals.ts` (new -- localStorage dismissal hook)
  - `src/features/inventory/ui/InventoryListPageClient.tsx` (expanded with action panel + undo toast + filtered queue)
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/inventory/server/index.ts src/features/inventory/server/inventory.service.ts src/features/inventory/ui/InventoryListPageClient.tsx src/features/inventory/ui/use-enrichment-dismissals.ts` -> PASS
- Source plan updates:
  - `docs/inventoryintakeplan.md`:
    - `Latest Update` entry added for Phase D continuation
    - `Current Status` Phase D wording refreshed
    - `Pick Up Here` items 10+11 marked complete, primary task advanced to candidate source expansion
  - `docs/combined-plan-coordination.md`:
    - `CMB-11` result updated with slice 2 details
    - `Current Combined Snapshot` Phase D status refreshed
    - handoff log entry appended
- Next recommended:
  - continue `CMB-11` with broader enrichment candidate sources (low-confidence receipt outcomes, unresolved shopping pairing leftovers)
  - add queue observability summaries (task-type counts, backlog size, resolution throughput)
  - return to `CMB-10` for integrated manual smoke + final Phase 8 closeout docs when ready

### 2026-02-26 - CMB-11 partial (Phase D kickoff implemented as schema-light derived "Fix Later Queue" in Inventory)
- Agent: `Codex`
- Scope:
  - start Inventory Plan Phase D with a minimal non-blocking enrichment queue kickoff slice
  - prefer schema-light implementation first (derived queue from existing persisted metadata) to reduce risk/churn while Refactor Phase 8 remains open
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint app\\actions\\core\\inventory.ts src\\features\\inventory\\server\\index.ts src\\features\\inventory\\server\\inventory.repository.ts src\\features\\inventory\\server\\inventory.service.ts src\\features\\inventory\\ui\\InventoryListPageClient.tsx` -> PASS
- Source plan updates:
  - `docs/inventoryintakeplan.md`:
    - `Latest Update` entry added for Phase D kickoff slice
    - `Current Status` updated (`Phase D` -> partial)
    - `Pick Up Here` item 9 marked complete and advanced to Phase D continuation tasks
- Result summary:
  - derived inventory enrichment queue computes optional "Fix Later" suggestions from existing `InventoryItem` + `ItemBarcode` + `GlobalBarcodeCatalog` metadata
  - queue surfaced in Inventory list UI with summary counts + top candidates
  - no schema changes/migration yet; persistent task state and queue actions remain next
- Next recommended:
  - continue `CMB-11` with persistent task state/actions (complete/defer/snooze) and explicit queue resolution workflow
  - later return to `CMB-10` for integrated manual smoke + final Phase 8 closeout docs

### 2026-02-26 - CMB-10 deferral decision: manual core-flow smoke postponed to final integrated QA; switch next focus to CMB-11
- Agent: `Codex`
- Scope:
  - record user-approved deferral of Phase 8 manual smoke
  - update combined-plan sequencing so Inventory Phase D kickoff becomes the next active task
- Validation run:
  - `Documentation update only` -> no new commands run
- Source plan updates:
  - `docs/app-structure-refactor-agent-playbook.md`:
    - Phase 8 status/notes updated to reflect manual smoke deferral
    - handoff log entry added for the deferral decision
- Next recommended:
  - start `CMB-11` (Inventory Phase D kickoff: optional enrichment tracking + non-blocking "fix later" flow)
  - return to `CMB-10` later for one integrated manual smoke pass and Phase 8 final closeout documentation

### 2026-02-26 - CMB-10 partial (static verification + localhost route HEAD smoke completed; manual core-flow smoke/final closeout pending)
- Agent: `Codex`
- Scope:
  - continue Refactor Phase 8 by running the final static verification commands and checking route availability on localhost
  - sync the coordination file with the updated CMB-10 checkpoint
- Validation run:
  - `npm run lint` -> FAIL (known baseline errors/noise incl. generated `playwright-report` assets; also warnings)
  - `node --test app/actions/core/barcode-resolver-core.test.mjs` -> FAIL (`ERR_MODULE_NOT_FOUND` for extensionless ESM import path)
  - `node --test app/actions/core/barcode-resolver-cache.test.mjs` -> PASS (`5/5`)
  - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -> PASS (`10/10`)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `localhost HEAD smoke (/ /shopping /receive /inventory /contacts /staff)` -> PASS (`200` for all)
- Source plan updates:
  - `docs/app-structure-refactor-agent-playbook.md`:
    - `Latest completed checkpoint` updated to Phase 8 validation partial
    - `Last validation status` refreshed with exact command results
    - Phase 8 checklist item `Run final lint and targeted tests` marked complete
    - new Phase 8 handoff entry appended
- Next recommended:
  - continue `CMB-10` with final accepted exceptions/path-map docs and explicit decision on zero-wrapper-removal closeout vs additional migrations
  - run manual core-flow smoke checklist while localhost is available (if doing full Phase 8 closeout now)

### 2026-02-26 - CMB-10 partial (file-level wrapper matrix drafted; final verification and exceptions closeout pending)
- Agent: `Codex`
- Scope:
  - continue Refactor Phase 8 after kickoff audit by producing a file-level wrapper keep/defer/remove matrix
  - sync the coordination file to reflect the new CMB-10 partial checkpoint
- Validation run:
  - `Wrapper inventory outputs from the CMB-10 kickoff audit were reused (no new runtime/static validation commands run in this sub-step)`
- Source plan updates:
  - `docs/app-structure-refactor-agent-playbook.md`:
    - `Latest completed checkpoint` updated to file-level matrix draft
    - new Phase 8 handoff entry appended
    - Phase 8 section now includes a file-level matrix covering all `41` wrappers
- Next recommended:
  - continue `CMB-10` with final verification (`npm run lint`, targeted node tests, `npx tsc --noEmit --incremental false`)
  - document final accepted exceptions (including shopping route-shell deviation), then assess whether any wrapper removals are actually safe this phase

### 2026-02-26 - CMB-10 partial (Phase 8 kickoff audit completed; wrapper decisions documented, final verification pending)
- Agent: `Codex`
- Scope:
  - begin Refactor Phase 8 by auditing remaining transitional wrappers and repo-wide legacy import usage
  - sync the refactor playbook and this coordination file to reflect Phase 8 in-progress status
- Validation run:
  - `rg -n "Transitional wrapper during app-structure refactor" app src lib components` -> `41` wrappers found
  - repo-wide legacy import usage counts (excluding `lib/generated/**`):
    - `@/core/*` -> `26` files
    - `@/components/*` -> `9` files
    - `@/modules/*` -> `4` files
    - `@/lib/config/*` -> `9` files
    - `@/lib/supabase/*` -> `1` file
    - `@/lib/google/*` -> `0` files
  - `Get-Content app\\(dashboard)\\shopping\\page.tsx` review -> route remains large (state extracted, JSX mostly still in route file)
- Source plan updates:
  - `docs/app-structure-refactor-agent-playbook.md`:
    - `Current Status Snapshot` -> Phase 8 in progress
    - Phase 8 checklist item 1 marked complete
    - Phase 8 kickoff audit snapshot added
    - new handoff log entry appended
- Next recommended:
  - continue `CMB-10` with a file-level wrapper keep/defer/remove matrix + intentional exceptions list
  - run final validation pass (lint/tests/tsc) and manual smoke when localhost is running

### 2026-02-26 - Coordination resync: source plans advanced to Inventory Phase E complete + Refactor Phase 7 complete (Phase 8 ready)
- Agent: `Codex`
- Scope:
  - review `docs/inventoryintakeplan.md` and `docs/app-structure-refactor-agent-playbook.md` current status/next-step sections
  - refresh this combined coordination file so task ordering matches current source-plan reality
- Validation run:
  - `Documentation state review only` -> complete (no code/runtime validation executed)
- Source plan updates:
  - `None (source plans already contained the current authoritative statuses; this was a coordination-file sync)`
- Coordination updates in this file:
  - `Current Combined Snapshot` refreshed (Refactor `Phase 8 ready`; Inventory Phase E complete, Phase D next)
  - `CMB-07` marked complete (Refactor Phase 6)
  - `CMB-08` marked complete (decision gate resolved by sequencing outcome: Phase D deferred until after Refactor Phase 7)
  - `CMB-09` marked complete (Refactor Phase 7)
  - added `CMB-11` for actual Inventory Phase D kickoff work
  - `Active Work Lock` next-task recommendation updated to `CMB-10` / `CMB-11`
- Next recommended:
  - `CMB-10` Phase 8 kickoff audit/final-verification planning in `docs/app-structure-refactor-agent-playbook.md`
  - then `CMB-11` Inventory Phase D minimal enrichment/"fix later" kickoff in canonical files

### 2026-02-26 - Inventory Plan Phase E step 6 completed (barcode lookup churn abuse prevention)
- Agent: `Codex`
- Scope:
  - harden `app/actions/core/barcode-resolver.ts` against repeated barcode lookup churn that repeatedly hits external providers
  - enforce unresolved cache `retry_after_at` backoff and add process-local barcode/global burst cooldowns
  - preserve external-hit UX during cooldown by serving cached external metadata when available
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Source plan updates:
  - `docs/inventoryintakeplan.md` `Latest Update` entry added for Phase E step 6
  - `docs/inventoryintakeplan.md` `Pick Up Here` step 6 marked complete
  - `docs/inventoryintakeplan.md` `Pick Up Here` primary continuation task advanced to Phase E step 7 (background retry scheduling)
  - `docs/inventoryintakeplan.md` `Current Status` Phase E wording refreshed
- Next recommended:
  - inventory plan Phase E step 7 (background retry scheduling for unresolved barcodes)
  - or resume combined refactor sequence at `CMB-07` (Phase 6 inventory/contacts/staff extraction)

### 2026-02-26 - CMB-06 completed (Phase 5 receive UI split + shared contracts/constants)
- Agent: `Codex`
- Scope:
  - close out Phase 5 after receive UI extraction by recording manual smoke validation results
  - synchronize refactor playbook + combined coordination docs
- Validation run:
  - `Manual receive smoke validation` -> PASS (user-reported for `/receive`, barcode, manual, photo, receipt, and receipt detail page/tab switching)
  - `npx tsc --noEmit --incremental false` -> PASS (from extraction pass)
- Source plan updates:
  - `docs/app-structure-refactor-agent-playbook.md` `Update Here` set to `Phase 5 complete - Ready for Phase 6`
  - Phase 5 checklist manual validation item marked complete
  - Phase Completion Ledger marked Phase 5 complete
  - Phase 5 completion handoff entry appended
- Next recommended:
  - `CMB-07` (App Refactor Phase 6: inventory/contacts/staff extraction)
  - alternatively continue inventory plan Phase E step 6/7 if prioritizing barcode abuse controls and unresolved-barcode retries before refactor Phase 6

### 2026-02-26 - CMB-06 partial (Phase 5 receive UI split extracted; manual validation pending)
- Agent: `Codex`
- Scope:
  - extract receive route UI into `src/features/receiving/*/ui/*` plus `src/features/receiving/shared/*`
  - convert `app/(dashboard)/receive/*` routes to thin wrappers
  - centralize duplicate receive unit options and shared item/receipt UI DTOs
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Source plan updates:
  - `docs/app-structure-refactor-agent-playbook.md` `Update Here` refreshed for Phase 5 in-progress state
  - Phase 5 checklist updated (manual receive-flow validation still unchecked)
  - Phase 5 handoff log entry appended with changed files + next step
- Next recommended:
  - finish CMB-06 by running manual smoke validation for receive barcode/photo/manual/receipt flows
  - if behavior is unchanged, mark Phase 5 complete in `docs/app-structure-refactor-agent-playbook.md` and `CMB-06` complete here

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
