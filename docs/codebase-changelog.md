# Codebase Changelog

Status: Active (living document)
Last Updated: 2026-02-28
Primary Purpose: Chronological engineering changelog and validation record.

Companion overview: `docs/codebase-overview.md`

## Agent Note (Required)

- If anything fundamentally new is implemented in how the app works, functions, or what it offers, you must also open `docs/codebase-overview.md` and update the relevant section(s) so the overview matches reality.
- Example: if the Inventory system changes enough that the current Inventory section no longer accurately describes the app, update that Inventory section in `docs/codebase-overview.md` as part of the same change.

## Changelog Usage

- Append new entries at the top (newest first).
- Every entry must include `- Suggested Commit Title: ...` directly under the entry heading.
- Record validation commands actually run (and failures/exceptions) in each entry.
- Do not delete historical entries; add corrections as new entries.

## Changelog (Append New Entries At Top)

### 2026-02-28 - RPK-03 completed: receipt commit gate + parsed-produce decision checklist

- Suggested Commit Title: `feat(rpk-03): gate receipt commit behind explicit produce decisions`
- Scope: Receipt decoupling and confirmation flow (`RPK-03`) with additive receipt-line decision persistence.
- Constitution Restatement:
  - Task ID: `RPK-03`
  - Scope sentence: remove direct receipt commit behavior by gating commit and add parsed-produce checklist decisions with persistence.
  - Invariants confirmed: receipts do not auto-create inventory; inventory writes remain explicit/eligibility-gated; unresolved produce decisions persist for Fix Later follow-up.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
- Deliverables:
  - Added additive schema support for receipt produce decisions:
    - `ReceiptInventoryDecision` enum
    - `ReceiptLineItem.inventory_decision`
    - `ReceiptLineItem.inventory_decided_at`
  - Added migration `20260228102000_receipt_inventory_decisions` and applied it safely via `prisma db execute` + `prisma migrate resolve`.
  - Added `setReceiptProduceDecision` and `finalizeReceiptReview` actions in receipt module flow.
  - Added commit gating in `commitReceiptTransactions`:
    - blocks pending produce decisions
    - blocks produce lines not marked `add_to_inventory`
  - Added parsed-produce checklist UI with `yes/no/resolve later` and `select all yes/no`.
  - Added auto-advance highlight behavior for pending produce decisions.
  - Preserved receipt parse/review flow and expense-only outcomes.
- Touched Files (single-entry log):
  - `prisma/schema.prisma` (updated)
  - `prisma/migrations/20260228102000_receipt_inventory_decisions/migration.sql` (added)
  - `app/actions/modules/receipts.ts` (updated)
  - `app/actions/core/transactions.ts` (updated)
  - `src/features/receiving/receipt/server/line-item.service.ts` (updated)
  - `src/features/receiving/receipt/server/receipt.repository.ts` (updated)
  - `src/features/receiving/shared/contracts.ts` (updated)
  - `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/codebase-overview.md` (updated)
  - `docs/codebase-changelog.md` (updated)
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
  - Changed runtime files: 8.
  - Delta rationale: exact RPK-03 scope (receipt commit gate + produce checklist decisions + persistence).
- Unrelated-file check:
  - Pre-existing dirty/untracked files existed in workspace before this slice; this slice changed only receipt RPK-03 runtime paths and required canonical docs.
- Dependency change check: no new dependencies added.
- Env-var change check: no new env vars introduced.
- Commit checkpoint:
  - Commit hash: pending (recorded in run output after commit)
  - Commit title: `feat(rpk-03): gate receipt commit behind explicit produce decisions`

### 2026-02-28 - RPK-02 completed: shopping produce autosuggest + intake-source eligibility enforcement

- Suggested Commit Title: `feat(rpk-02): add produce autosuggest and enforce shopping intake-source eligibility`
- Scope: Shopping intake behavior alignment for launch (`RPK-02`) with no destructive schema changes.
- Constitution Restatement:
  - Task ID: `RPK-02`
  - Scope sentence: keep barcode path inventory-eligible, add produce autosuggest + quantity add, and enforce manual/shelf expense-only policy.
  - Invariants confirmed: no product fork; receipts do not auto-create inventory; inventory writes explicit/eligibility-gated; unresolved produce still routes to Fix Later.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
- Deliverables:
  - Added `searchProduceCatalog` server action querying EN `produce_items`.
  - Added produce quick-search autosuggest and quantity-first add flow in shopping UI/hook.
  - Added shopping item intake-source metadata (`resolution_audit`) at creation time.
  - Enforced launch policy in commit flow:
    - `manual_entry` and `shelf_label_scan` items remain expense-only
    - barcode and produce-search paths remain inventory-eligible
  - Preserved expense ledger posting behavior for full shopping session totals.
- Touched Files (single-entry log):
  - `app/actions/modules/shopping.ts` (updated)
  - `src/features/shopping/ui/use-shopping-session.ts` (updated)
  - `app/(dashboard)/shopping/page.tsx` (updated)
  - `src/features/shopping/server/commit.service.ts` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/codebase-overview.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - `npx eslint app/actions/modules/shopping.ts src/features/shopping/server/commit.service.ts src/features/shopping/ui/use-shopping-session.ts app/(dashboard)/shopping/page.tsx` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - Changed files: 8.
  - Delta rationale: exactly the shopping action/server/ui/doc paths required for RPK-02.
- Unrelated-file check:
  - Pre-existing dirty files remained; this slice touched only shopping intake-policy and required canonical docs.
- Dependency change check: no new dependencies added.
- Env-var change check: no new env vars introduced.

### 2026-02-28 - RPK-01 completed: signup place capture + additive business place metadata persistence

- Suggested Commit Title: `feat(rpk-01): add optional restaurant place capture in signup and persist on business`
- Scope: Signup/business provisioning alignment (`RPK-01`) with additive schema changes only.
- Constitution Restatement:
  - Task ID: `RPK-01`
  - Scope sentence: keep industry selection canonical while adding optional restaurant place metadata capture/persistence.
  - Invariants confirmed: no product fork; receipts do not auto-create inventory; inventory writes remain explicit/eligibility-gated; unresolved produce still routes to Fix Later.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
- Deliverables:
  - Preserved `industry_type` as canonical signup input path.
  - Added optional restaurant place metadata fields to signup UI with explicit skip posture.
  - Extended provisioning flow to persist optional place metadata on `Business`.
  - Added additive migration `20260228060000_business_profile_place_metadata`.
  - Applied migration via safe fallback because `prisma migrate dev` hit pre-existing `P3006` shadow-db issue.
- Touched Files (single-entry log):
  - `app/auth/signup/page.tsx` (updated)
  - `app/actions/core/auth.ts` (updated)
  - `lib/core/auth/tenant.ts` (updated)
  - `prisma/schema.prisma` (updated)
  - `prisma/migrations/20260228060000_business_profile_place_metadata/migration.sql` (added)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/codebase-overview.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - `npx prisma db execute --file prisma/migrations/20260228060000_business_profile_place_metadata/migration.sql` -> PASS
  - `npx prisma migrate resolve --applied 20260228060000_business_profile_place_metadata` -> PASS
  - `npx prisma migrate status` -> PASS
  - `npx prisma generate` -> PASS
  - `npx prisma validate` -> PASS
  - `npx eslint app/auth/signup/page.tsx app/actions/core/auth.ts lib/core/auth/tenant.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - Changed files: 9.
  - Delta rationale: exact RPK-01 scope (signup/provisioning + additive schema + canonical docs sync).
- Unrelated-file check:
  - Pre-existing dirty docs remained untouched outside this slice's canonical sync files.
- Dependency change check: no new dependencies added.
- Env-var change check: no new env vars introduced.

### 2026-02-28 - RPK-00 completed: launch support map + intake invariant/source eligibility contracts

- Suggested Commit Title: `feat(rpk-00): lock launch support map and intake eligibility contracts`
- Scope: Contract/config baseline for `RPK-00` plus canonical tracker sync.
- Constitution Restatement:
  - Task ID: `RPK-00`
  - Scope sentence: add shared launch-support and intake-policy contracts without runtime flow rewiring.
  - Invariants confirmed: receipts do not auto-create inventory; inventory writes explicit/eligibility-gated; unresolved produce routes to Fix Later.
  - Validation controls confirmed: proportional diff, unrelated-file check, dependency check, env-var check.
- Deliverables:
  - Added `INDUSTRY_LAUNCH_SUPPORT_MAP` and `isIndustryLaunchReady()` to shared presets.
  - Added intake invariant lock and launch source/eligibility vocabulary in `intake.contracts.ts`.
  - Advanced RPK source plan + master plan markers to `RPK-01` and recalculated completion snapshot (3/50, 6.00%).
  - Synced codebase overview intake capability section to reflect the new launch-policy contract layer.
- Touched Files (single-entry log):
  - `lib/config/presets.ts` (updated)
  - `src/features/intake/shared/intake.contracts.ts` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/codebase-overview.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - `node --test src/features/intake/shared/intake-capability.service.test.mjs` -> PASS (17/17)
  - `node --test src/features/intake/shared/intake-session.contracts.test.mjs` -> PASS (18/18)
  - `npx eslint src/features/intake/shared/intake.contracts.ts lib/config/presets.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Diff proportionality:
  - Changed files: 6 (runtime + required canonical docs).
  - Delta rationale: exact RPK-00 scope (contract/config lock + mandatory tracker sync), no feature-surface expansion.
- Unrelated-file check:
  - Pre-existing dirty docs existed in the workspace; this slice did not modify unrelated runtime areas outside RPK-00 scope.
- Dependency change check: no new dependencies added.
- Env-var change check: no new env vars introduced.

### 2026-02-28 - governance update: per-step git commit checkpoint enforced across canonical plans

- Suggested Commit Title: `docs(governance): require scoped commit after each completed checklist step`
- Scope: Documentation governance update only (no runtime/schema code changes).
- Deliverables:
  - Added immutable per-step commit rule to the execution constitution.
  - Added commit checkpoint requirements to master plan validation/docs-sync/session template.
  - Added commit checkpoint controls to overnight autonomy protocol.
  - Propagated commit checkpoint requirements into active source plans (`RPK`, `RTS`, `IMG`, `UX`) and parked `DI` resume workflow.
- Touched Files (single-entry log):
  - `docs/execution-constitution.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/OVERNIGHT_EXECUTION_PROTOCOL.md` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/restaurant-table-service-plan.md` (updated)
  - `docs/item-image-enrichment-plan.md` (updated)
  - `docs/inventory-shopping-ux-redesign-plan.md` (updated)
  - `docs/document-intake-pipeline-plan.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - targeted docs consistency scan for commit-checkpoint language across canonical docs -> PASS
  - no code compile/test/lint run in this docs-only slice

### 2026-02-28 - overnight autonomy contract upgraded to full completion mode

- Suggested Commit Title: `docs(protocol): switch overnight execution to full-completion autonomy mode`
- Scope: Documentation governance update only (no runtime/schema code changes).
- Deliverables:
  - Replaced overnight protocol with a full completion-mode autonomy contract.
  - Added explicit "continue unless dangerous" mandate with strict hard-stop limits.
  - Added autonomous ambiguity resolution with `ASSUMED - SAFE` logging requirement.
  - Added additive-only DB migration policy and no-permission-loop clause.
  - Added sequence-gate optimization guidance for advancing any eligible stream without stalling.
  - Preserved mandatory validation, restatement, and documentation-sync control rails.
- Touched Files (single-entry log):
  - `docs/OVERNIGHT_EXECUTION_PROTOCOL.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - targeted protocol consistency pass against `docs/master-plan-v2.md` and `docs/execution-constitution.md` -> PASS
  - no code compile/test/lint run (docs-only slice)

### 2026-02-28 - overnight protocol migrated to v2 canonical execution model

- Suggested Commit Title: `docs(protocol): rebase overnight execution protocol from v1 to v2`
- Scope: Documentation governance update only (no runtime/schema code changes).
- Deliverables:
  - Replaced v1-anchored overnight protocol with v2 canonical execution rules.
  - Updated execution anchor to `master-plan-v2` + `execution-constitution` + active source-plan set.
  - Added deterministic selection and sequence-gate alignment for RPK/RTS/IMG-L/UX-L/LG and DI post-launch resume.
  - Added explicit mandatory restatement requirement before each task.
  - Synced validation, stop conditions, invariant set, and documentation sync workflow to current v2 controls.
- Touched Files (single-entry log):
  - `docs/OVERNIGHT_EXECUTION_PROTOCOL.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - targeted doc consistency read against `docs/master-plan-v2.md` and `docs/execution-constitution.md` -> PASS
  - no code compile/test/lint run (docs-only slice)

### 2026-02-28 - mandatory restatement gate propagation across remaining supporting plans

- Suggested Commit Title: `docs(governance): add constitution restatement gate to remaining support plans`
- Scope: Documentation governance update only (no runtime/schema code changes).
- Deliverables:
  - Added explicit constitution source references and mandatory restatement gates to plans that were missing them.
  - Standardized pre-task re-grounding language so supporting plans consistently require re-reading/restating guidelines before execution.
  - Added resume-ready restatement gate to the parked DI plan for future reactivation consistency.
- Touched Files (single-entry log):
  - `docs/item-image-enrichment-plan.md` (updated)
  - `docs/inventory-shopping-ux-redesign-plan.md` (updated)
  - `docs/document-intake-pipeline-plan.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - targeted docs consistency scan for mandatory restatement gate presence -> PASS
  - no code compile/test/lint run (docs-only slice)

### 2026-02-28 - stall-point elimination update: RTS decision lock + RPK targets + launch-slice scope confirmation

- Suggested Commit Title: `docs(plan): lock RTS schema decisions, embed RPK file targets, and finalize LG/UX-L/IMG-L launch scope`
- Scope: Documentation planning/governance update only (no runtime/schema code changes in this slice).
- Deliverables:
  - Locked RTS schema and lifecycle decisions in the RTS source plan (DiningTable/MenuCategory/MenuItem/TableSession/KitchenOrder/KitchenOrderItem).
  - Removed amendment-ticket assumption and aligned to same-order item append behavior for post-confirm host edits.
  - Synced master tracker RTS checklist language to the resolved queue/session lifecycle.
  - Added explicit LG-00 smoke test format lock (`node --test` integration-first; Playwright only for browser-only cases).
  - Confirmed launch UX scope as UX-00 primitives only and explicitly deferred UX-01/UX-02.
  - Confirmed launch IMG scope as IMG-00 + IMG-01 only with no enrichment-run/pre-population requirement.
  - Added RPK preflight file-target map (`RPK-01` through `RPK-05`) to remove discovery stall points.
- Touched Files (single-entry log):
  - `docs/restaurant-table-service-plan.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/item-image-enrichment-plan.md` (updated)
  - `docs/inventory-shopping-ux-redesign-plan.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - targeted preflight file discovery via `rg` and direct file reads -> PASS
  - docs consistency pass across source plans and master tracker -> PASS
  - no runtime tests/typecheck/lint run (docs-only slice)

### 2026-02-28 - ui/ux design constitution enforcement across canonical plans

- Suggested Commit Title: `docs(ux-constitution): enforce minimal design rules and ui validation gates across active plans`
- Scope: Documentation governance update only (no runtime/schema code changes).
- Deliverables:
  - Added formal UI/UX Design Constitution rules to immutable execution constitution.
  - Extended constitution restatement template with mandatory UI confirmations for UI-touching tasks.
  - Updated master tracker to enforce UI governance in compressed invariants, mandatory restatement, and validation gate.
  - Added explicit UX constitution overlay and per-phase design-restatement checklist steps in the UX redesign plan.
  - Removed/overrode conflicting UX guidance (custom color hash placeholders, amber-only badge guidance, blur/glass top bar suggestion) in favor of token-governed minimal styling.
  - Added explicit UI-constitution references in active restaurant-launch source plans where UI work can occur.
- Touched Files (single-entry log):
  - `docs/execution-constitution.md` (updated)
  - `docs/master-plan-v2.md` (updated)
  - `docs/inventory-shopping-ux-redesign-plan.md` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/restaurant-table-service-plan.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - docs rule propagation and section-presence review -> PASS
  - no code compile/test/lint run (docs-only slice)

### 2026-02-28 - execution governance hardening: constitution + validation/deviation controls + plan format normalization

- Suggested Commit Title: `docs(plan): add immutable constitution and normalize active launch plans to strict execution format`
- Scope: Documentation governance update only (no runtime/schema code changes).
- Deliverables:
  - Added immutable constitution source file and linked it from active plans.
  - Upgraded `docs/master-plan-v2.md` with:
    - compressed invariant block for context compaction survival
    - mandatory pre-task restatement gate
    - explicit deviation proposal workflow
    - expanded validation gate (proportional diff, unrelated-file check, dependency/env checks)
    - completion percentage section and documentation sync checklist aligned to execution controls
  - Normalized active source plans to explicit in-progress/checklist format:
    - `docs/business-industry-packaging-refactor-plan.md`
    - `docs/restaurant-table-service-plan.md`
  - Added per-phase constitution-restatement checklist steps so immutable constraints are repeated at every phase boundary.
- Touched Files (single-entry log):
  - `docs/execution-constitution.md` (created)
  - `docs/master-plan-v2.md` (updated)
  - `docs/business-industry-packaging-refactor-plan.md` (updated)
  - `docs/restaurant-table-service-plan.md` (updated)
  - `docs/codebase-changelog.md` (updated)
- Validation:
  - docs structure and checklist consistency review -> PASS
  - no code compile/test/lint run (docs-only slice)

### 2026-02-28 - docs rebase: restaurant launch canonical tracker + RTS plan + launch-slice alignment

- Suggested Commit Title: `docs(plan): rebase v2 to restaurant launch and add RTS source plan`
- Scope: Documentation planning update only (no runtime/schema code changes).
- Deliverables:
  - Added `docs/restaurant-table-service-plan.md` as dedicated source plan for table QR + host/kitchen operations.
  - Reworked `docs/business-industry-packaging-refactor-plan.md` to active restaurant launch posture with Track A (intake slice 1-8) and Track B continuation.
  - Rewrote `docs/master-plan-v2.md` as canonical restaurant-first tracker (RPK/RTS/IMG-L/UX-L active, DI parked post-launch).
  - Updated `docs/document-intake-pipeline-plan.md` status to parked post-launch with explicit resume trigger.
  - Updated `docs/item-image-enrichment-plan.md` and `docs/inventory-shopping-ux-redesign-plan.md` to reflect launch-slice priority posture.
- Validation:
  - docs consistency review across source plans and v2 tracker -> PASS
  - no build/test commands run (docs-only update)

### 2026-02-27 - OC-07: close operational calendar plan and archive tracker to v2 standby

- Suggested Commit Title: `chore(oc-07): close operational calendar plan and archive master tracker into v2 scaffold`
- Scope: Operational Calendar Phase 6 closeout - plan/status closure only (docs slice).
- Preflight evidence:
  - Reviewed OC-07 checklist + closure requirements in `docs/master-plan-v1.md` and `docs/operational-calendar-schedule-plan.md`.
  - Verified no existing v2 tracker file (`rg --files docs | rg "master-plan-v2|master-plan"`).
  - Confirmed docs-only scope; no runtime/schema changes.
- Deliverables:
  - `docs/operational-calendar-schedule-plan.md`: status moved to COMPLETE; Pick Up Here closed; OC-07 closure entry added.
  - `docs/master-plan-v1.md`: MP-01 + OC-07 marked `[x]`; completion moved to 38/38 (100%); status set to archived; Last Left Off marked `NONE`; OC-07 job summary added.
  - `docs/master-plan-v2.md` (NEW): standby successor execution tracker scaffold.
  - `docs/codebase-overview.md`: updated to reflect Operational Calendar completion and v1->v2 tracker transition.
- Validation:
  - docs closure consistency review -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS (baseline docs-only gate)
- Master plan: MP-01/OC-07 `[x]`; completion 38/38 = 100.00%; no open checklist items.
### 2026-02-27 - OC-06: Phase 5 hardening and ops readiness - reliability metrics, load guard, permission/audit utilities

- Suggested Commit Title: `feat(oc-06): add schedule ops hardening metrics, load guard, and permission/audit utilities`
- Scope: Operational Calendar Phase 5 - sync reliability metrics, duplicate suppression accuracy surfaces, load/performance tuning guardrails, and permission/audit hardening.
- Preflight evidence:
  - Source plan section reviewed: `docs/operational-calendar-schedule-plan.md` -> `### Phase 5 - Hardening and operational metrics`
  - Reuse-first scans:
    - `rg -n "sync reliability|duplicate suppression|accuracy|performance|permission|audit|ops|metrics|stale|lock" src/features/schedule src/features/integrations src/server docs`
    - `rg --files src/features/schedule | rg "metrics|ops|audit|permission|policy|perf|performance"`
  - Reused existing schedule sync/event contracts and OC-04/OC-05 service boundaries; no duplicate event schema or migrations introduced.
  - DB/Prisma integrity preflight (no schema change): reviewed `prisma/schema.prisma` and latest migration `prisma/migrations/20260228013000_income_event_pilot/migration.sql`.
- New files:
  - `src/features/schedule/shared/schedule-ops.contracts.ts`: ops summary/load-cap/permission/audit contracts.
  - `src/features/schedule/server/schedule-ops.service.ts`: ops hardening service (`deriveScheduleOpsHealthSummary`, `applyCalendarLoadGuard`, `evaluateCalendarPermission`, `buildCalendarAuditEntry`).
  - `src/features/schedule/server/schedule-ops.service.test.ts`: targeted ops hardening tests (5).
- Updated files:
  - `src/features/schedule/shared/index.ts`: exports ops contracts.
  - `src/features/schedule/server/index.ts`: exports ops service APIs.
  - `src/features/schedule/ui/ScheduleClient.tsx`: adds `OpsDiagnosticsBar` shell.
  - `docs/operational-calendar-schedule-plan.md`: Pick Up Here advanced to OC-07; Latest Update entry added for OC-06 completion.
  - `docs/master-plan-v1.md`: OC-06 marked `[x]`; completion updated to 36/38 (94.74%); left-off moved to OC-07; OC-06 job summary appended.
  - `docs/codebase-overview.md`: Operational Calendar status/capabilities updated for Phase 5 hardening.
- Validation:
  - `npx tsx --test src/features/schedule/server/scheduling-sync.service.test.ts src/features/schedule/server/schedule-suggestion.service.test.ts src/features/schedule/server/schedule-ops.service.test.ts` -> PASS (15/15)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/schedule/shared/index.ts src/features/schedule/shared/schedule-ops.contracts.ts src/features/schedule/server/index.ts src/features/schedule/server/schedule-ops.service.ts src/features/schedule/server/schedule-ops.service.test.ts src/features/schedule/ui/ScheduleClient.tsx --max-warnings=0` -> PASS
- Master plan: OC-06 `[x]`; completion 36/38 = 94.74%; next OC-07.

### 2026-02-27 - OC-05: Phase 4 cross-feature suggestion engine - delivery/intake, booking/inventory, job/material-gap signals

- Suggested Commit Title: `feat(oc-05): add cross-feature schedule suggestion contracts, derivation service, and rail shell`
- Scope: Operational Calendar Phase 4 - suggestions/alerts only (no auto-commits) for delivery-intake coordination, booking inventory coverage, and job material-gap warnings.
- Preflight evidence:
  - Source plan section reviewed: `docs/operational-calendar-schedule-plan.md` -> `### Phase 4 - Cross-feature suggestion engine`
  - Reuse-first scans:
    - `rg -n "delivery.?intake|booking.?inventory|material.?gap|suggestion engine|cross-feature suggestion|schedule suggestion|operational suggestion" src app test docs`
    - `rg --files src app test | rg "suggest|hint|gap|schedule"`
  - Reused `CalendarEventSummary` contracts and OC-04 schedule-provider normalization/conflict outputs; no duplicate event model introduced.
  - DB/Prisma integrity preflight (no schema change): reviewed `prisma/schema.prisma` and latest migration `prisma/migrations/20260228013000_income_event_pilot/migration.sql`.
- New files:
  - `src/features/schedule/shared/schedule-suggestions.contracts.ts`: suggestion vocabulary, severity/action contracts, and signal DTOs.
  - `src/features/schedule/server/schedule-suggestion.service.ts`: deterministic suggestion derivation for delivery->intake coverage, booking inventory deficit hints, and job material-gap warnings.
  - `src/features/schedule/server/schedule-suggestion.service.test.ts`: rule-path coverage (5 tests).
- Updated files:
  - `src/features/schedule/shared/index.ts`: exports suggestion contracts.
  - `src/features/schedule/server/index.ts`: exports `deriveScheduleOperationalSuggestions`.
  - `src/features/schedule/ui/ScheduleClient.tsx`: adds `OperationalSuggestionsRail` shell with safe empty state.
  - `docs/operational-calendar-schedule-plan.md`: Pick Up Here advanced to OC-06; Latest Update entry added for OC-05 completion.
  - `docs/master-plan-v1.md`: OC-05 marked `[x]`; completion updated to 35/38 (92.11%); left-off moved to OC-06; OC-05 job summary appended.
  - `docs/codebase-overview.md`: Operational Calendar status/capabilities updated for OC-05 suggestion layer.
- Validation:
  - `npx tsx --test src/features/schedule/server/scheduling-sync.service.test.ts src/features/schedule/server/schedule-suggestion.service.test.ts` -> PASS (10/10)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/schedule/shared/index.ts src/features/schedule/shared/schedule-suggestions.contracts.ts src/features/schedule/server/index.ts src/features/schedule/server/schedule-suggestion.service.ts src/features/schedule/server/schedule-suggestion.service.test.ts src/features/schedule/ui/ScheduleClient.tsx --max-warnings=0` -> PASS
- Master plan: OC-05 `[x]`; completion 35/38 = 92.11%; next OC-06.

### 2026-02-27 - OC-04: Phase 3 scheduling-platform expansion - connector registry, normalization contracts, conflict diagnostics

- Suggested Commit Title: `feat(oc-04): add scheduling-platform connectors, normalization contracts, and conflict diagnostics`
- Scope: Operational Calendar Phase 3 - appointment/reservation connector stubs, normalized mapping hardening, overlap/duplicate conflict handling.
- Preflight evidence:
  - Source plan section reviewed: `docs/operational-calendar-schedule-plan.md` -> `### Phase 3 - Scheduling-platform expansion`
  - Reuse-first scans:
    - `rg -n "connector|normalize|overlap|duplicate|dedupe|reservation|appointment" src app test docs`
    - `rg -n "schedule|calendar|provider|sync|conflict|dedupe|duplicate|overlap" test src/features/schedule`
  - Reused provider registry/normalization orchestration patterns from `src/features/integrations/providers/*` and `src/features/integrations/server/sync.service.ts`; no duplicate calendar implementation paths created.
  - DB/Prisma integrity preflight (no schema change in this slice): reviewed `prisma/schema.prisma` and latest migration `prisma/migrations/20260228013000_income_event_pilot/migration.sql`.
- New files:
  - `src/features/schedule/shared/schedule-normalization.contracts.ts`: scheduling-platform provider ID subset; normalized scheduling event contract; duplicate/overlap reason vocabulary; conflict-resolution result contracts.
  - `src/features/schedule/server/scheduling-connectors.ts`: scheduling connector registry (Square Appointments, Calendly, Mindbody, Fresha, Vagaro, OpenTable, Resy); env-driven fetch stubs; field-priority mapping, status normalization, fallback duration/timezone handling, deterministic fingerprint generation.
  - `src/features/schedule/server/schedule-conflict.service.ts`: duplicate suppression pipeline (`provider_external_id` -> `linked_entity` -> `fingerprint`) plus overlap detection (`staff_overlap`, `resource_overlap`, `time_overlap`).
  - `src/features/schedule/server/scheduling-sync.service.ts`: provider sync preview runner with fetched/normalized/dropped counts and conflict diagnostics.
  - `src/features/schedule/server/index.ts`: schedule server export surface.
  - `src/features/schedule/server/scheduling-sync.service.test.ts`: targeted OC-04 tests.
- Updated files:
  - `src/features/schedule/shared/index.ts`: exports OC-04 normalization/conflict contracts.
  - `docs/operational-calendar-schedule-plan.md`: Pick Up Here advanced to OC-05; Latest Update entry added for OC-04 completion.
  - `docs/master-plan-v1.md`: OC-04 marked `[x]`; Last Left Off moved to OC-05; completion updated to 34/38 (89.47%); OC-04 job summary appended.
  - `docs/codebase-overview.md`: Operational Calendar status/capabilities and schedule canonical paths updated for OC-04.
- Validation:
  - `npx tsx --test src/features/schedule/server/scheduling-sync.service.test.ts` -> PASS (5/5)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/schedule/shared/index.ts src/features/schedule/shared/schedule-normalization.contracts.ts src/features/schedule/server/index.ts src/features/schedule/server/scheduling-connectors.ts src/features/schedule/server/schedule-conflict.service.ts src/features/schedule/server/scheduling-sync.service.ts src/features/schedule/server/scheduling-sync.service.test.ts --max-warnings=0` -> PASS
- Master plan: OC-04 `[x]`; completion 34/38 = 89.47%; next OC-05.

### 2026-02-27 - OC-03: Phase 2 provider-sync foundation â€” calendar provider catalog, sync health contracts, SourceHealthBar

- Suggested Commit Title: `feat(oc-03): add calendar provider catalog, sync health contracts, and SourceHealthBar shell`
- Scope: Operational Calendar Phase 2 â€” provider catalog, sync health model, SourceHealthBar UI.
- Preflight evidence: no existing calendar provider or sync contracts â€” new files only; ScheduleClient updated to consume new shared exports.
- New files:
  - `src/features/schedule/shared/schedule-provider.contracts.ts`: 10-provider catalog across 3 types (general_calendar: Google Calendar, Outlook/M365, Apple ICS; booking_platform: Square Appointments, Calendly, Mindbody, Fresha, Vagaro; reservation_platform: OpenTable, Resy); `CalendarProviderDefinition` interface with auth method, supported event types, industry support, incremental sync + webhook capability flags; industry recommendation map; `listCalendarProvidersForIndustry`, `getCalendarProviderById`, `isCalendarProviderRecommendedForIndustry` helpers
  - `src/features/schedule/shared/schedule-sync.contracts.ts`: `CalendarSyncStatus` â€” 6-value vocabulary; `CalendarProviderSyncCard` normalized presentation shape; `CalendarSourceHealthSummary` aggregated health with `healthy | degraded | error` overall; `deriveCalendarSourceHealth` client-side derivation utility; `CALENDAR_PROVIDER_ACCENT_COLORS` â€” unique Tailwind color per provider; `getProviderAccentColor` helper; stale threshold constant (24h)
- Updated files:
  - `src/features/schedule/shared/index.ts`: re-exports all new provider catalog and sync health types/constants/utilities
  - `src/features/schedule/ui/ScheduleClient.tsx`: adds `SourceHealthBar` component â€” quiet "no sources" callout when empty; health status dot + connected count + per-provider accent dots when sync cards present; imports `deriveCalendarSourceHealth` from shared; doc header promoted to OC-02/OC-03; phase shell comment updated to point to OC-04
- Validation: `npx tsc --noEmit --incremental false` â†’ PASS; `npx eslint` on all 4 touched files â†’ PASS (0 errors)
- Master plan: OC-03 `[x]`; completion 33/38 = 86.84%

### 2026-02-27 - OC-02: Phase 1 master calendar shell â€” ScheduleClient (Day/Week/Month + source filters)

- Suggested Commit Title: `feat(oc-02): add ScheduleClient master calendar shell (Day/Week/Month, source filters, event grid)`
- Scope: Operational Calendar Phase 1 â€” master calendar shell UI.
- New files:
  - `src/features/schedule/ui/ScheduleClient.tsx`: "use client" component â€” Day/Week/Month toggle (week default), Manual/Internal/Connected source visibility filters, industry-aware subtitle, New Event CTA stub, WeekGridShell / DayColumnShell / MonthGridShell with today highlight
- Updated files:
  - `app/(dashboard)/schedule/page.tsx`: replaced Phase 0 placeholder with `ScheduleClient` wrapper
- Validation: `npx tsc --noEmit --incremental false` â†’ PASS; `npx eslint` â†’ PASS (0 errors)

### 2026-02-27 - OC-01: Phase 0 activation/baseline â€” schedule contracts, route shell, nav finalized

- Suggested Commit Title: `feat(oc-01): add schedule feature contracts, /schedule route shell, finalize nav order`
- Scope: Operational Calendar Phase 0 â€” vocabulary contracts, route shell, nav canonical order.
- Preflight evidence: no existing schedule/event/calendar code in src/ or app/ â€” greenfield.
- New files:
  - `src/features/schedule/shared/schedule.contracts.ts`: canonical event vocabulary (8 event types, source policy, editability rules, status vocab, view modes, CalendarEventSummary shape, industry emphasis map)
  - `src/features/schedule/shared/index.ts`: public barrel export
  - `app/(dashboard)/schedule/page.tsx`: Phase 0 route placeholder
  - `app/(dashboard)/schedule/layout.tsx`: no-gate layout
- Updated files:
  - `components/nav/bottom-nav.tsx`: nav order â†’ Home | Staff | Intake | Inventory | Schedule; Integrations removed from primary nav slots; `moduleId` field removed from NavItem type
- Validation: `npx tsc --noEmit --incremental false` â†’ PASS; `npx eslint` on all 5 files â†’ PASS (0 errors)

### 2026-02-27 - OC-00: execution gate confirmed â€” Operational Calendar plan unblocked

- Suggested Commit Title: `chore(oc-00): confirm OC execution gate â€” all prerequisites met, plan unblocked`
- Scope: OC-00 gate confirmation â€” no code changes; docs only.
- Gate verification:
  1. unified-inventory-intake-refactor-plan â†’ COMPLETE
  2. receipt-post-ocr-correction-plan â†’ COMPLETE
  3. income-integrations-onboarding-plan â†’ COMPLETE
  4. app-structure-refactor-agent-playbook â†’ COMPLETE (smoke passed)
  5. User confirmed OC as next initiative 2026-02-27
- Preflight: no existing `/schedule` route, no nav entry, no prior event model â€” clean greenfield start.
- `docs/operational-calendar-schedule-plan.md`: status â†’ GATE OPEN; all gate items `[x]`; Pick Up Here â†’ OC-01.
- `docs/master-plan-v1.md`: OC-00 â†’ `[x]`; completion â†’ 30/38 = 78.95%; Left Off Here â†’ OC-01.

### 2026-02-27 - fix(migrations): UUID â†’ TEXT correction for FK columns â€” all 5 pending migrations applied

- Suggested Commit Title: `fix(migrations): correct UUID to TEXT for FK columns â€” apply all 5 pending migrations`
- Scope: DB schema fix found during QA-00 manual smoke (shopping + receipt parse both failed).
- Root cause: 3 of the 5 pending migrations (`20260227230000`, `20260228010000`, `20260228013000`) declared `id` and FK columns as `UUID`, but the project DB uses `TEXT` for all IDs (Supabase convention: `TEXT DEFAULT gen_random_uuid()`).
- Files changed:
  - `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`: `UUID` â†’ `TEXT` for `id`, `business_id`, `supplier_id`
  - `prisma/migrations/20260228010000_income_oauth_core_infrastructure/migration.sql`: `UUID` â†’ `TEXT` for `id`, `business_id` (both tables)
  - `prisma/migrations/20260228013000_income_event_pilot/migration.sql`: `UUID` â†’ `TEXT` for `id`, `business_id`, `connection_id`
- Actions taken:
  - `npx prisma migrate resolve --rolled-back 20260227230000_receipt_parse_profile_memory`
  - `npx prisma migrate deploy` â†’ all 3 remaining migrations applied successfully
  - `npx prisma generate` â†’ Prisma client regenerated
  - `npx prisma validate` â†’ schema valid
  - `npx tsc --noEmit --incremental false` â†’ PASS
- DB state: all 20 migrations applied; schema up to date.

### 2026-02-27 - QA-00/QA-01: automated QA gate pass â€” manual smoke checklist compiled

- Suggested Commit Title: `chore(qa-00): run automated QA gates â€” all pass; manual smoke checklist ready for user`
- Scope: QA gate execution â€” automated portion complete; manual smoke pending user run.
- Automated tests run (all pass):
  - `intake-capability.service.test.mjs` â†’ 17/17
  - `intake-session.contracts.test.mjs` â†’ 18/18
  - `sync.service.test.mjs` â†’ 14/14
  - `receipt-correction-core.test.mjs` â†’ 14/14
  - `receipt-correction-fixtures.test.mjs` â†’ 27/27
  - `receipt.test.mjs` â†’ 7/7
  - Receipt feature services (correction + historical hints + parse profile + produce lookup) â†’ 13/13
  - Integrations catalog + oauth â†’ 6/6
  - Uber Eats + DoorDash provider adapters â†’ 25/25
  - **Total: 141 tests â€” 0 failures**
  - `npx tsc --noEmit --incremental false` â†’ PASS
- Manual smoke checklist (18 items across 3 source plans) compiled into `docs/master-plan-v1.md` â†’ `## Last Left Off Here`.
- No code changes this slice; QA-00/QA-01 marked `[~]` (pending user run).

### 2026-02-27 - UI-05/UI-06: unified intake cleanup + plan closure

- Suggested Commit Title: `chore(ui-05): clean up migration-era comments â€” unified intake refactor complete`
- Scope: Phase 5 cleanup/deprecation + plan closure for the Unified Inventory Intake Refactor plan.
- Preflight evidence (reuse/refactor-first):
  - Scanned all intake/nav files for migration-era markers ("UI-0x Phase N", "compatibility wrappers", "extends ... compatibility map").
  - Confirmed `/shopping` and `/receive` are full feature routes â€” plan non-goal: "no removal of existing capabilities" â†’ routes preserved.
  - All cleanup was comment/doc-only; no logic changes required.
- Changes:
  - `components/nav/bottom-nav.tsx`: removed "UI-04" transitional header; promoted nav entry comment to stable description.
  - `src/features/intake/ui/IntakeHubClient.tsx`: removed "compatibility wrappers/layer" and "UI-01/UI-03" phase labels from header and inline comments; routing to `/shopping`+`/receive` is now the stable canonical design.
  - `src/features/intake/shared/intake.contracts.ts`: removed "UI-00 Phase 0" and forward-looking "UI-01 through UI-06" phase reference.
  - `src/features/intake/shared/intake-session.contracts.ts`: removed "UI-02 Phase 2" and design-constraint migration scaffolding; removed "extends UI-01 compatibility map" inline comment.
  - `src/features/intake/shared/intake-capability.service.ts`: removed "UI-03 Phase 3" and "Phase 3 constraints" migration notes from header.
  - `app/(dashboard)/intake/page.tsx`: removed "UI-01" label; promoted to stable doc comment.
  - `docs/unified-inventory-intake-refactor-plan.md`: status â†’ COMPLETE; Latest Update added for UI-05/UI-06; Pick Up Here â†’ PLAN COMPLETE.
  - `docs/master-plan-v1.md`: UI-05/UI-06 â†’ `[x]`; completion â†’ 27/38 = 71.05%; Left Off Here â†’ QA-00.
- No schema migration; no functional behavior changes; no routes removed.
- Validation:
  - `npx tsc --noEmit --incremental false` â†’ PASS
  - `npx eslint components/nav/bottom-nav.tsx src/features/intake/ui/IntakeHubClient.tsx src/features/intake/shared/intake.contracts.ts src/features/intake/shared/intake-session.contracts.ts src/features/intake/shared/intake-capability.service.ts app/(dashboard)/intake/page.tsx` â†’ PASS

### 2026-02-27 - UI-04: navigation consolidation and nav-bar cleanup

- Suggested Commit Title: `feat(ui-04): consolidate shopping and receive navigation into Intake Hub`
- Scope: Phase 4 navigation consolidation for the Unified Inventory Intake Refactor plan.
- Preflight evidence (reuse/refactor-first):
  - `bottom-nav.tsx` was the target for top-level navigation simplification.
  - Phase 4 scope is nav-bar UX updates only; no functional route changes.
- Changes:
  - `components/nav/bottom-nav.tsx`:
    - Removed standalone `/shopping` and `/receive` nav items. They are now accessed exclusively through the `/intake` Hub.
    - Updated URL prefix detection so the `/intake` tab illuminates when the user enters any nested intake routes (`/intake`, `/shopping`, `/receive`).
    - Cleaned up obsolete terms (`shoppingLabel`, `receiveLabel`) and module gates (`moduleId === "receipts|shopping"`) in the render block.
    - Added compatibility header comments to document /shopping and /receive route persistence.
  - `docs/unified-inventory-intake-refactor-plan.md`: UI-04 Latest Update added; Pick Up Here â†’ UI-05
  - `docs/master-plan-v1.md`: UI-04 `[x]`, left-off â†’ UI-05, completion 25/38 = 65.79%
  - `docs/codebase-overview.md`: updated Product Capabilities to reflect full Hub consolidation.
- No schema migration required; no existing standalone page behavior broken.
- Validation:
  - `npx tsc --noEmit --incremental false` â†’ PASS
  - `npx eslint components/nav/bottom-nav.tsx` â†’ PASS

### 2026-02-27 - UI-03: capability gating service + IntakeHubClient refactor

- Suggested Commit Title: `feat(ui-03): add capability gating service and wire to IntakeHubClient`
- Scope: Phase 3 capability-driven UX gating for the Unified Inventory Intake Refactor plan.
- Preflight evidence (reuse/refactor-first):
  - No prior capability-gating logic outside `intake.contracts.ts` â€” clean slate for service
  - `IntakeHubClient.tsx` had hardcoded `INTENT_REQUIRED_MODULE` constant â€” identified for replacement
  - Phase 3 scope: pure functions only, no schema, no DB, no service rewrites
- Changes:
  - `src/features/intake/shared/intake-capability.service.ts` (NEW):
    - `ALWAYS_AVAILABLE_CAPABILITIES`: `Set{manual_entry}` â€” always on
    - `INDUSTRY_CAPABILITIES`: per-industry additive capability rules (5 industries)
    - `MODULE_GATED_CAPABILITIES`: `{supplier_sync: "integrations"}`
    - `resolveIntakeCapabilities(industryType, enabledModules)`: derives full capability set; null=unconstrained
    - `isIntentVisible(intent, capabilities)`: true if â‰¥1 required capability is active
    - `resolveVisibleIntents(industryType, enabledModules)`: industry ordering + visibility in one call
  - `src/features/intake/shared/index.ts`: barrel updated to re-export capability service
  - `src/features/intake/ui/IntakeHubClient.tsx`: removed hardcoded `INTENT_REQUIRED_MODULE`; delegates to `resolveVisibleIntents()`
  - `src/features/intake/shared/intake-capability.service.test.mjs` (NEW): 17 unit tests, 5 suites
  - `docs/unified-inventory-intake-refactor-plan.md`: UI-03 Latest Update; Pick Up Here â†’ UI-04
  - `docs/master-plan-v1.md`: UI-03 `[x]`, left-off â†’ UI-04, completion 24/38 = 63.16%
  - `docs/codebase-overview.md`: capability service added to canonical paths; current status updated
- No schema migration required; no existing service/behavior changes
- Validation:
  - `node --test src/features/intake/shared/intake-capability.service.test.mjs` â†’ PASS 17/17
  - `npx tsc --noEmit --incremental false` â†’ PASS
  - `npx eslint` targeted on `src/features/intake/` â†’ PASS

### 2026-02-27 - UI-02: intake session orchestration adapter layer

- Suggested Commit Title: `feat(ui-02): add intake session orchestration adapter layer`
- Scope: Phase 2 session orchestration unification for the Unified Inventory Intake Refactor plan.
- Preflight evidence (reuse/refactor-first):
  - No existing adapter between ShoppingSessionStatus/ReceiptStatus and IntakeSessionStatus â€” clean slate
  - Confirmed ShoppingSessionStatus values from `prisma/schema.prisma`: `draft|reconciling|ready|committed|cancelled`
  - Confirmed ReceiptStatus values from `prisma/schema.prisma`: `pending|parsing|review|committed|failed`
  - Phase 2 scope: adapter-layer + DTO only; no schema change, no service rewrite
- Changes:
  - `src/features/intake/shared/intake-session.contracts.ts` (NEW):
    - `shoppingStatusToIntakeStatus(shoppingStatus)`: maps 5 Shopping statuses + safe fallback
    - `receiptStatusToIntakeStatus(receiptStatus)`: maps 5 Receipt statuses + safe fallback
    - `IntakeSessionSummary` interface: lightweight read-only unified session projection DTO
    - `buildIntakeSessionRoute(intent, underlyingId)`: intent-aware resume/continue route builder
    - `deriveIntentFromSessionOrigin(origin)`: shopping|receipt|integration â†’ IntakeIntent
  - `src/features/intake/shared/index.ts`: updated barrel to re-export new contracts
  - `src/features/intake/shared/intake-session.contracts.test.mjs` (NEW): 18 unit tests, 4 suites
  - `docs/unified-inventory-intake-refactor-plan.md`: UI-02 Latest Update; Pick Up Here â†’ UI-03
  - `docs/master-plan-v1.md`: UI-02 `[x]`, left-off â†’ UI-03, completion 23/38 = 60.53%
  - `docs/codebase-overview.md`: adapter path added to Intake Hub canonical paths; current status updated
- No schema migration required; no existing service/behavior changes
- Validation:
  - `node --test src/features/intake/shared/intake-session.contracts.test.mjs` â†’ PASS 18/18
  - `npx tsc --noEmit --incremental false` â†’ PASS
  - `npx eslint` targeted on `src/features/intake/shared/` â†’ PASS

### 2026-02-27 - UI-01: Inventory Intake Hub shell â€” intent-first entry at /intake

- Suggested Commit Title: `feat(ui-01): add Inventory Intake Hub shell with intent-first entry cards`
- Scope: Phase 1 Intake Hub shell for the Unified Inventory Intake Refactor plan.
- Preflight evidence (reuse/refactor-first):
  - `src/features/intake/ui/` did not exist â€” new ui/ path required
  - No existing `/intake` route or `IntakeHubClient` in codebase
  - Reused existing card styling pattern from `ReceivePageClient.tsx`
  - Reused `useBusinessConfig()` from `@/shared/config/business-context` for industry/module context
  - Reused Phase 0 contracts (`INTAKE_INTENT_ORDER_BY_INDUSTRY`, `INTAKE_INTENT_LABELS`, `INTAKE_INTENT_DESCRIPTIONS`)
  - No new schema or service logic â€” routing only
- Changes:
  - `src/features/intake/ui/IntakeHubClient.tsx` (NEW):
    - Industry-aware intent card ordering from `INTAKE_INTENT_ORDER_BY_INDUSTRY[industryType]`
    - Module gate for `supplier_sync` card (requires `integrations` module in `enabledModules`)
    - `INTENT_HREF` compatibility map: `live_purchaseâ†’/shopping`, `bulk_intakeâ†’/receive`, `supplier_syncâ†’/integrations`
    - Per-intent icon + color identity (`INTENT_ICON`, `INTENT_COLOR`)
  - `app/(dashboard)/intake/page.tsx` (NEW): thin route wrapper only
  - `components/nav/bottom-nav.tsx`: `/intake` nav entry added; standalone `/receive` entry replaced
    - `/shopping` nav entry preserved for migration compatibility (UI-04 consolidates)
  - `docs/unified-inventory-intake-refactor-plan.md`: UI-01 entry in Latest Update; Pick Up Here â†’ UI-02
  - `docs/master-plan-v1.md`: UI-01 `[x]`, left-off â†’ UI-02, completion 22/38 = 57.89%
  - `docs/codebase-overview.md`: Intake Hub section added to Product Capabilities; current status updated
- All existing routes (/shopping, /receive, /receive/barcode, /receive/receipt, etc.) fully preserved
- No schema migration required; no behavior changes to existing flows
- Validation:
  - `npx tsc --noEmit --incremental false` â†’ PASS
  - `npx eslint` targeted on `src/features/intake/ui/`, `app/(dashboard)/intake/`, `components/nav/bottom-nav.tsx` â†’ PASS

### 2026-02-27 - UI-00: Unified Inventory Intake Phase 0 vocabulary/contracts

- Suggested Commit Title: `chore(ui-00): add intake vocabulary contracts â€” Phase 0 complete`
- Scope: Phase 0 vocabulary and contracts for the Unified Inventory Intake Refactor plan.
- Preflight evidence (reuse/refactor-first):
  - `src/features/intake/` did not exist â€” new feature path created
  - No prior `IntakeIntent`, `IntakeCapability`, or `INTAKE_INTENTS` symbols found anywhere in `src app lib`
  - Phase 0 scope is contracts-only; no DB interaction, no existing flow changes
- Changes:
  - `src/features/intake/shared/intake.contracts.ts` (NEW):
    - `INTAKE_INTENTS` as const tuple + `IntakeIntent` type (`live_purchase`, `bulk_intake`, `supplier_sync`)
    - `INTAKE_SESSION_STATUSES` as const + `IntakeSessionStatus` type (5 states: created â†’ archived)
    - `INTAKE_TERMINAL_STATUSES` readonly set (`committed`, `archived`)
    - `INTAKE_CAPABILITIES` as const + `IntakeCapability` type (7 flags: barcode_capture, photo_assistance, receipt_parse, manual_entry, supplier_sync, produce_entry, invoice_entry)
    - `INTAKE_INTENT_ORDER_BY_INDUSTRY`: per-IndustryType canonical intent ordering record
    - `INTAKE_INTENT_LABELS`, `INTAKE_INTENT_DESCRIPTIONS`: UI display strings map
    - `INTAKE_INTENT_CAPABILITIES`: per-intent capability sets
  - `src/features/intake/shared/index.ts` (NEW): barrel re-export
  - `docs/unified-inventory-intake-refactor-plan.md`: Added `## Latest Update` + `## Pick Up Here` sections
  - `docs/master-plan-v1.md`: UI-00 `[x]`, left-off â†’ UI-01, completion 21/38 = 55.26%
  - `docs/codebase-overview.md`: Added `src/features/intake` to feature folder map, updated current status
- No schema migration required (contracts only)
- All existing flows unmodified; zero behavior changes
- Validation:
  - `npx tsc --noEmit --incremental false` â†’ PASS
  - `npx eslint` targeted on `src/features/intake/shared/` â†’ PASS

### 2026-02-27 - IN-08: INCOME INTEGRATIONS PLAN COMPLETE â€” all phases 0-8 closed

- Suggested Commit Title: `chore(in-08): close income integrations plan â€” all phases complete`
- Scope: Documentation closure for Income Integrations Onboarding Plan (IN-08).
- No code changes in this commit.
- Plan status: all phases verified `[x]`, security checklist 7/7, deferred items tracked.
- Master plan: 20/38 = 52.63%; Left Off Here â†’ UI-00.
- Next: `docs/unified-inventory-intake-refactor-plan.md` Phase 0 (UI-00).

### 2026-02-27 - IN-07 complete: production hardening + security/compliance (token expiry, scope audit, key rotation)

- Suggested Commit Title: `feat(in-07): add token expiry guard, provider scope audit, and key rotation runbook`
- Scope:
  - Income integrations Phase 7 (`IN-07`) production hardening + security/compliance checklist completion.
- Preflight evidence (reuse/refactor-first):
  - `token_expires_at` already on `BusinessIncomeConnection` â€” no new column required
  - `status="expired"` already in `IncomeConnectionStatus` enum â€” no migration required
  - `mapDatabaseStatusToCardStatus` already maps `expiredâ†’error` â€” card UI works without changes
  - "Reconnect" button already shown for error/expired cards â€” no new UI needed for reconnect path
- Changes:
  - `src/features/integrations/server/connections.repository.ts`:
    - Added `markIncomeConnectionExpired`: sets `status="expired"`, `last_error_code="token_expired"`, `last_error_message`
  - `src/features/integrations/server/sync.service.ts`:
    - Added token expiry guard in `runProviderManualSync`: checks `token_expires_at <= now` before lock guard
    - Calls `markIncomeConnectionExpired` and throws descriptive error on expiry
    - Expired connections fall through to `failed` (not `skipped`) in cron runner â€” requires human reconnect
  - `src/features/integrations/shared/oauth.contracts.ts`:
    - Added `INCOME_PROVIDER_OAUTH_SCOPES`: least-privilege read-only scopes per provider (GoDaddy POS, Uber Eats, DoorDash)
    - Added `INCOME_TOKEN_KEY_VERSION = "v1"` with 4-step key rotation runbook in JSDoc
  - `src/features/integrations/server/sync.service.test.mjs`:
    - Added `token_expires_at: null` to `makeConnection` default
    - Added `markConnectionExpired` to `runProviderManualSyncTestable` dependency struct + expiry check
    - Added 3 new token expiry guard tests (expired throws+marks, null proceeds, future proceeds) â†’ 14 total
- Security checklist: all 7 items `[x]` â€” fully complete
- Validation:
  - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS 14/14
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint` targeted on all touched IN-07 files -> PASS

### 2026-02-27 - IN-06 complete: connection health indicators + stale sync warnings

- Suggested Commit Title: `feat(in-06): add connection health indicators, stale sync warnings, and error message surface`
- Scope:
  - Income integrations Phase 6 (`IN-06`) reporting + connection health improvements.
- Preflight evidence (reuse/refactor-first):
  - `lastSyncAt` already in `IncomeProviderConnectionCard` and populated by catalog â€” needed only staleness logic
  - `last_error_message` already on `BusinessIncomeConnection` model â€” no new column required
  - `Badge` component already has `warning` variant â€” reused directly
  - No schema migration required
- Changes:
  - `src/features/integrations/shared/income-connections.contracts.ts`:
    - Added `SYNC_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000` constant
    - Added `syncStale: boolean` field (connected but no sync or >24h ago)
    - Added `lastErrorMessage: string | null` field
  - `src/features/integrations/server/provider-catalog.ts`:
    - Imported `SYNC_STALE_THRESHOLD_MS` from shared
    - Static default cards: `syncStale: false, lastErrorMessage: null`
    - Business cards: computed `syncStale` + populated `lastErrorMessage` from `connection.last_error_message`
  - `src/features/integrations/ui/IncomeProviderConnectCard.tsx`:
    - Added `Sync Stale` warning badge (`Badge variant="warning"`) when `card.syncStale=true`
    - Added "Connected but no sync has run yet" prompt for connected+stale+never-synced case
    - Added error message display when `status="error"` and `lastErrorMessage` is set
  - `src/features/integrations/server/provider-catalog.test.mjs`:
    - Added `syncStale=false` and `lastErrorMessage=null` assertions for unconnected cards
- Validation:
  - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS 6/6
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint` targeted on all touched IN-06 files -> PASS

### 2026-02-27 - IN-05 complete: scheduled sync + webhook hardening (cron runner, sync lock guard, webhook verification)

- Suggested Commit Title: `feat(in-05): add scheduled sync cron runner, sync lock guard, and webhook verification endpoints`
- Scope:
  - Income integrations Phase 5 (`IN-05`) scheduled sync + webhook hardening.
- Preflight evidence (reuse/refactor-first):
  - `INCOME_SYNC_SCHEDULER_STRATEGY = "internal_cron_route"` already defined in `src/features/integrations/shared/index.ts` â€” no new constant required
  - `BusinessIncomeConnection.last_webhook_at` already in schema â€” no new column needed
  - `ExternalSyncLog.status` already supports `"running"` â€” reused as DB soft lock, no migration required
  - Re-verified latest migration: `prisma/migrations/20260228013000_income_event_pilot/migration.sql` â€” no schema change required for IN-05
- Changes:
  - `src/features/integrations/server/sync.service.ts`:
    - Added `SYNC_LOCK_STALE_AFTER_MS = 10 * 60 * 1000` constant
    - Added sync lock guard in `runProviderManualSync` (rejects non-stale concurrent syncs per business+source)
    - Added `CRON_PROVIDER_CONFIGS` array (godaddy_pos, uber_eats, doordash)
    - Added `runAllProvidersCronSync`: iterates all providers+connections, syncs independently, distinguishes `skipped`/`failed`
    - Added `CronSyncResult` interface
  - `app/api/integrations/sync/cron/route.ts` (NEW): `INCOME_CRON_SECRET` Bearer auth â†’ calls `runAllProvidersCronSync`
  - `src/features/integrations/server/webhook-crypto.ts` (NEW): `verifyHmacSha256Signature` (HMAC-SHA256 + `timingSafeEqual`) + `readRawBody`
  - `app/api/integrations/webhooks/uber-eats/route.ts` (NEW): `X-Uber-Signature: sha256=<hex>` verification, `last_webhook_at` update
  - `app/api/integrations/webhooks/doordash/route.ts` (NEW): `X-DoorDash-Signature: <hex>` verification, `last_webhook_at` update
  - `src/features/integrations/server/sync.service.test.mjs`: extended to 11 tests (3 new sync lock guard tests); fixed `input.now` fallback in testable fn
- Validation:
  - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS 11/11
  - `node --test src/features/integrations/providers/uber-eats.provider.test.mjs src/features/integrations/providers/doordash.provider.test.mjs` -> PASS 25/25
  - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS 6/6
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint` targeted on all touched IN-05 files -> PASS

### 2026-02-27 - IN-04 complete: restaurant provider rollout (Uber Eats + DoorDash adapters + generic sync runner)

- Suggested Commit Title: `feat(in-04): add Uber Eats + DoorDash provider adapters and generalize sync runner`
- Scope:
  - Income integrations Phase 4 (`IN-04`) restaurant rollout providers implementation.
- Preflight evidence (reuse/refactor-first):
  - Confirmed `uber_eats` + `doordash` already in `FinancialSource` enum, `IncomeProvider` enum, and home dashboard income breakdown
  - Confirmed legacy `lib/modules/integrations/uber-eats.ts` + `doordash.ts` are empty stubs â€” built fresh in feature providers path
  - Re-verified latest migration: `prisma/migrations/20260228013000_income_event_pilot/migration.sql` (no schema change needed)
- What changed:
  - Added `src/features/integrations/providers/uber-eats.provider.ts`:
    - `UberEatsIncomeEvent` shape + `fetchUberEatsIncomeEvents`
    - Field-priority normalization: id/order_id/workflow_uuid, total_price/gross_earnings, service_fee/uber_fee/commission, payout_amount/net_earnings, currency_code, placed_at/ordered_at date chain
  - Added `src/features/integrations/providers/doordash.provider.ts`:
    - `DoorDashIncomeEvent` shape + `fetchDoorDashIncomeEvents`
    - Field-priority normalization: id/delivery_id/order_id/external_delivery_id, subtotal/order_total, commission_amount/fee/dasher_tip, payout_amount, delivery_status/order_status, store_name description fallback
  - Refactored `sync.service.ts`:
    - Extracted `runProviderManualSync` generic runner (DRY shared logic for all providers)
    - Converted `runGoDaddyPosManualSync` to delegate to generic runner
    - Added `runUberEatsManualSync` + `runDoorDashManualSync`
    - `FinancialSource` type used for `financialSource` param (tsc compliance)
    - `RunGoDaddyPosManualSyncInput/Result` changed from empty interface to type alias
  - Added `app/api/integrations/sync/uber-eats/manual/route.ts`
  - Added `app/api/integrations/sync/doordash/manual/route.ts`
  - Updated `provider-catalog.ts`:
    - `SYNC_ENABLED_PROVIDERS` set (godaddy_pos, uber_eats, doordash)
    - `SYNC_ROUTE_BY_PROVIDER` map
    - `buildSyncHref` helper â€” future providers need only a single entry
  - Added provider normalization unit tests:
    - `uber-eats.provider.test.mjs` (13 tests)
    - `doordash.provider.test.mjs` (12 tests)
- Validation gates:
  - `node --test src/features/integrations/providers/uber-eats.provider.test.mjs src/features/integrations/providers/doordash.provider.test.mjs src/features/integrations/server/sync.service.test.mjs` -> PASS (33/33)
  - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
  - `npx tsc --noEmit --incremental false` -> PASS
  - targeted eslint -> PASS
- Files changed:
  - `src/features/integrations/providers/uber-eats.provider.ts` (new)
  - `src/features/integrations/providers/uber-eats.provider.test.mjs` (new)
  - `src/features/integrations/providers/doordash.provider.ts` (new)
  - `src/features/integrations/providers/doordash.provider.test.mjs` (new)
  - `src/features/integrations/server/sync.service.ts`
  - `src/features/integrations/server/provider-catalog.ts`
  - `app/api/integrations/sync/uber-eats/manual/route.ts` (new)
  - `app/api/integrations/sync/doordash/manual/route.ts` (new)
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`

### 2026-02-27 - IN-03 complete: GoDaddy POS pilot end-to-end sync validation + last_sync_at dashboard visibility

- Suggested Commit Title: `feat(in-03): ship first provider pilot sync tests and last_sync_at card visibility`
- Scope:
  - Income integrations onboarding Phase 3 (`IN-03`) first provider pilot end-to-end validation and dashboard visibility.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed IN-03 source-plan/master-plan scope markers:
    - `docs/income-integrations-onboarding-plan.md`
    - `docs/master-plan-v1.md`
  - Ran scoped scans before implementation:
    - `find src/features/integrations -type f` -> confirmed all existing integration files
    - reviewed `sync.service.ts`, `godaddy-pos.provider.ts`, `connections.repository.ts`, `provider-catalog.ts`
    - reviewed home dashboard server to confirm `FinancialTransaction.source = "godaddy_pos"` already consumed
  - Re-verified schema authority before change (no migration needed):
    - `prisma/schema.prisma`
    - latest migration before slice: `prisma/migrations/20260228013000_income_event_pilot/migration.sql`
- What changed:
  - Added `sync.service.test.mjs` (8 pilot unit tests):
    - missing connection / missing token error paths
    - full sync 90-day historical window gate
    - incremental sync `last_sync_at` date gate
    - IncomeEvent upsert + FinancialTransaction projection shape assertions
    - multiple event isolation correctness
    - provider fetch error -> connection error + failed sync log marking
    - zero events success path
  - Fixed `sync.service.ts` JSON field type assertions (`Prisma.InputJsonValue` casts for `raw_payload` / `normalized_payload`) to satisfy tsc
  - Added `lastSyncAt: string | null` to `IncomeProviderConnectionCard` contract
  - Extended `listIncomeProviderConnectionCardsForBusiness` to populate `lastSyncAt` from `connection.last_sync_at`
  - Updated `IncomeProviderConnectCard` UI to display "Last synced: ..." on connected cards with `lastSyncAt`
  - Updated `IncomeSourceSetupStep` copy to reflect live pilot state (GoDaddy POS live)
  - Extended `provider-catalog.test.mjs` with `lastSyncAt=null` assertion for unconnected cards
- Validation gates:
  - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS (8/8)
  - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
  - `npx tsc --noEmit --incremental false` -> PASS
  - targeted `eslint` on touched integration files -> PASS (no output)
- Files changed:
  - `src/features/integrations/server/sync.service.ts`
  - `src/features/integrations/server/sync.service.test.mjs` (new)
  - `src/features/integrations/server/provider-catalog.ts`
  - `src/features/integrations/server/provider-catalog.test.mjs`
  - `src/features/integrations/shared/income-connections.contracts.ts`
  - `src/features/integrations/ui/IncomeProviderConnectCard.tsx`
  - `src/features/integrations/ui/IncomeSourceSetupStep.tsx`
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`

### 2026-02-27 - IN-02 complete: provider-agnostic OAuth core infrastructure

- Suggested Commit Title: `feat(in-02): implement income OAuth core models, services, and routes`
- Scope:
  - Income integrations onboarding Phase 2 (`IN-02`) provider-agnostic OAuth core implementation.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed IN-02 source-plan/master-plan scope markers:
    - `docs/income-integrations-onboarding-plan.md`
    - `docs/master-plan-v1.md`
  - Ran scoped scans before implementation:
    - `rg -n "## Phase 2|OAuth core infrastructure|BusinessIncomeConnection|IncomeOAuthState|token encryption|callback|PKCE|state" docs/income-integrations-onboarding-plan.md docs/master-plan-v1.md`
    - `rg -n "oauth|pkce|IncomeOAuthState|BusinessIncomeConnection|INCOME_TOKEN_ENCRYPTION_KEY|integrations/oauth|webhooks" src app lib prisma`
  - Re-verified schema authority before DB mutation:
    - `prisma/schema.prisma`
    - latest migration before slice: `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
- What changed:
  - Added Prisma enums/models for OAuth core persistence:
    - `IncomeProvider`
    - `IncomeConnectionStatus`
    - `BusinessIncomeConnection`
    - `IncomeOAuthState`
  - Added migration:
    - `prisma/migrations/20260228010000_income_oauth_core_infrastructure/migration.sql`
  - Added feature server OAuth infrastructure:
    - token crypto (`oauth-crypto.ts`)
    - state repository (`oauth-state.repository.ts`)
    - connection repository (`connections.repository.ts`)
    - provider-agnostic OAuth orchestration service (`oauth.service.ts`)
  - Added provider-agnostic OAuth adapter registry:
    - `src/features/integrations/providers/registry.ts`
    - env-driven provider configuration and generic OAuth2 token exchange flow
  - Added OAuth API routes:
    - `app/api/integrations/oauth/[provider]/start/route.ts`
    - `app/api/integrations/oauth/[provider]/callback/route.ts`
    - owner/manager role enforcement via tenant role guard
  - Updated provider card contracts/service/UI to emit connect links for env-configured providers (`connectHref`, `connectEnabled`).
  - Added targeted tests:
    - `src/features/integrations/server/oauth.service.test.mjs`
    - expanded `src/features/integrations/server/provider-catalog.test.mjs`
  - Updated source/master plan status and continuation pointer to `IN-03`.
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260228010000_income_oauth_core_infrastructure/migration.sql`
  - `src/features/integrations/providers/registry.ts`
  - `src/features/integrations/server/connections.repository.ts`
  - `src/features/integrations/server/oauth-state.repository.ts`
  - `src/features/integrations/server/oauth-crypto.ts`
  - `src/features/integrations/server/oauth.service.ts`
  - `src/features/integrations/server/oauth.service.test.mjs`
  - `src/features/integrations/server/provider-catalog.ts`
  - `src/features/integrations/server/provider-catalog.test.mjs`
  - `src/features/integrations/server/index.ts`
  - `src/features/integrations/shared/income-connections.contracts.ts`
  - `src/features/integrations/ui/IncomeProviderConnectCard.tsx`
  - `app/api/integrations/oauth/[provider]/start/route.ts`
  - `app/api/integrations/oauth/[provider]/callback/route.ts`
  - `app/onboarding/income-sources/page.tsx`
  - `app/(dashboard)/integrations/page.tsx`
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx prisma generate` -> PASS
  - `npx prisma validate` -> PASS
  - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint app/api/integrations/oauth/[provider]/start/route.ts app/api/integrations/oauth/[provider]/callback/route.ts app/(dashboard)/integrations/page.tsx app/onboarding/income-sources/page.tsx src/features/integrations/providers/registry.ts src/features/integrations/server/connections.repository.ts src/features/integrations/server/oauth-state.repository.ts src/features/integrations/server/oauth-crypto.ts src/features/integrations/server/oauth.service.ts src/features/integrations/server/oauth.service.test.mjs src/features/integrations/server/provider-catalog.ts src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/shared/income-connections.contracts.ts src/features/integrations/ui/IncomeProviderConnectCard.tsx prisma/schema.prisma --quiet` -> PASS
- Notes:
  - IN-02 is complete; canonical next task is `IN-03` (first provider pilot end-to-end).

### 2026-02-27 - IN-01 complete: provider catalog + onboarding/integrations UI shell (no OAuth)

- Suggested Commit Title: `feat(in-01): ship income provider catalog and onboarding UI shell`
- Scope:
  - Income integrations onboarding Phase 1 (`IN-01`) provider-catalog + UI shell implementation only.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan Phase 1 scope and continuation markers:
    - `docs/income-integrations-onboarding-plan.md`
    - `docs/master-plan-v1.md`
  - Ran scoped scans for existing onboarding/integration implementation before creating files:
    - `rg -n "## Phase 1|Phase 1 - Provider catalog|onboarding|income-sources|Connect" docs/income-integrations-onboarding-plan.md`
    - `rg -n "onboarding|income sources|integrations page|Connect Your Income Sources|industry_type" app src lib`
    - `rg --files src app test | rg "integrations|onboarding|oauth|income"`
  - Reviewed reusable baseline files:
    - `app/auth/signup/page.tsx`
    - `app/actions/core/auth.ts`
    - `components/nav/bottom-nav.tsx`
    - `lib/modules/integrations/*.ts`
    - `lib/config/presets.ts`
  - Prisma contract reviewed for alignment; no schema/migration change required in IN-01.
- What changed:
  - Added provider catalog service + connection contracts:
    - `src/features/integrations/server/provider-catalog.ts`
    - `src/features/integrations/server/index.ts`
    - `src/features/integrations/shared/income-connections.contracts.ts`
    - expanded `src/features/integrations/shared/provider-catalog.contracts.ts`
  - Added integrations UI shell components:
    - `ConnectionStatusBadge`
    - `IncomeProviderConnectCard`
    - `IncomeSourceSetupStep`
    - `IncomeOnboardingWizardClient`
    - `IncomeConnectionsPageClient`
    - `src/features/integrations/ui/index.ts`
  - Added route wrappers:
    - `app/onboarding/page.tsx`
    - `app/onboarding/income-sources/page.tsx`
    - `app/(dashboard)/integrations/layout.tsx`
    - `app/(dashboard)/integrations/page.tsx`
  - Upgraded signup industry input to card/radio UI and defaulted post-signup continuation to onboarding.
  - Added module-gated integrations nav item in bottom navigation.
  - Added targeted provider catalog tests:
    - `src/features/integrations/server/provider-catalog.test.mjs`
  - Updated source/master plans, overview, and next-task pointer to `IN-02`.
- Files changed:
  - `app/auth/signup/page.tsx`
  - `app/onboarding/page.tsx`
  - `app/onboarding/income-sources/page.tsx`
  - `app/(dashboard)/integrations/layout.tsx`
  - `app/(dashboard)/integrations/page.tsx`
  - `components/nav/bottom-nav.tsx`
  - `src/features/integrations/shared/provider-catalog.contracts.ts`
  - `src/features/integrations/shared/income-connections.contracts.ts`
  - `src/features/integrations/shared/index.ts`
  - `src/features/integrations/server/provider-catalog.ts`
  - `src/features/integrations/server/index.ts`
  - `src/features/integrations/server/provider-catalog.test.mjs`
  - `src/features/integrations/ui/ConnectionStatusBadge.tsx`
  - `src/features/integrations/ui/IncomeProviderConnectCard.tsx`
  - `src/features/integrations/ui/IncomeSourceSetupStep.tsx`
  - `src/features/integrations/ui/IncomeOnboardingWizardClient.tsx`
  - `src/features/integrations/ui/IncomeConnectionsPageClient.tsx`
  - `src/features/integrations/ui/index.ts`
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs` -> PASS (2/2)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint app/auth/signup/page.tsx app/onboarding/page.tsx app/onboarding/income-sources/page.tsx app/(dashboard)/integrations/layout.tsx app/(dashboard)/integrations/page.tsx components/nav/bottom-nav.tsx src/features/integrations/shared/provider-catalog.contracts.ts src/features/integrations/shared/income-connections.contracts.ts src/features/integrations/shared/income-events.contracts.ts src/features/integrations/shared/oauth.contracts.ts src/features/integrations/shared/index.ts src/features/integrations/server/provider-catalog.ts src/features/integrations/server/index.ts src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/ui/ConnectionStatusBadge.tsx src/features/integrations/ui/IncomeProviderConnectCard.tsx src/features/integrations/ui/IncomeSourceSetupStep.tsx src/features/integrations/ui/IncomeOnboardingWizardClient.tsx src/features/integrations/ui/IncomeConnectionsPageClient.tsx src/features/integrations/ui/index.ts --quiet` -> PASS
- Notes:
  - IN-01 is complete; canonical next task is `IN-02` (provider-agnostic OAuth core).

### 2026-02-27 - IN-00 complete: income integrations phase-0 decision lock and contract scaffolding

- Suggested Commit Title: `chore(in-00): finalize income integration phase-0 contracts and decision lock`
- Scope:
  - Income integrations onboarding Phase 0 (`IN-00`) design/schema/security contract finalization only.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan Phase 0 and open-decision blocks:
    - `docs/income-integrations-onboarding-plan.md`
    - `docs/master-plan-v1.md`
  - Ran scoped scans before introducing new files:
    - `rg -n "Phase 0|provider catalog|BusinessIncomeConnection|IncomeOAuthState|IncomeEvent|token encryption|security checklist|Open Decisions" src app test docs`
    - `rg --files src app test | rg "integrations|onboarding|oauth|income"`
  - Reviewed existing integration implementations to avoid duplicate paths:
    - `app/actions/core/financial.ts`
    - `lib/modules/integrations/types.ts`
    - `lib/modules/integrations/{godaddy-pos,uber-eats,doordash}.ts`
    - `lib/config/presets.ts`
  - Verified schema authority inputs before finalizing schema contracts:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
  - No schema mutation/migration was performed in this slice.
- What changed:
  - Finalized Phase 0 decisions in `docs/income-integrations-onboarding-plan.md`:
    - Open Decision 1 resolved to `1a` (GoDaddy POS-first pilot)
    - Open Decision 2 resolved to `2b` (90-day historical sync default)
    - scheduler baseline resolved to internal cron route
    - source-of-truth timeline resolved to canonical `IncomeEvent` with MVP `FinancialTransaction` projection
    - `SkipTheDishes` moved to post-MVP queue
  - Added source-plan continuity markers:
    - new `Latest Update`
    - new `Pick Up Here (Next Continuation)` pointing to `IN-01`
    - Phase 0 status marked `[x]`
  - Added client-safe integrations shared contracts (no runtime OAuth/sync behavior):
    - `src/features/integrations/shared/provider-catalog.contracts.ts`
    - `src/features/integrations/shared/income-events.contracts.ts`
    - `src/features/integrations/shared/oauth.contracts.ts`
    - `src/features/integrations/shared/index.ts`
  - Updated master plan:
    - marked `IN-00` complete in canonical checklist
    - advanced `Last Left Off Here` to `IN-01`
    - recalculated completion snapshot to 12/38 (`31.58%`)
    - appended IN-00 latest job summary
  - Updated overview status snapshot to reflect income plan Phase 0 completion.
- Files changed:
  - `src/features/integrations/shared/provider-catalog.contracts.ts`
  - `src/features/integrations/shared/income-events.contracts.ts`
  - `src/features/integrations/shared/oauth.contracts.ts`
  - `src/features/integrations/shared/index.ts`
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/integrations/shared/provider-catalog.contracts.ts src/features/integrations/shared/income-events.contracts.ts src/features/integrations/shared/oauth.contracts.ts src/features/integrations/shared/index.ts --quiet` -> PASS
- Notes:
  - IN-00 is complete; canonical next task is `IN-01` (provider catalog + onboarding UI shell, no OAuth yet).

### 2026-02-27 - RC-19 complete: receipt correction plan closeout and status synchronization

- Suggested Commit Title: `chore(rc-19): close receipt correction plan with final validation evidence and doc sync`
- Scope:
  - Receipt correction Phase 6 closeout (`RC-19`) documentation/finalization slice.
- Preflight evidence:
  - Reviewed closeout scope markers and checklist requirements in:
    - `docs/receipt-post-ocr-correction-plan.md`
    - `docs/master-plan-v1.md`
  - Verified canonical ordering gate for next sequence:
    - `RC-19` completion required before starting `IN-*`.
- What changed:
  - Marked receipt source plan phases 0/1/1.5 as complete to reflect implemented behavior and aligned Phase 2-6 completion state.
  - Updated receipt source plan `Pick Up Here` to indicate plan completion and next master-plan continuation (`IN-00`).
  - Updated master plan:
    - marked `RC-19` checklist item complete
    - advanced `Last Left Off Here` to `IN-00`
    - updated completion percentages
    - appended RC-19 latest job summary entry
    - added receipt plan to completed ledger and synchronized non-completed review notes
  - Updated overview/changelog references to reflect receipt-plan completion state and remaining non-blocking follow-ups.
- Files changed:
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsx --test src/features/receiving/receipt/server/receipt-correction.service.test.mjs` -> PASS (2/2)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs` -> PASS (3/3)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-correction.service.test.mjs src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs src/features/receiving/receipt/server/receipt-parse-profile.service.ts src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs --quiet` -> PASS
- Notes:
  - Receipt correction implementation plan is now closed; canonical next task is `IN-00`.

### 2026-02-27 - RC-18 complete: rollout hardening with enforce safety guardrails and diagnostics

- Suggested Commit Title: `feat(rc-18): add receipt correction rollout guards and enforce fallback diagnostics`
- Scope:
  - Receipt correction Phase 6 (`RC-18`) hardening/tuning for safe enforce promotion and diagnostics.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-18 scope and pickup marker:
    - `docs/receipt-post-ocr-correction-plan.md` (`Pick Up Here`, `Phase 6 - Hardening and rollout expansion`)
  - Ran scoped scans before implementation:
    - `rg -n "Phase 6 - Hardening and rollout expansion|RC-18|threshold tuning|parser versioning|safe enforce|diagnostics|backfill" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md docs/codebase-overview.md`
    - `rg -n "parser_version|mode|shadow|enforce|threshold|tolerance|diagnostics|metrics|backfill|reparse" src/features/receiving/receipt/server src/domain/parsers`
  - Reused existing correction/workflow/profile orchestration paths (`receipt-correction.service.ts`, `receipt-workflow.service.ts`, `receipt-parse-profile.service.ts`) and applied scoped hardening only.
  - No schema or migration changes required.
- What changed:
  - Added enforce rollout guard evaluator in correction service:
    - evaluate totals-pass requirement, low-confidence threshold, and tax-warn policy before applying enforce writes
    - auto-fallback to `shadow` when guard conditions fail
    - guard behavior tunable through env controls:
      - `RECEIPT_CORRECTION_ENFORCE_REQUIRE_TOTALS_PASS`
      - `RECEIPT_CORRECTION_ENFORCE_ALLOW_TAX_WARN`
      - `RECEIPT_CORRECTION_ENFORCE_MAX_LOW_CONFIDENCE_LINES`
  - Added correction summary diagnostics:
    - `requested_mode`
    - effective `mode`
    - `rollout_guard_status`
    - `rollout_guard_reason_counts`
  - Bumped parser/correction summary version marker to:
    - `v1.5-rollout-guarded-history-aware`
  - Extended correction metrics aggregation/logging in workflow:
    - rollout guard status counts
    - rollout guard reason counts
  - Extended parse-profile signal accumulation to include rollout guard reason counts.
  - Added targeted hardening tests:
    - `receipt-correction.service.test.mjs` covering enforce fallback and enforce-pass behavior.
- Files changed:
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.test.mjs`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs`
  - `src/features/receiving/receipt/server/receipt-parse-profile.service.ts`
  - `src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsx --test src/features/receiving/receipt/server/receipt-correction.service.test.mjs` -> PASS (2/2)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs` -> PASS (3/3)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-correction.service.test.mjs src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs src/features/receiving/receipt/server/receipt-parse-profile.service.ts src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs --quiet` -> PASS
- Notes:
  - RC-18 marked complete; canonical next task is `RC-19` closeout.

### 2026-02-27 - RC-17 complete: historical feedback loop with outcome-aware priors and fuzzy fallback

- Suggested Commit Title: `feat(rc-17): prioritize confirmed history priors with fuzzy fallback and price-proximity gating`
- Scope:
  - Receipt correction Phase 5 (`RC-17`) historical feedback-loop integration for correction-scoring priors.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-17 scope + pickup marker:
    - `docs/receipt-post-ocr-correction-plan.md` (`Pick Up Here`, `Phase 5 - Historical matching feedback loop`)
  - Ran scoped scans before implementation:
    - `rg -n "Phase 5 - Historical matching feedback loop|RC-17|store + SKU memory|price proximity|learning from user edits" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md`
    - `rg -n "historical|historical_price_hints|feedback|confirmed|matched_item_id|price proximity|fuzzy" src/features/receiving/receipt src/domain/parsers`
    - `rg --files src/features/receiving/receipt src/domain/parsers | rg "receipt"`
  - Reused existing historical-hint path in `receipt-workflow.service.ts` and repository query path in `receipt.repository.ts`; no new schema/migrations required.
- What changed:
  - Extended historical sample query payload:
    - `findRecentReceiptLinePriceSamples(...)` now returns `status` and `matched_item_id` with price samples.
  - Upgraded historical hint builder in workflow:
    - confirmed/matched + linked-item samples are prioritized as high-confidence feedback priors
    - unresolved/suggested-only history is deprioritized when feedback priors exist
    - fuzzy-name fallback is used when exact normalized parsed-name keys are missing
    - price-proximity gate suppresses weak far-distance priors from steering correction scoring
  - Kept correction core pure:
    - prior computation remains in feature layer and is injected via existing `historical_price_hints` contracts.
  - Added targeted RC-17 regression tests:
    - `receipt-workflow.historical-hints.test.mjs` validates feedback-prior preference, fuzzy fallback, and proximity safety gating.
- Files changed:
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsx --test src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs` -> PASS (3/3)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-workflow.historical-hints.test.mjs --quiet` -> PASS
- Notes:
  - RC-17 marked complete; canonical next task is `RC-18`.

### 2026-02-27 - RC-16 complete: hybrid raw-text parser upgrades + profile-prior parser hints

- Suggested Commit Title: `feat(rc-16): ship hybrid receipt parser with section detection and profile-guided hints`
- Scope:
  - Receipt correction Phase 4 (`RC-16`) structured parser upgrade for raw-text ingestion and safe store-prior parser interpretation.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-16 scope and pickup marker:
    - `docs/receipt-post-ocr-correction-plan.md` (`Pick Up Here`, `Phase 4 - Structured parsing upgrade`)
  - Ran scoped scans before implementation:
    - `rg -n "Phase 4 - Structured parsing upgrade|RC-16|section detection|multi-line item|numeric cluster|tax-line extraction" docs/receipt-post-ocr-correction-plan.md`
    - `rg -n "section|summary|footer|tax line|multi-line|numeric cluster|parseReceiptText|HST|GST|QST|TPS|TVQ" src/domain/parsers src/features/receiving/receipt test/fixtures/receipt-correction`
    - `rg --files src/domain/parsers src/features/receiving/receipt | rg "receipt"`
  - Reused existing parser/workflow/profile files:
    - `src/domain/parsers/receipt.ts`
    - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
    - `src/features/receiving/receipt/server/receipt-parse-profile.service.ts`
  - No schema/migration changes required for RC-16.
- What changed:
  - Upgraded `parseReceiptText(...)` into a hybrid pass:
    - line section detection (item vs summary/tax/footer/meta/promo/payment)
    - stronger tax-line label detection (`HST`/`GST`/`QST`/`TPS`/`TVQ` and generic `Tax xx%`)
    - numeric cluster parsing for `qty x unit_price line_total`
    - safer terminal amount parsing that avoids over-capturing numeric clusters
    - two-line merge support for wrapped item descriptions with conservative guards
    - optional parser options (`provinceHint`, `skuPositionHint`) for safe store-prior interpretation
  - Added PLU-safe SKU stripping behavior:
    - default parser flow avoids stripping 4/5-digit produce PLUs
    - profile-guided hints can still strip prefix/suffix SKU tokens when dominant store patterns exist
  - Extended store-profile prior derivation:
    - added `skuPositionHint` dominance derivation in `receipt-parse-profile.service.ts`
  - Wired raw-text receipt workflow to pass profile/supplier parser hints into `parseReceiptText(...)`.
  - Expanded parser/profile tests and updated two Walmart parsed-text fixtures where header-noise lines are now skipped by section classification.
- Files changed:
  - `src/domain/parsers/receipt.ts`
  - `src/domain/parsers/receipt.test.mjs`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/receipt-parse-profile.service.ts`
  - `src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs`
  - `test/fixtures/receipt-correction/walmart-parsed-text-discount-heavy-tax13-split-token-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-split-numeric-token-001.json`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (7/7; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (5/5)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt.ts src/domain/parsers/receipt.test.mjs src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt-parse-profile.service.ts src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs --quiet` -> PASS
- Notes:
  - RC-16 marked complete; canonical next task is `RC-17`.

### 2026-02-27 - RC-15 complete: add dedicated store parse-profile memory and workflow learning hooks

- Suggested Commit Title: `feat(rc-15): add receipt parse profile memory table and profile-prior orchestration`
- Scope:
  - Receipt correction Phase 3 (`RC-15`) store-specific parse profile persistence and learning loop wiring.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-15 scope + open decisions:
    - `docs/receipt-post-ocr-correction-plan.md` (`Phase 3`, `Open Decisions` items 2 and 7)
  - Ran scoped scans before implementation:
    - `rg -n "Phase 3 - Store-specific pattern memory|ReceiptParseProfile|Open Decisions|dedicated table|Supplier JSON" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md prisma/schema.prisma`
    - `rg -n "ReceiptParseProfile|parse profile|profile_key|store profile|signals|stats" src app test prisma`
  - Reviewed canonical DB sources:
    - `prisma/schema.prisma`
    - latest migration before this slice: `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`
  - Reused existing receipt workflow/repository/line-review paths and added only missing RC-15 profile-memory components.
- What changed:
  - Resolved RC-15 decisions explicitly:
    - Open Decision 2 -> Option A (dedicated `ReceiptParseProfile` table)
    - Open Decision 7 -> Option B (persist interpreted province/tax signals in both receipt summary and profile memory)
  - Added Prisma model and migration:
    - `ReceiptParseProfile` with unique (`business_id`, `profile_key`), supplier/place indexes, JSON `signals`/`stats`, and `last_seen_at`
    - migration `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
  - Added `receipt-parse-profile.service.ts`:
    - deterministic profile keying (`place:<google_place_id>` fallback `supplier:<supplier_id>`)
    - correction-summary signal/stat accumulation
    - province prior derivation with minimum-sample and dominance gates
    - line-review feedback counters for `confirmed`/`skipped`
  - Wired profile prior read + safe profile persistence into both receipt workflows:
    - `parseAndMatchReceipt(...)`
    - `processReceiptImage(...)`
  - Wired line-item review feedback updates in `updateLineItemMatch(...)`.
  - Added targeted service tests for keying/prior/accumulation/review-feedback behavior.
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
  - `src/features/receiving/receipt/server/receipt-parse-profile.service.ts`
  - `src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/line-item.service.ts`
  - `src/features/receiving/receipt/server/index.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx prisma generate` -> PASS
  - `npx prisma validate` -> PASS
  - `npx tsx --test src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs` -> PASS (4/4)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/line-item.service.ts src/features/receiving/receipt/server/receipt-parse-profile.service.ts src/features/receiving/receipt/server/receipt-parse-profile.service.test.mjs src/features/receiving/receipt/server/index.ts prisma/schema.prisma --quiet` -> PASS
- Notes:
  - RC-15 is unblocked/completed; canonical next task is `RC-16`.

### 2026-02-27 - RC-15 blocked: unresolved store-profile persistence contract (table vs supplier JSON)

- Suggested Commit Title: `chore(rc-15): mark store-profile persistence decision blocker and halt autonomous advance`
- Scope:
  - RC-15 preflight/blocker documentation update only (no runtime code changes).
- Preflight evidence:
  - Reviewed RC-15 source-plan scope and open decisions:
    - `docs/receipt-post-ocr-correction-plan.md` (`Phase 3`, `Open Decisions` items 2 and 7)
  - Ran targeted scans for existing profile-memory implementation:
    - `rg -n "Phase 3 - Store-specific pattern memory|ReceiptParseProfile|Open Decisions|dedicated table|Supplier JSON" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md prisma/schema.prisma`
    - `rg -n "ReceiptParseProfile|parse profile|profile_key|store profile|signals|stats" src app test prisma`
  - Re-verified DB contract references:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`
- What changed:
  - Marked `RC-15` as `[!]` blocked in `docs/master-plan-v1.md`.
  - Updated `Last Left Off Here` to blocked state with explicit unblock requirements.
  - Added blocker entry to master plan `## Latest Job Summary`.
  - Updated receipt source plan `Latest Update`, `Pick Up Here`, and `Phase 3` status to reflect blocker and halt condition.
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation-only blocker update (no code validation commands run)
- Notes:
  - Autonomous execution halted per contract; no later checklist items were started.

### 2026-02-27 - RC-14 complete: persist parse-confidence metadata + add separate parse-confidence review indicators

- Suggested Commit Title: `feat(rc-14): persist receipt parse-confidence metadata and show parse indicators in review UI`
- Scope:
  - Receipt correction Phase 2 (`RC-14`) for line-level parse metadata persistence and receipt review UI parse-confidence indicators.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-14 scope and pickup marker:
    - `docs/receipt-post-ocr-correction-plan.md` (`Pick Up Here`, `Phase 2 - Line-level parse confidence and UI flags`)
  - Ran scoped scans before implementation:
    - `rg -n "parse_confidence|parse_flags|parse_corrections|ReceiptLineItem|receipt review|ReceiptReceivePageClient|ReceiptLineItemRow" src app test docs prisma`
    - `rg --files src app test | rg "receipt|receiving|review|correction|workflow|repository|contracts"`
  - Reviewed canonical DB sources:
    - `prisma/schema.prisma`
    - latest migration before this slice: `prisma/migrations/20260227190000_receipt_line_item_produce_metadata/migration.sql`
  - Reused existing write/read flow (`receipt-workflow.service.ts` + `receipt.repository.ts`) and existing receipt review components; no duplicate pipeline/files created.
- What changed:
  - Added schema-backed parse metadata fields on `ReceiptLineItem`:
    - `parse_confidence_score Decimal(4,3)?`
    - `parse_confidence_band MatchConfidence?`
    - `parse_flags Json?`
    - `parse_corrections Json?`
  - Added migration:
    - `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`
  - Persisted line-level parse metadata from correction-core output for both receipt workflows:
    - `parseAndMatchReceipt(...)` (parsed-text path)
    - `processReceiptImage(...)` (TabScanner path)
  - Kept match and parse confidence semantics separate:
    - `ReceiptLineItem.confidence` remains inventory-match confidence
    - parse confidence stored in new parse fields only
  - Updated receipt review UI:
    - per-line parse-confidence badge added alongside existing match-confidence badge
    - low/medium parse-confidence lines now show inline parse flags
    - summary badges now show parse-confidence high/med/low counts
  - Updated plan/overview/master docs to mark RC-14 complete and move canonical pointer to RC-15.
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260227203000_receipt_line_item_parse_metadata/migration.sql`
  - `src/features/receiving/receipt/server/contracts.ts`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/shared/contracts.ts`
  - `src/features/receiving/receipt/ui/ReceiptLineItemRow.tsx`
  - `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx prisma generate` -> PASS
  - `npx prisma validate` -> PASS
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3; expected Node experimental/module-type warnings)
  - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/contracts.ts src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/ui/ReceiptLineItemRow.tsx src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx src/features/receiving/shared/contracts.ts --quiet` -> PASS
- Notes:
  - RC-14 completion keeps schema/contracts aligned with the non-overload rule: parse confidence is now persisted separately from match confidence.

### 2026-02-27 - RC-13 complete: schema-backed minimal produce metadata persistence (`ReceiptLineItem`)

- Suggested Commit Title: `feat(rc-13): persist receipt line produce metadata with minimal nullable columns`
- Scope:
  - Receipt correction Phase 1.5 persistence slice (`RC-13`) using schema-backed minimal storage.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-13 section and prior blocker notes.
  - Ran scoped scans before implementation:
    - `rg -n "ReceiptLineItem|plu_code|organic_flag|produce_match|createLineItem|parsed_data" prisma/schema.prisma src/features/receiving/receipt/server docs`
  - Reviewed canonical DB sources:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
  - Reused existing line-item write path in `receipt.repository.ts`; no new tables/services were introduced for persistence.
- What changed:
  - Added minimal nullable `ReceiptLineItem` fields in Prisma schema:
    - `plu_code Int?`
    - `organic_flag Boolean?`
  - Added migration:
    - `prisma/migrations/20260227190000_receipt_line_item_produce_metadata/migration.sql`
  - Updated `createLineItem(...)` to persist `plu_code` and `organic_flag` from corrected lines.
  - Regenerated Prisma client (`npx prisma generate`).
  - Updated source/master plans to mark RC-13 complete and advance canonical pointer to RC-14.
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260227190000_receipt_line_item_produce_metadata/migration.sql`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx prisma generate` -> PASS
  - `npx prisma validate` -> PASS
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt.repository.ts prisma/schema.prisma --quiet` -> PASS
- Notes:
  - RC-13 is complete with minimal nullable schema-backed persistence only (no over-modeling, no new parse-confidence columns yet).

### 2026-02-27 - RC-13 blocked: parse/produce persistence path requires explicit approval

- Suggested Commit Title: `chore(rc-13): mark persistence decision blocker and halt autonomous advance`
- Scope:
  - RC-13 preflight/blocker documentation update only (no runtime code changes).
- Preflight evidence:
  - Reviewed RC-13 source-plan scope and open-decision section in `docs/receipt-post-ocr-correction-plan.md`.
  - Ran targeted scans for existing persistence-path implementation and storage contracts:
    - `rg -n "RC-13|persistence decision|schema-light|schema-backed|Open Decisions|ReceiptLineItem|plu_code|organic_flag|produce_match|parsed_data" docs/receipt-post-ocr-correction-plan.md docs/master-plan-v1.md`
    - `rg -n "plu_code|organic_flag|produce_match|parse_confidence|parsed_data|raw_data" src/features/receiving/receipt/server src/domain/parsers prisma/schema.prisma`
  - Re-verified DB contract references:
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
- What changed:
  - Marked `RC-13` as `[!]` blocked in `docs/master-plan-v1.md`.
  - Updated `Last Left Off Here` status to blocked with explicit unblock requirement.
  - Added blocker job-summary entry with exact decision needed (schema-light vs schema-backed).
  - Updated receipt source plan `Latest Update` and `Pick Up Here` to reflect the stop condition and required approval.
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation-only blocker update (no code validation commands run)
- Notes:
  - Autonomous execution halted per contract; no later checklist items were started.

### 2026-02-27 - RC-12 complete: produce lookup service wired (PLU/fuzzy + province language preference + EN fallback)

- Suggested Commit Title: `feat(rc-12): add produce lookup service with province-aware language fallback`
- Scope:
  - Receipt correction Phase 1.5 service-layer completion (`RC-12`) for produce-item lookup enrichment after correction-core processing.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan RC-12 scope in `docs/receipt-post-ocr-correction-plan.md`.
  - Ran scoped implementation scans:
    - `rg -n "receipt-produce-lookup|produce_items|plu_code|produce_match|organic_flag|language fallback|province.*language" src app test docs`
    - `rg --files src app test docs | rg "produce|receipt-correction|receipt-workflow|receipt.*lookup|plu"`
  - Confirmed no existing `receipt-produce-lookup.service.ts` implementation and extended existing correction-service integration path instead of introducing parallel pipelines.
  - DB/Prisma integrity preflight completed:
    - reviewed `prisma/schema.prisma` (`ProduceItem` model + composite key)
    - reviewed latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
    - no schema/migration changes required for this read-only lookup slice.
- What changed:
  - Added `src/features/receiving/receipt/server/receipt-produce-lookup.service.ts`:
    - PLU-first produce lookup (`plu_code + language_code`)
    - fuzzy-name fallback using trigram similarity scoring and produce-keyword gating
    - province-aware language order (`QC: FR -> EN`, default `EN`) with explicit EN fallback flagging
  - Wired lookup enrichment into `runReceiptPostOcrCorrection(...)`:
    - applies produce lookup after correction-core output
    - enriches lines with canonical `produce_match`
    - appends lookup parse flags/actions for observability
    - recomputes correction stats after lookup enrichment
  - Added targeted service tests:
    - `src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs`
    - verifies preferred-language behavior, EN fallback, fuzzy match path, and non-produce skip guard.
- Files changed:
  - `src/features/receiving/receipt/server/receipt-produce-lookup.service.ts`
  - `src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsx --test src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs` -> PASS (3/3)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-produce-lookup.service.ts src/features/receiving/receipt/server/receipt-produce-lookup.service.test.mjs --quiet` -> PASS
- Notes:
  - `RC-12` marked complete; canonical next task is `RC-13`.

### 2026-02-27 - RC-11 complete: province hierarchy hardening + ON/QC tax assertion expansion + raw-text totals robustness

- Suggested Commit Title: `feat(rc-11): harden province resolution hierarchy, tax assertions, and raw-text totals extraction`
- Scope:
  - Receipt correction Phase 1 tax-hardening slice (`RC-11`) across workflow province resolution, tax-interpretation fixtures/assertions, and parsed-text totals extraction robustness.
- Preflight evidence (reuse/refactor-first + DB/Prisma integrity):
  - Reviewed source-plan scope in `docs/receipt-post-ocr-correction-plan.md` (`Pick Up Here` + Phase 1 progress notes).
  - Ran scoped reuse/refactor scans:
    - `rg -n "tax_interpretation|province|HST|TPS|TVQ|QST|Tax 13|subtotal|total due|grand total|google_place|place details" src app test docs`
    - `rg --files src app test docs | rg "receipt|correction|tax|province|workflow|fixture"`
  - Reviewed and extended existing implementation in:
    - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
    - `src/domain/parsers/receipt.ts`
    - `src/domain/parsers/receipt-correction-core.test.mjs`
    - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
    - `src/domain/parsers/receipt.test.mjs`
  - DB/Prisma integrity preflight completed before DB-touching workflow changes:
    - reviewed `prisma/schema.prisma`
    - reviewed latest migration `prisma/migrations/20260225223000_shopping_session_item_resolution_audit/migration.sql`
    - no schema or migration changes required for RC-11.
- What changed:
  - Province hierarchy hardening:
    - added Google Place Details province resolution using `google_place_id` (`address_components`/`formatted_address`)
    - retained supplier-address fallback when place-details resolution is unavailable
    - added process-local cache for repeated place-id province lookups
  - Raw-text totals robustness hardening:
    - expanded label handling to support `Sub-Total`/`Sous-total`, `Total Due`, `Montant total`, and `Taxe`
    - added resilient trailing amount normalization for split tokens (`9 98`) and comma-decimal formats (`12,00`)
  - Tax-assertion coverage expansion:
    - added ON/QC fixture assertions for province-hint conflict behavior and incomplete/mismatch tax structures
    - added French-label/comma-decimal parsed-text fixture pass case
    - extended fixture harness totals-context injection for deterministic province-hint assertion scenarios
- Files changed:
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/domain/parsers/receipt.ts`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/domain/parsers/receipt.test.mjs`
  - `test/fixtures/receipt-correction/ontario-parsed-text-google-hint-overrides-qc-labels-001.json`
  - `test/fixtures/receipt-correction/ontario-parsed-text-gst-only-warn-001.json`
  - `test/fixtures/receipt-correction/ontario-parsed-text-subtotal-hyphen-total-due-split-tax-001.json`
  - `test/fixtures/receipt-correction/quebec-parsed-text-french-label-comma-decimal-pass-001.json`
  - `test/fixtures/receipt-correction/quebec-parsed-text-hst-only-warn-001.json`
  - `test/fixtures/receipt-correction/quebec-parsed-text-tps-only-incomplete-warn-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-discount-heavy-tax13-split-token-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (14/14; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (27/27; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (3/3; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt.ts src/domain/parsers/receipt.test.mjs src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/receipt-workflow.service.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - `RC-11` marked complete in master plan; canonical next task is `RC-12`.

### 2026-02-27 - RC-10 closeout: workflow-aligned historical scoring threshold tuning + fixture corpus completion to 20 scenarios

- Suggested Commit Title: `chore: RC-10 closeout: align historical scoring threshold with workflow gate and expand fixtures to 20`
- Scope:
  - Receipt correction Phase 1 (`RC-10`) closeout for threshold tuning and fixture-corpus completion.
- Preflight evidence (reuse/refactor-first):
  - Reviewed existing scoped implementation in:
    - `docs/receipt-post-ocr-correction-plan.md` (`RC-10` remaining items and Phase 1 status)
    - `src/domain/parsers/receipt-correction-core.ts` (candidate scoring + historical plausibility path)
    - `src/domain/parsers/receipt-correction-core.test.mjs` (existing history-guided and low-sample tests)
    - `src/domain/parsers/receipt-correction-fixtures.test.mjs` + `test/fixtures/receipt-correction/README.md` (fixture harness/assertion capabilities and current corpus size)
  - Reused existing correction core + fixture harness; no duplicate pipeline/services were introduced.
  - Added new fixture files only for uncovered scenarios required to close RC-10 (history sample-size boundary + discount-heavy generic-tax parsed-text case).
- What changed:
  - Tuned correction-core historical plausibility scoring gate:
    - history-based score adjustment now requires `sample_size >= 4` in `historicalPlausibilityAdjustment(...)`, matching workflow hint-generation confidence expectations.
  - Added threshold-boundary core tests:
    - `sample_size: 3` no-steer behavior remains baseline (`149`)
    - `sample_size: 4` can steer decimal inference (`14.9`)
  - Expanded fixture corpus from 18 to 20 scenarios:
    - `bakery-tabscanner-history-sample3-noop-001.json`
    - `walmart-parsed-text-discount-heavy-tax13-split-token-001.json`
  - Updated fixture documentation status to 20 scenarios and documented sample-size boundary guidance.
  - Updated receipt plan/master plan/overview docs to mark RC-10 closeout and move canonical pickup to RC-11.
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `test/fixtures/receipt-correction/bakery-tabscanner-history-sample3-noop-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-discount-heavy-tax13-split-token-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (12/12; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (21/21; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (2/2; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - `RC-10` is now complete in the master checklist; canonical next task is `RC-11`.

### 2026-02-27 - Master plan autonomous execution contract hardened for low-supervision continuation

- Suggested Commit Title: `chore(docs): harden master plan with autonomous execution contract and anti-drift gates`
- Scope:
  - Documentation governance hardening to reduce manual supervision and enforce sequential task execution.
- What changed:
  - Added `Autonomous Execution Contract` to `docs/master-plan-v1.md` with:
    - deterministic active-task selection (`[~]` first, else first eligible `[ ]`)
    - auto-advance behavior after successful completion
    - strict no-skip and single-in-progress constraints
  - Added explicit stop conditions and blocked-task protocol (`[!]`) so agents halt safely instead of drifting scope.
  - Added `Scoped Preflight Gate` requiring reuse/refactor-first codebase scans before creating new files/code.
  - Added `Validation Gate` and dependency order gates (`RC -> IN -> UI -> QA -> OC`).
  - Added session checklist invariant: verify autonomous contract rules each slice.
  - Added a new master-plan latest-job-summary entry documenting this governance slice.
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - This is a process hardening slice; master-plan checklist completion percentages are unchanged by this update.

### 2026-02-27 - Changelog commit-title policy enforced across all entries and master-plan completion metrics section added

- Suggested Commit Title: `chore(docs): enforce changelog commit-title line and add master-plan completion metrics section`
- Scope:
  - Documentation process/governance update for consistent handoff metadata
- What changed:
  - Added `Suggested Commit Title` lines to all existing changelog entries so each slice includes a ready-to-use commit title.
  - Added explicit changelog usage rule requiring `Suggested Commit Title` in every future entry.
  - Added `Completion Percentage` section to `docs/master-plan-v1.md` with:
    - strict completion formula
    - weighted progress formula
    - current snapshot values
    - required per-slice update workflow
  - Added completion-percentage update step to master-plan documentation checklist.
- Files changed:
  - `docs/codebase-changelog.md`
  - `docs/master-plan-v1.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Going forward, post-slice responses should include both the suggested commit title and current strict/weighted master-plan completion percentages.

### 2026-02-27 - RC-10 continuation: raw-text parser noise hardening + tax-assertion fixture expansion to 18 scenarios

- Suggested Commit Title: `chore: RC-10 continuation: raw-text parser noise hardening + tax-assertion fixture expansion to 18 scenarios`
- Scope:
  - Receipt correction Phase 1 (RC-10) continuation focused on raw-text pre-correction quality and fixture-driven tax validation coverage
- What changed:
  - Hardened raw-text parser skip/noise patterns in `parseReceiptText(...)`:
    - handles `Sub Total` / `Subtotal` / `Grand Total` variants
    - handles dotted tax labels (`H.S.T.`) and Quebec tax labels (`TPS`, `TVQ`)
    - skips coupon/discount header-style summary lines
  - Added targeted parser tests:
    - `src/domain/parsers/receipt.test.mjs` covering dotted HST and TPS/TVQ skip behavior
  - Expanded fixture harness assertions:
    - `expected.assertions.tax_interpretation` is now machine-checkable (`status`, `province`, `province_source`, `structure`, `zero_tax_grocery_candidate`, `required_flags`)
  - Added 3 new parsed-text fixtures:
    - `ontario-parsed-text-hst-dotted-pass-001.json`
    - `quebec-parsed-text-tps-tvq-pass-001.json`
    - `grocery-parsed-text-zero-tax-subtotal-total-001.json`
  - Fixture corpus is now 18 scenarios (RC-10 target progression toward 20).
- Files changed:
  - `src/domain/parsers/receipt.ts`
  - `src/domain/parsers/receipt.test.mjs`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `test/fixtures/receipt-correction/ontario-parsed-text-hst-dotted-pass-001.json`
  - `test/fixtures/receipt-correction/quebec-parsed-text-tps-tvq-pass-001.json`
  - `test/fixtures/receipt-correction/grocery-parsed-text-zero-tax-subtotal-total-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt.test.mjs` -> PASS (2/2; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (19/19; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt.ts src/domain/parsers/receipt.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - RC-10 remains in progress; next closeout slice should add final 2 fixtures and complete threshold tuning review against shadow metrics.

### 2026-02-27 - RC-10 continuation: historical hint quality gates, observability expansion, and fixture corpus growth

- Suggested Commit Title: `chore: RC-10 continuation: historical hint quality gates, observability expansion, and fixture corpus growth`
- Scope:
  - Receipt correction Phase 1 (RC-10) threshold-hardening continuation after initial historical plausibility wiring
- What changed:
  - Hardened feature-layer historical hint derivation:
    - added minimum sample-size gate for generated hints (`>= 4`)
    - added recency lookback filter for sampled receipt lines (default `120` days)
  - Expanded correction observability payloads/metrics:
    - historical hint line counts
    - historical hint sample-size totals/max
    - hinted lines applied counts
  - Bumped parser version label to `v1.4-numeric-tax-produce-history-gated`
  - Fixture and harness expansion:
    - added `market-parsed-text-hst-dotted-label-missing-decimal-001.json`
    - added `grocery-parsed-text-split-token-with-subtotal-tax-001.json`
    - added `bakery-tabscanner-history-low-sample-noop-001.json`
    - updated fixture harness tax-label extraction to include dotted/variant labels (`H.S.T.`, `TPS`, `TVQ`)
  - Updated RC-10 documentation status/remaining tasks in master + receipt plan docs.
- Files changed:
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `test/fixtures/receipt-correction/market-parsed-text-hst-dotted-label-missing-decimal-001.json`
  - `test/fixtures/receipt-correction/grocery-parsed-text-split-token-with-subtotal-tax-001.json`
  - `test/fixtures/receipt-correction/bakery-tabscanner-history-low-sample-noop-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (16/16; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - RC-10 remains in progress; fixture corpus now at 15 scenarios, with 18-20 target still pending before closeout.

### 2026-02-27 - RC-10 kickoff: historical price plausibility wiring for receipt correction + fixture/test expansion

- Suggested Commit Title: `chore: RC-10 kickoff: historical price plausibility wiring for receipt correction + fixture/test expansion`
- Scope:
  - Receipt post-OCR correction Phase 1 (RC-10) continuation focused on feature-layer historical plausibility signals and threshold-tuning scaffolding
- What changed:
  - Extended correction-core input/contracts:
    - added `historical_price_hints` support in `runReceiptCorrectionCore(...)`
    - added history-aware plausibility adjustments in baseline/candidate scoring
    - added guarded aggressive-candidate acceptance path only when historical support is strong
    - added parse flag `historical_price_signal_available` for observability
  - Added feature-layer historical hint orchestration (no DB access in domain core):
    - new receipt repository query to fetch recent receipt line price samples by parsed name, scoped to business and optionally supplier/place
    - workflow service now derives per-line median price hints and passes them into correction for both parsed-text and TabScanner paths
  - Expanded regression coverage:
    - added correction-core tests for history-guided candidate selection and low-sample no-op behavior
    - fixture harness now supports optional `historical_price_hints`
    - added fixture `test/fixtures/receipt-correction/bakery-tabscanner-history-guided-decimal-001.json`
  - Updated parser version string:
    - `v1.3-numeric-tax-produce-history-tuned`
  - Synced documentation:
    - receipt correction plan `Latest Update` + Phase 1 progress notes updated
    - master plan RC-10 marked in progress with latest job summary
    - overview workflow/capability sections updated for historical hint stage
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `test/fixtures/receipt-correction/bakery-tabscanner-history-guided-decimal-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (10/10; expected Node experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (13/13; expected Node experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/receipt.repository.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - RC-10 remains in progress; this slice implemented historical signal wiring and first fixture expansion, with threshold tuning and broader fixture growth still pending.

### 2026-02-27 - Master plan checklist hardened with mandatory per-step scoped implementation pre-checks

- Suggested Commit Title: `chore: Master plan checklist hardened with mandatory per-step scoped implementation pre-checks`
- Scope:
  - Documentation/process hardening to reduce duplicate code creation risk during ongoing plan execution
- What changed:
  - Updated `docs/master-plan-v1.md` so every canonical checklist item now begins with an explicit pre-check requirement:
    - review currently implemented scoped files/logic first
    - prefer build-on/refactor/remove/move of existing scope-related code before creating new code/files
  - Added a matching session summary entry in the master plan log to make the rule visible in future handoffs
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - No runtime behavior, schema, or architecture implementation changed in this slice.

### 2026-02-27 - Created Master Plan v1 for canonical continuation order across remaining plans

- Suggested Commit Title: `chore: Created Master Plan v1 for canonical continuation order across remaining plans`
- Scope:
  - Documentation coordination and execution-order consolidation across all current plan docs
- What changed:
  - Added new master tracker document:
    - `docs/master-plan-v1.md`
  - Master plan contents now include:
    - full markdown-doc inventory review snapshot
    - completed-plan ledger
    - non-completed plan review, including explicit latest-update review for open plans
    - single canonical checklist order for remaining initiatives
    - `Last Left Off Here` checkpoint block for future handoffs
    - per-session documentation sync checklist and summary template
  - Synced architecture reference:
    - added `docs/master-plan-v1.md` to related planning docs in `docs/codebase-overview.md`
    - updated overview current-status snapshot to reflect open plans (receipt correction in progress, income integrations not started)
- Files changed:
  - `docs/master-plan-v1.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - No runtime behavior or schema changes were made in this slice.

### 2026-02-27 - Added sequencing-locked Operational Calendar (Schedule tab) plan

- Suggested Commit Title: `chore: Added sequencing-locked Operational Calendar (Schedule tab) plan`
- Scope:
  - Product/system-design planning for a cross-industry Schedule tab as an Operational Calendar, with explicit start-order gating after all current active plans
- What changed:
  - Added new dedicated plan:
    - `docs/operational-calendar-schedule-plan.md`
  - Reviewed and strengthened the proposed schedule concept into an implementation-ready planning structure:
    - clarified that Schedule is an operational calendar (not single-vertical booking UI)
    - defined cross-industry event model and event types
    - defined integration/sync/dedupe/read-only policies at high level
    - defined simple no-integration mode
    - defined phased rollout and architecture layers
    - added strict sequencing gate requiring completion of existing plans (including Intake regrouping)
  - Synced planning references:
    - linked Schedule plan in `docs/codebase-overview.md`
    - added downstream dependency note in `docs/unified-inventory-intake-refactor-plan.md`
- Files changed:
  - `docs/operational-calendar-schedule-plan.md`
  - `docs/unified-inventory-intake-refactor-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - This is planning-only; no feature behavior or architecture implementation changed in this slice.

### 2026-02-27 - Added unified Inventory Intake regrouping refactor plan (planning-only, no behavior changes)

- Suggested Commit Title: `chore: Added unified Inventory Intake regrouping refactor plan (planning-only, no behavior changes)`
- Scope:
  - Product-structure planning update to unify Shopping + Receive under an intent-first Intake model without changing feature behavior
- What changed:
  - Added a new dedicated planning document:
    - `docs/unified-inventory-intake-refactor-plan.md`
  - Documented the requested unified model and constraints:
    - Inventory Intake Hub with three intents (`Live Purchase`, `Bulk Intake`, `Supplier Sync`)
    - capability-driven industry adaptation (restaurants, contractors, salons, retailers)
    - shared Intake Session lifecycle (`Created`, `Active`, `Reviewing`, `Committed`, `Archived`)
    - migration strategy from current Shopping/Receive structure to unified intent-based navigation
    - explicit non-goal that this is grouping/orchestration refactor only (no feature removals or behavior changes)
  - Synced doc references so planning docs remain discoverable:
    - added the new plan to `docs/codebase-overview.md` related-plans list
    - added a follow-on pointer in `docs/inventoryintakeplan.md` to avoid split-brain planning
- Files changed:
  - `docs/unified-inventory-intake-refactor-plan.md`
  - `docs/codebase-overview.md`
  - `docs/inventoryintakeplan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Current implementation remains unchanged. This entry records product/system-design planning alignment only.

### 2026-02-27 - Receipt correction Phase 1.5 scaffold: produce normalization wired into core

- Suggested Commit Title: `chore: Receipt correction Phase 1.5 scaffold: produce normalization wired into core`
- Scope:
  - Initial code implementation slice for produce normalization/organic handling in the post-OCR correction pipeline
- What changed:
  - Added pure domain produce normalization module:
    - `src/domain/parsers/receipt-produce-normalization.ts`
    - 9-prefix PLU normalization (`94131` -> `4131`)
    - organic keyword stripping for EN/FR/ES tokens
    - conservative produce candidate gating (PLU/high-signal name hints + packaged SKU exclusion)
  - Wired produce normalization into `runReceiptCorrectionCore(...)` so corrected lines now populate:
    - `plu_code`
    - `organic_flag`
    - produce parse flags/actions (`plu_9prefix_normalized`, `organic_keyword_stripped`)
  - Added runtime bridge `src/domain/parsers/receipt-produce-normalization.js` so Node `--experimental-transform-types` tests resolve module imports while TypeScript remains strict
  - Extended receipt workflow/contracts pass-through shapes for produce fields (`ResolvedLineItem` optional produce fields, TabScanner-path propagation from corrected lines)
  - Expanded regression coverage:
    - added produce-focused unit tests in `src/domain/parsers/receipt-correction-core.test.mjs`
    - added fixture-harness produce assertions in `src/domain/parsers/receipt-correction-fixtures.test.mjs`
    - added produce fixture `test/fixtures/receipt-correction/grocery-parsed-text-produce-organic-plu-001.json`
  - Bumped correction parser version to `v1.2-numeric-tax-produce-normalization`
  - Updated overview/plan docs to reflect Phase 1.5 in-progress state and current implemented-vs-remaining scope
- Files changed:
  - `src/domain/parsers/receipt-produce-normalization.ts`
  - `src/domain/parsers/receipt-produce-normalization.js`
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `src/features/receiving/receipt/server/contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `test/fixtures/receipt-correction/grocery-parsed-text-produce-organic-plu-001.json`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (8/8; Node emitted expected experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (12/12; Node emitted expected experimental/module-type warnings)
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-produce-normalization.ts src/domain/parsers/receipt-produce-normalization.js src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs src/features/receiving/receipt/server/contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts test/fixtures/receipt-correction/README.md --quiet` -> PASS
- Notes:
  - This slice is intentionally domain-first. `receipt-produce-lookup.service.ts` and DB persistence fields (`ReceiptLineItem.plu_code`, `organic_flag`) remain pending follow-up schema/service work.

### 2026-02-26 - Receipt correction Phase 1 tax scaffold implemented (ON/QC interpretation + validation signals)

- Suggested Commit Title: `chore: Receipt correction Phase 1 tax scaffold implemented (ON/QC interpretation + validation signals)`
- Scope:
  - Initial code implementation slice for province-aware tax interpretation in the post-OCR receipt correction pipeline
- What changed:
  - Extended correction-core totals input to carry tax signal/context fields (`tax_lines`, province hint/source, address text)
  - Added tax interpretation output in `runReceiptCorrectionCore(...)` with:
    - province/source inference (`google_places`, `tax_labels`, `address_fallback`)
    - tax structure classification (`on_hst`, `qc_gst_qst`, etc.)
    - Ontario HST and Quebec GST/QST/TPS/TVQ math validation status (`pass`/`warn`/`not_evaluated`)
    - zero-tax candidate detection (`subtotal == total` with no tax lines) to reduce false-positive warnings
    - tax flags + label counts for observability
  - Wired workflow tax signals into correction calls:
    - raw-text path now extracts labeled tax lines and passes receipt text for address fallback
    - supplier `formatted_address` is now selected and used as a Google Places province hint when available
    - TabScanner path now passes generic tax lines plus province hints from supplier place context when available
  - Extended correction summary payload with tax interpretation fields (status/structure/province/source/flags/labels)
  - Added targeted correction-core tests for:
    - Ontario HST pass case
    - Quebec TPS/TVQ dual-tax pass case
    - zero-tax subtotal==total candidate handling
  - Updated overview and receipt-plan docs to reflect the implemented tax scaffold and next hardening steps
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `src/features/receiving/receipt/server/receipt.repository.ts`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (6/6; Node emitted expected experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (11/11; Node emitted expected experimental/module-type warnings)
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/domain/parsers/receipt-correction-core.test.mjs src/features/receiving/receipt/server/receipt.repository.ts src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - Google Places remains primary in policy, but this slice uses stored supplier `formatted_address` as the current place-context province signal (explicit place-details province fetch can be added in a follow-up hardening step).

### 2026-02-26 - Added Ontario/Quebec tax interpretation design guidance to receipt correction plan

- Suggested Commit Title: `chore: Added Ontario/Quebec tax interpretation design guidance to receipt correction plan`
- Scope:
  - Planning/docs update for improving receipt tax scanning/parsing and tax validation in the post-OCR correction pipeline
- What changed:
  - Added a detailed Ontario/Quebec tax interpretation layer section to `docs/receipt-post-ocr-correction-plan.md` covering:
    - province determination priority (`google_place_id` / tax labels / address fallback)
    - Ontario HST rules (`13%`, single-tax expectations)
    - Quebec GST+QST / TPS+TVQ rules (`5%` + `9.975%`, dual-tax expectations)
    - province-aware tax math validation logic
    - zero-rated grocery handling and auto-correction safety constraints
    - final tax decision hierarchy
  - Threaded tax interpretation requirements into scope, product outcomes, observability, fixture/test guidance, manual QA scenarios, and phased roadmap/open decisions
  - Updated `test/fixtures/receipt-correction/README.md` to include tax-focused fixture guidance (Ontario HST, Quebec TPS/TVQ, zero-rated groceries, mixed baskets, mismatch cases)
- Files changed:
  - `docs/receipt-post-ocr-correction-plan.md`
  - `test/fixtures/receipt-correction/README.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - This is a planning/design addition only; no tax parsing behavior was implemented in code in this slice.

### 2026-02-26 - Expanded receipt correction fixture corpus to 10 scenarios and added fixture-driven regression tests

- Suggested Commit Title: `chore: Expanded receipt correction fixture corpus to 10 scenarios and added fixture-driven regression tests`
- Scope:
  - Phase 0/1 validation infrastructure for post-OCR receipt correction tuning
- What changed:
  - Expanded `test/fixtures/receipt-correction/*` from seed examples to 10 runnable JSON scenarios (TabScanner and parsed-text paths)
  - Added machine-checkable fixture assertions (`totals_status`, changed/outlier lines, expected corrected line costs, required parse flags)
  - Added a fixture-driven `node:test` harness in `src/domain/parsers/receipt-correction-fixtures.test.mjs` that:
    - normalizes TabScanner fixtures into parser-like line items
    - runs parsed-text fixtures through `parseReceiptText(...)`
    - infers labeled printed totals from raw text when present
    - executes `runReceiptCorrectionCore(...)` and validates fixture assertions
  - Updated fixture documentation (`test/fixtures/receipt-correction/README.md`) with the machine-checkable assertion schema
  - Corrected the existing `grocery-tabscanner-total-mismatch-outlier-001` fixture expectations to assert the intended behavior (`warn` + outlier identification) rather than an impossible totals pass
  - Updated the receipt correction plan progress notes to reflect fixture corpus expansion and fixture-driven regression coverage
- Files changed:
  - `src/domain/parsers/receipt-correction-fixtures.test.mjs`
  - `test/fixtures/receipt-correction/README.md`
  - `test/fixtures/receipt-correction/costco-tabscanner-missing-decimal-001.json`
  - `test/fixtures/receipt-correction/costco-tabscanner-extra-digit-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-total-mismatch-outlier-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-split-numeric-token-001.json`
  - `test/fixtures/receipt-correction/costco-tabscanner-missing-decimal-qty-two-001.json`
  - `test/fixtures/receipt-correction/warehouse-tabscanner-no-correction-needed-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-missing-decimal-no-totals-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-missing-decimal-with-totals-002.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-ocr-o-zero-001.json`
  - `test/fixtures/receipt-correction/localgrocer-parsed-text-no-labeled-totals-split-token-001.json`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (11/11; Node emitted expected experimental/module-type warnings)
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs` -> PASS (14/14; Node emitted expected experimental/module-type warnings)
  - `npx eslint src/domain/parsers/receipt-correction-core.test.mjs src/domain/parsers/receipt-correction-fixtures.test.mjs --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - The fixture harness is pure/local and does not hit workflow/DB code, keeping threshold-tuning iterations fast.

### 2026-02-26 - Added unit tests for receipt correction core Phase 1 numeric/totals scenarios

- Suggested Commit Title: `chore: Added unit tests for receipt correction core Phase 1 numeric/totals scenarios`
- Scope:
  - Test coverage for the new Phase 1 post-OCR receipt correction core behavior
- What changed:
  - Added `node:test` coverage for `runReceiptCorrectionCore(...)` in `src/domain/parsers/receipt-correction-core.test.mjs`
  - Covered three high-value scenarios:
    - missing decimal inference from integer-like OCR values
    - split numeric token recovery from raw text (for example `9 49`)
    - totals-driven outlier re-check candidate swap (`14900` -> `1.49` when totals support it)
  - Updated the receipt correction plan progress notes to reflect the new targeted unit coverage
- Files changed:
  - `src/domain/parsers/receipt-correction-core.test.mjs`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `node --test --experimental-transform-types src/domain/parsers/receipt-correction-core.test.mjs` -> PASS (3/3; Node emitted expected experimental/module-type warnings)
  - `npx eslint src/domain/parsers/receipt-correction-core.test.mjs --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - Tests are focused on pure correction-core behavior and avoid workflow/DB dependencies to keep iteration fast during threshold tuning.

### 2026-02-26 - Receipt correction observability expanded (confidence bands + flag/action breakdowns)

- Suggested Commit Title: `chore: Receipt correction observability expanded (confidence bands + flag/action breakdowns)`
- Scope:
  - Phase 1 tuning instrumentation for post-OCR receipt correction (`shadow`/`enforce` summary visibility)
- What changed:
  - Extended `ReceiptPostOcrCorrectionSummary` with parse-confidence band counts plus parse-flag and correction-action type count maps
  - Aggregated the new counts from `core.lines` in `receipt-correction.service.ts` and included them in the receipt correction summary written to `parsed_data`
  - Rolled the new summary counts into process-local correction metrics aggregation/logging in `receipt-workflow.service.ts`
  - Added derived rates for low-parse-confidence and parse-flagged line ratios in correction metrics logs
  - Updated the receipt correction plan progress notes to reflect the observability expansion
- Files changed:
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-correction.contracts.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-workflow.service.ts --quiet` -> PASS
- Notes:
  - These counts are primarily for `shadow` tuning and process-local metrics logs; no receipt line persistence schema changes were introduced in this slice.

### 2026-02-26 - Receipt post-OCR correction Phase 1 follow-up: raw-text totals extraction wired into correction stage

- Suggested Commit Title: `chore: Receipt post-OCR correction Phase 1 follow-up: raw-text totals extraction wired into correction stage`
- Scope:
  - Raw OCR text receipt workflow integration improvement for the shared post-OCR correction engine
- What changed:
  - Added a lightweight labeled totals extractor in `receipt-workflow.service.ts` for raw OCR text (`Subtotal`, `Tax`, `Total`, and common variants)
  - Wired extracted totals into `runReceiptPostOcrCorrection(...)` from `parseAndMatchReceipt(...)`
  - This enables the Phase 1 totals-consistency outlier re-check logic to run on parsed-text receipts when printed totals can be recovered from OCR text
  - Updated the receipt post-OCR correction plan progress notes to reflect raw-text totals wiring completion
- Files changed:
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/receiving/receipt/server/receipt-workflow.service.ts --quiet` -> PASS
- Notes:
  - Extractor is label-driven and intentionally conservative; unlabeled/noisy totals lines will still fall back to `not_evaluated`.

### 2026-02-26 - Receipt post-OCR correction Phase 1 slice started (numeric sanity + totals outlier retry, shadow safe)

- Suggested Commit Title: `chore: Receipt post-OCR correction Phase 1 slice started (numeric sanity + totals outlier retry, shadow safe)`
- Scope:
  - First behavior-changing implementation slice for the receipt post-OCR correction engine (Phase 1)
- What changed:
  - Replaced the receipt correction core pass-through behavior with a pure numeric sanity pipeline in `src/domain/parsers/receipt-correction-core.ts`
  - Added dual numeric candidate generation/scoring for integer-like OCR values and split numeric tokens (for example `949`, `14900`, `9 49`)
  - Added guarded totals-consistency outlier re-check selection that can swap a line to an alternate numeric candidate when it improves receipt total delta
  - Added line-level parse confidence/flags/correction actions population in the core result (still separate from inventory match confidence)
  - Fixed `shadow` mode behavior in `receipt-correction.service.ts` so corrections are computed for observability but only applied to persisted lines in `enforce` mode
  - Bumped receipt correction parser version string for observability summaries
  - Updated the receipt post-OCR correction plan doc progress notes to mark Phase 1 as started/in-progress
  - Updated the overview receipt flow to explicitly include the post-OCR correction/reconciliation stage
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/domain/parsers/receipt-correction-core.ts src/features/receiving/receipt/server/receipt-correction.service.ts --quiet` -> PASS
- Notes:
  - Raw text receipt workflow still does not pass printed totals into the correction core yet, so totals re-check is currently most effective on the TabScanner path.
  - Fixture corpus expansion and threshold tuning remain pending Phase 1 follow-up work.

### 2026-02-26 - Split overview vs changelog docs and added receipt-plan handoff sections

- Suggested Commit Title: `chore: Split overview vs changelog docs and added receipt-plan handoff sections`
- Scope:
  - Documentation maintenance refactor to separate architecture overview from changelog history, plus a continuation handoff update for the receipt post-OCR correction plan
- What changed:
  - Split the old embedded changelog out of `docs/codebase-overview.md` into a dedicated `docs/codebase-changelog.md`
  - Added a required agent note at the top of `docs/codebase-changelog.md` reminding agents to also update `docs/codebase-overview.md` when fundamental app behavior/capabilities change
  - Updated `docs/codebase-overview.md` wording to reflect overview-only responsibility and point changelog instructions to `docs/codebase-changelog.md`
  - Updated plan-doc references that still pointed to the old embedded changelog location (`docs/income-integrations-onboarding-plan.md`, `docs/receipt-post-ocr-correction-plan.md`)
  - Added `Latest Update` and `Pick Up Here (Next Continuation)` sections to `docs/receipt-post-ocr-correction-plan.md` documenting the completed Phase 0 scaffolding slice and next Phase 1 steps
- Files changed:
  - `docs/codebase-overview.md`
  - `docs/codebase-changelog.md`
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/receipt-post-ocr-correction-plan.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Historical changelog entries were preserved and moved intact to the new dedicated changelog file.

### 2026-02-26 - Receipt post-OCR correction Phase 0 scaffolding (feature-flagged pass-through + observability)

- Suggested Commit Title: `chore: Receipt post-OCR correction Phase 0 scaffolding (feature-flagged pass-through + observability)`
- Scope:
  - Initial implementation slice for the post-TabScanner receipt correction/reconciliation plan (foundation only; no parsing behavior changes yet)
- What changed:
  - Added a new domain correction core scaffold (`src/domain/parsers/receipt-correction-core.ts`) that currently runs pass-through line handling and computes receipt totals consistency observability
  - Added receipt feature correction contracts/service wrappers with env-based mode control (`off` / `shadow` / `enforce`) in `src/features/receiving/receipt/server/receipt-correction.*`
  - Inserted the correction stage into both receipt workflows before inventory matching:
    - `parseAndMatchReceipt(...)` (raw OCR text path)
    - `processReceiptImage(...)` (TabScanner structured path)
  - Added process-local receipt correction metrics logging (source/mode/totals-check status counts) in `receipt-workflow.service.ts`
  - Extended receipt `parsed_data` summary shape to include a correction summary payload (`ParsedDataSummary.correction`)
  - Added fixture corpus scaffold + seed receipt-correction fixtures under `test/fixtures/receipt-correction/*`
  - Updated the receipt post-OCR correction plan status to mark Phase 0 as partial/in-progress
- Files changed:
  - `src/domain/parsers/receipt-correction-core.ts`
  - `src/features/receiving/receipt/server/receipt-correction.contracts.ts`
  - `src/features/receiving/receipt/server/receipt-correction.service.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
  - `src/features/receiving/receipt/server/contracts.ts`
  - `src/features/receiving/receipt/server/index.ts`
  - `test/fixtures/receipt-correction/README.md`
  - `test/fixtures/receipt-correction/costco-tabscanner-missing-decimal-001.json`
  - `test/fixtures/receipt-correction/walmart-parsed-text-split-numeric-token-001.json`
  - `test/fixtures/receipt-correction/grocery-tabscanner-total-mismatch-outlier-001.json`
  - `test/fixtures/receipt-correction/costco-tabscanner-extra-digit-001.json`
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx eslint src/features/receiving/receipt/server/receipt-workflow.service.ts src/features/receiving/receipt/server/contracts.ts src/features/receiving/receipt/server/index.ts src/features/receiving/receipt/server/receipt-correction.service.ts src/features/receiving/receipt/server/receipt-correction.contracts.ts src/domain/parsers/receipt-correction-core.ts --quiet` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - This is an insertion/scaffolding slice only: no numeric auto-correction is applied yet, and line values remain unchanged by default (`RECEIPT_POST_OCR_CORRECTION_MODE=off`).

### 2026-02-26 - Added implementation plan for post-OCR receipt correction/reconciliation accuracy layer

- Suggested Commit Title: `chore: Added implementation plan for post-OCR receipt correction/reconciliation accuracy layer`
- Scope:
  - New planning document for improving post-TabScanner receipt parsing accuracy (numeric sanity, structural parsing, confidence scoring, store memory)
- What changed:
  - Added a separate detailed implementation plan focused on the receipt processing stage after OCR and before structured line-item persistence/matching
  - Documented a playbook-compliant architecture split:
    - pure correction logic in `src/domain/parsers/*`
    - workflow/history/profile orchestration in `src/features/receiving/receipt/server/*`
  - Mapped high-impact improvements into concrete workstreams:
    - numeric sanity + decimal correction
    - dual numeric interpretation
    - receipt total consistency reconciliation
    - line-level parse confidence
    - store-specific pattern memory
    - structured (non-regex-only) parsing upgrades
  - Included exact insertion points in `receipt-workflow.service.ts` for both `processReceiptImage(...)` and `parseAndMatchReceipt(...)`
  - Added phased rollout, shadow-mode strategy, and validation/fixture plan
  - Added the new plan doc to the related historical/planning docs list in this overview
- Files changed:
  - `docs/receipt-post-ocr-correction-plan.md`
  - `docs/codebase-overview.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Plan is intentionally scoped to post-OCR receipt parsing/correction and excludes image-quality, barcode, and shopping-mode concerns.

### 2026-02-26 - Added implementation plan for business-type income integrations onboarding + OAuth/sync architecture

- Suggested Commit Title: `chore: Added implementation plan for business-type income integrations onboarding + OAuth/sync architecture`
- Scope:
  - New planning document for income-provider onboarding, OAuth connections, sync, and normalization rollout
- What changed:
  - Added a detailed implementation plan covering:
    - business-type signup/onboarding UX
    - modular provider catalog and connection architecture
    - OAuth start/callback pattern with token encryption and PKCE/state handling
    - sync model (initial + incremental + webhook-triggered)
    - normalized `IncomeEvent` model and compatibility projection to existing `FinancialTransaction`
    - playbook-compliant file placement under `src/features/integrations/*` and thin wrappers in `app/*`
    - phased rollout, validation expectations, and open decisions
  - Added the new plan doc to the related historical/planning docs list in this overview
- Files changed:
  - `docs/income-integrations-onboarding-plan.md`
  - `docs/codebase-overview.md`
- Validation run:
  - Documentation update only (no code validation commands run)
- Notes:
  - Plan intentionally aligns with the current codebase state (existing `Business.industry_type`, `FinancialTransaction`, `ExternalSyncLog`, and home dashboard income layer refactor) to minimize migration risk.

### 2026-02-26 - Home dashboard layer feature extracted into `src/features/home/*` (playbook compliance)

- Suggested Commit Title: `chore: Home dashboard layer feature extracted into src/features/home/* (playbook compliance)`
- Scope:
  - Home dashboard interactive income/expense layer feature follow-up refactor for feature-module compliance
- What changed:
  - Created canonical home feature module paths: `src/features/home/server/*`, `src/features/home/ui/*`, and `src/features/home/shared/*`
  - Moved dashboard summary period/window query and aggregation workflow out of `app/actions/core/financial.ts` into `src/features/home/server/*` (repository + service)
  - Converted `app/actions/core/financial.ts#getDashboardSummary` into a thin wrapper that enforces tenant auth and delegates to the home feature service
  - Moved `HomeIncomeLayer` and `HomeTransactionsLayer` plus their UI helpers/contracts out of `app/page.tsx` into `src/features/home/ui/*`
  - Kept `app/page.tsx` as route composition/state wiring while preserving the interactive collapse/expand behavior
  - Updated architecture map + product capabilities sections in this document to include the new home feature module and canonical paths
- Files changed:
  - `src/features/home/server/dashboard-summary.repository.ts`
  - `src/features/home/server/dashboard-summary.service.ts`
  - `src/features/home/server/index.ts`
  - `src/features/home/shared/dashboard-summary.contracts.ts`
  - `src/features/home/ui/home-financial-layer.shared.tsx`
  - `src/features/home/ui/HomeIncomeLayer.tsx`
  - `src/features/home/ui/HomeTransactionsLayer.tsx`
  - `src/features/home/ui/index.ts`
  - `app/actions/core/financial.ts`
  - `app/page.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint app/page.tsx app/actions/core/financial.ts src/features/home/server/*.ts src/features/home/shared/*.ts src/features/home/ui/*.tsx src/features/home/ui/*.ts --quiet` -> baseline/pre-existing `react-hooks/set-state-in-effect` error remains in `app/page.tsx` (`setLoading(true)` inside `useEffect`)
- Notes:
  - This refactor addresses the playbook compliance gap recorded in the prior home-dashboard changelog entry.

### 2026-02-26 - Home dashboard interactive income/expense layers + income source breakdown

- Suggested Commit Title: `chore: Home dashboard interactive income/expense layers + income source breakdown`
- Scope:
  - Home dashboard financial layers (income/expense split interaction) and dashboard summary data aggregation
- What changed:
  - Split home financial sheet into separate `HomeIncomeLayer` and `HomeTransactionsLayer` components (currently local component functions in `app/page.tsx`)
  - Added interactive layer behavior so tapping the income layer collapses the transactions layer and expands an income-source breakdown view
  - Limited the transactions layer to expense records only while the income layer surfaces income by source
  - Added business-type-aware income source ordering (e.g., restaurant prioritizes GoDaddy POS, Uber Eats, DoorDash)
  - Extended `getDashboardSummary()` to return aggregated `incomeBreakdown` grouped by transaction source for the selected period
- Files changed:
  - `app/page.tsx`
  - `app/actions/core/financial.ts`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx eslint app/page.tsx app/actions/core/financial.ts --quiet` -> baseline/pre-existing `react-hooks/set-state-in-effect` error remains in `app/page.tsx`; no new errors in `app/actions/core/financial.ts`
  - `npm run lint` -> known repo baseline noise/failures (including generated `playwright-report` assets), unchanged by this feature
- Notes:
  - Playbook compliance is partial: UI/server logic were implemented in route/action files (`app/page.tsx`, `app/actions/core/financial.ts`) instead of feature modules under `src/features/*`; follow-up extraction is recommended for strict compliance.

Entry format (recommended):

- Date
- Scope
- What changed
- Files changed
- Validation run
- Notes / caveats

### 2026-02-26 - Global design language refresh (finance-style shell with green primary)

- Suggested Commit Title: `chore: Global design language refresh (finance-style shell with green primary)`
- Scope:
  - Cross-app visual language update (dark/light theme-aware) + homepage redesign
- What changed:
  - Updated global theme tokens in `app/globals.css` for cleaner matte surfaces, softer shadows, and green-first hero accents
  - Added reusable UI surface classes (`app-control`, `app-hero-card`, `app-hero-inset`, `app-sheet`, `app-sheet-row`)
  - Updated shared `Card` and `BottomNav` components so many pages inherit the new rounded finance-app style automatically
  - Redesigned `app/page.tsx` to a green hero + rounded sheet layout while preserving existing features (period toggle, balance summary, contacts shortcut, transaction feed)
- Files changed:
  - `app/globals.css`
  - `components/ui/card.tsx`
  - `components/nav/bottom-nav.tsx`
  - `app/page.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - This pass focuses on shared surfaces + homepage; some feature pages still use local styling and may need follow-up polish to fully align with the new language.

### 2026-02-26 - Homepage UI cleanup (reduced glow and card density)

- Suggested Commit Title: `chore: Homepage UI cleanup (reduced glow and card density)`
- Scope:
  - Dashboard/home page visual simplification for cleaner presentation
- What changed:
  - Removed heavy glow/gradient treatment from the top header/summary area
  - Flattened top nav controls (profile/search/reports) to a simpler surface style
  - Replaced boxed summary "stat pills" with a lighter inline summary row
  - Simplified quick action + transaction card treatments (less border/shadow intensity)
- Files changed:
  - `app/page.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Notes:
  - No behavior/data-loading changes; this is a presentation-only cleanup.

### 2026-02-26 - Codebase overview promoted to architecture handbook + engineering guide + changelog

- Suggested Commit Title: `chore: Codebase overview promoted to architecture handbook + engineering guide + changelog`
- Scope:
  - Replaced the old MVP-style overview with a current-state architecture reference covering refactor outcomes, inventory intelligence features, feature placement rules, accepted exceptions, and changelog process.
- What changed:
  - Added canonical architecture map (`app`, `src/features`, `src/domain`, `src/server`, `src/shared`)
  - Added feature implementation summaries (barcode resolver, receipt aliasing, shopping reconciliation, inventory enrichment queue)
  - Added explicit rules for future engineers on where new code must go
  - Added accepted exceptions/validation gaps and operational notes
  - Added changelog process and backfilled historical milestone summaries below
- Files changed:
  - `docs/codebase-overview.md`
- Validation run:
  - Documentation update only (no new code validation commands run)
- Notes:
  - This file is now expected to be updated after every meaningful change.

### 2026-02-26 - Fixed Inventory page client-bundle server import leak (`pg`/`dns` in browser build)

- Suggested Commit Title: `chore: Fixed Inventory page client-bundle server import leak (pg/dns in browser build)`
- Scope:
  - Inventory enrichment queue client hook/import boundaries
- What changed:
  - Moved shared inventory enrichment queue types/constants into a client-safe feature file:
    - `src/features/inventory/shared/enrichment-queue.contracts.ts`
  - Updated client UI/hook imports to use the new shared path instead of importing from `@/features/inventory/server`
  - Kept server API compatibility by re-exporting the shared contracts from `src/features/inventory/server/inventory.service.ts`
- Files changed:
  - `src/features/inventory/shared/enrichment-queue.contracts.ts`
  - `src/features/inventory/server/inventory.service.ts`
  - `src/features/inventory/ui/use-enrichment-dismissals.ts`
  - `src/features/inventory/ui/InventoryListPageClient.tsx`
  - `docs/codebase-overview.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint src/features/inventory/shared/enrichment-queue.contracts.ts src/features/inventory/server/inventory.service.ts src/features/inventory/ui/use-enrichment-dismissals.ts src/features/inventory/ui/InventoryListPageClient.tsx` -> PASS
  - `rg -n '@/features/inventory/server' src/features/inventory/ui` -> no matches
- Notes:
  - Root cause: `use-enrichment-dismissals.ts` imported `ENRICHMENT_SNOOZE_HOURS` from the inventory server barrel, which pulled Prisma/`pg` into the client bundle and caused the `dns` module resolution error in Next.js/Turbopack.

### 2026-02-26 - Refactor plan complete through Phase 8 (manual integrated smoke deferred)

- Suggested Commit Title: `chore: Refactor plan complete through Phase 8 (manual integrated smoke deferred)`
- Scope:
  - App structure refactor final closeout
- What changed (summary from refactor playbook):
  - Route-thin + feature-first structure established across shopping/receiving/inventory/contacts/staff
  - Shared/domain/server wrapper slices and feature import cleanup completed
  - Phase 8 wrapper keep/defer matrix documented
  - Accepted exceptions finalized (shopping route large, zero wrapper removals this phase, known lint/test exceptions)
- Files changed (representative/canonical areas):
  - `src/features/*`
  - `src/domain/*`
  - `src/server/*`
  - `src/shared/*`
  - `app/actions/*` wrappers
  - `app/(dashboard)/*` route wrappers
- Validation run (recorded in refactor playbook):
  - `npx tsc --noEmit --incremental false` PASS
  - targeted tests PASS except documented Node ESM issue for `barcode-resolver-core.test.mjs`
  - `npm run lint` FAIL with known baseline exceptions/noise
  - localhost HEAD route smoke PASS
- Notes:
  - Manual integrated smoke deferred to user/final QA pass.

### 2026-02-26 - Inventory Plan Phase D complete (enrichment queue)

- Suggested Commit Title: `chore: Inventory Plan Phase D complete (enrichment queue)`
- Scope:
  - Optional non-blocking "Fix Later" enrichment workflow
- What changed (summary from inventory plan):
  - Added derived enrichment queue in Inventory UI
  - Added client-side persistent task actions (complete/defer/snooze via localStorage)
  - Expanded sources (barcode metadata, receipt matching, shopping pairing leftovers, normalization gaps)
  - Added queue observability summaries in UI
- Canonical files:
  - `src/features/inventory/server/inventory.repository.ts`
  - `src/features/inventory/server/inventory.service.ts`
  - `src/features/inventory/server/index.ts`
  - `src/features/inventory/ui/InventoryListPageClient.tsx`
  - `src/features/inventory/ui/use-enrichment-dismissals.ts`
  - `app/actions/core/inventory.ts` (wrapper wiring)
- Validation run (recorded in inventory plan):
  - `npx tsc --noEmit --incremental false` PASS
  - targeted eslint on inventory files PASS
- Notes:
  - Server-side persistent enrichment task table intentionally deferred.

### 2026-02-26 - Inventory Plan Phase E complete (observability and hardening)

- Suggested Commit Title: `chore: Inventory Plan Phase E complete (observability and hardening)`
- Scope:
  - Resolver/web fallback hardening, metrics, retries, derived rates
- What changed (summary from inventory plan):
  - Web fallback hardening (timeouts/retries/cooldowns/observability)
  - Barcode provider aggregate metrics + resolver metrics
  - Barcode lookup abuse controls and cooldowns
  - Background retry scheduling for unresolved barcodes
  - Derived-rate summaries for resolver and receipt matching
- Key files (representative):
  - `lib/modules/shopping/web-fallback.ts`
  - `app/actions/core/barcode-resolver.ts`
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts`
- Notes:
  - Many metrics/retry mechanisms are process-local and reset on restart.

### 2026-02-26 - Inventory Plan Phases B/C complete; receipt aliasing and external barcode provider layering in production code

- Suggested Commit Title: `chore: Inventory Plan Phases B/C complete; receipt aliasing and external barcode provider layering in production code`
- Scope:
  - Barcode provider integrations and place-scoped receipt aliasing
- What changed (summary from inventory plan):
  - Implemented OFF/OBF/UPCDatabase/UPCitemdb provider layering with caching/provenance
  - Added place-scoped receipt alias mapping and matching/learning integration
  - Preserved receipt commit idempotency and tenant isolation
- Key schema/entities:
  - `GlobalBarcodeCatalog`
  - `BarcodeResolutionEvent`
  - `ReceiptItemAlias`

### 2026-02-25 to 2026-02-26 - Major architecture transition completed (historical backfill summary)

- Suggested Commit Title: `chore: Major architecture transition completed (historical backfill summary)`
- Scope:
  - Full route-thin, feature-first refactor and inventory intelligence rollout from plan docs
- What changed:
  - Phases 0-8 refactor plan executed and documented
  - Phases 0/A/B/C/D/E inventory plan executed and documented
  - Combined coordination plan used to sequence high-churn work safely
- Notes:
  - Detailed step-by-step logs remain in:
    - `docs/app-structure-refactor-agent-playbook.md`
    - `docs/inventoryintakeplan.md`
    - `docs/combined-plan-coordination.md`

## Changelog Entry Template (Copy / Append At Top)

```md
### YYYY-MM-DD - <short change title>

- Suggested Commit Title: `chore: <short change title>`
- Scope:
  - <what area changed>
- What changed:
  - <summary>
  - <summary>
- Files changed:
  - `<path>`
  - `<path>`
- Validation run:
  - `<command>` -> <PASS/FAIL + notes>
  - `<command>` -> <PASS/FAIL + notes>
- Notes:
  - <caveats / follow-up / accepted exceptions>
```









