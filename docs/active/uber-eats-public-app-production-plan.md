# Uber Eats Public App Production Plan

Status: ACTIVE - audit complete, production implementation not started
Created: 2026-03-06
Last Updated: 2026-03-06
Primary Purpose: canonical sequencing and production-readiness tracker for a public multi-restaurant Uber Eats integration covering income, menu publishing, and store availability.

## Compressed Invariant Block (Read First Every Session)

- This plan targets a public multi-restaurant app, not a single-merchant custom integration.
- No silent scope expansion; lock the supported Uber API surface before implementation.
- Merchant activation and ongoing Uber API access must use the correct Uber production model.
- Store provisioning must be explicit and per location.
- Income sync must use the real Uber reporting flow, not a guessed JSON event feed.
- Webhook verification must align with Uber's current production signing model.
- Menu publishing, item availability, and store status changes must be idempotent and auditable.
- Multi-tenant isolation is required across businesses, stores, tokens, and webhook events.
- Each completed checklist step must have scoped validation before advancing.
- A task cannot close unless validation includes:
  - proportional diff review
  - unrelated-file review
  - dependency-change review
  - environment-variable review
- Canonical doc sync is required for each completed slice.

Constitution source: `docs/active/execution-constitution.md`

## How To Use This File

1. Start each session by reading:
   - `## Last Left Off Here`
   - `## Canonical Order Checklist`
2. Claim exactly one or two adjacent checklist items.
3. Run preflight and mandatory restatement before editing.
4. Execute and validate.
5. Update:
   - this file (checklist + latest planning summary + next left-off marker)
   - `docs/active/codebase-changelog.md` when implementation work occurs
   - `docs/active/codebase-overview.md` when architecture or canonical runtime paths change
6. Commit checkpoint:
   - create one scoped git commit to this repository for each completed implementation checklist step before moving to the next step

## Immutable Constitution Reference (Required)

- Canonical non-negotiables are defined in `docs/active/execution-constitution.md`.
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
2. Mark the task `[!]` blocked in this checklist.
3. Do not execute the deviation until approved.
4. After approval, update affected source plans and this plan before implementation.

## Database and Prisma Integrity Contract (Required)

Prisma schema is authoritative for DB-backed work.

Before any DB-related change:

1. Read `prisma/schema.prisma`.
2. Read the latest migration SQL.
3. Confirm model/field names, nullability, relations, indexes, and enums.
4. Run targeted usage scan before edits:
   - `rg -n "<model_or_table_name>" src app test docs prisma`

Hard rules:

- Never assume token, store, report, or webhook persistence fields from memory.
- Never overload the existing generic income connection model if Uber requires distinct app-level and store-level auth artifacts.
- Never mark DB tasks complete without preflight evidence in job summary/changelog.

## Autonomous Execution Contract (Required)

Use this when asked to continue from the plan.

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
- unresolved Uber product or approval blocker
- unapproved deviation request

## Scoped Preflight Gate (No Duplicate Code)

Before coding each task:

1. Read the exact phase for the selected task ID in this file.
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
   - no new unauthorized color systems introduced
   - no glow/gradient/decorative motion introduced
   - no major layout hierarchy repositioning in autonomous refactor slices
9. This plan status/update/pickup pointer synced.
10. Changelog entry appended when implementation occurs.
11. `docs/active/codebase-overview.md` updated when behavior or architecture changes.
12. Per-step commit checkpoint recorded:
   - a scoped git commit for this completed step exists in repository history
   - commit hash and message are recorded in job summary/changelog

## Auto-Advance Sequence Gates

- Start `UEP-01+` only after `UEP-00` is fully `[x]`.
- Start `UEP-02+` only after `UEP-01` is fully `[x]`.
- Start `UEP-03+` only after `UEP-02` is fully `[x]`.
- Start `UEP-04+` only after `UEP-03` is fully `[x]`.
- Start `UEP-05+` only after `UEP-04` is fully `[x]`.
- Start `UEP-06+` only after `UEP-05` is fully `[x]`.
- Start `UEP-07+` only after `UEP-06` is fully `[x]`.
- Start `UEP-08` only after `UEP-07` is fully `[x]`.

## Completion Percentage (Update Every Slice)

Use `Canonical Order Checklist` statuses as source of truth.

- Strict completion % formula:
  - `([x] count / total checklist items) * 100`
- Weighted progress % formula:
  - `(([x] count + 0.5 * [~] count) / total checklist items) * 100`

Current snapshot (2026-03-06):

- Checklist items total: `32`
- Checklist `[x]`: `4`
- Checklist `[~]`: `0`
- Strict completion: `12.50%`
- Weighted progress: `12.50%`

Update rule after each slice:

1. Update checklist statuses first.
2. Recalculate strict and weighted percentages.
3. Update this section.

## Context

- Current codebase has generic income-integration scaffolding for OAuth start/callback, token storage, manual sync, cron sync, and webhook signature verification.
- Current Uber-specific runtime implementation is reporting-oriented only:
  - generic OAuth adapter
  - generic stored access-token sync model
  - heuristic JSON event normalization
  - webhook heartbeat only
- Current codebase does not implement Uber-specific production flows for:
  - store provisioning
  - app-level service-token issuance
  - reporting CSV generation and parsing
  - menu publish and diffing
  - store availability and holiday hours
  - order lifecycle ingestion and actions
- Product target for this plan:
  - public app used by multiple restaurants
  - restaurant connects Uber account
  - app syncs Uber income stream
  - app manages menu publishing and item availability
  - app manages store online or offline state

Primary Uber doc surfaces referenced during planning:

1. Authentication
2. Integration activation flows
3. Reporting
4. Menu integration
5. Store integration
6. Webhooks
7. Going live

## Program Posture

Support target in this plan:

- Public production Uber Eats partner app: full support
- Single-merchant custom Uber setup: not the canonical target

Current active streams:

- UEP-00 contract and platform model lock
- UEP-01 Uber dashboard and partner prerequisites
- UEP-02 auth and persistence refactor
- UEP-03 activation and provisioning flow
- UEP-04 reporting and income ingestion
- UEP-05 menu and availability controls
- UEP-06 webhook and order event operations
- UEP-07 multi-tenant operations UX
- UEP-08 production hardening and go-live

## Last Left Off Here

- Current task ID: `UEP-03-a`
- Current task: `Validate the new sandbox store discovery and provisioning path against real Uber test stores`
- Status: `READY`
- Last updated: `2026-03-06`
- Note: V1 feature set is codified and sandbox store-management scaffolding exists; production dashboard approval tasks in `UEP-01` remain externally pending.

## Canonical Order Checklist

Status legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` completed
- `[!]` blocked

### Initiative UEP - Uber Eats Public App Production Support

Plan doc: `docs/active/uber-eats-public-app-production-plan.md`

#### Phase UEP-00 - Contract lock and baseline audit

- [x] UEP-00-a: Audit existing Uber Eats codepaths and identify production architecture mismatches
- [x] UEP-00-b: Document required Uber Developer Dashboard artifacts for a production app
- [x] UEP-00-c: Lock exact auth model (`authorization_code` activation + service-token runtime if required by approved API set)
- [x] UEP-00-d: Lock initial supported feature set for V1 (`income`, `menu`, `availability`, `store status`; order actions optional only if approved)

#### Phase UEP-01 - Uber partner onboarding and dashboard prerequisites

- [ ] UEP-01-a: Create production Uber Eats developer app and collect client credentials
- [ ] UEP-01-b: Register production callback and webhook URLs in Uber dashboard
- [ ] UEP-01-c: Submit scope and production approval request to Uber for the exact V1 API surface
- [ ] UEP-01-d: Establish pilot merchant and store set for end-to-end certification

#### Phase UEP-02 - Auth model and persistence refactor

- [ ] UEP-02-a: Refactor connection model to separate merchant activation artifacts from ongoing Uber service access
- [ ] UEP-02-b: Persist Uber organization, store, provisioning, and scope state explicitly
- [ ] UEP-02-c: Add idempotent webhook event ledger and provider-specific sync cursor or report-job persistence
- [ ] UEP-02-d: Replace generic expiry-only reconnect path with the correct Uber runtime token strategy

#### Phase UEP-03 - Merchant connect, store discovery, and provisioning

- [ ] UEP-03-a: Implement Uber-specific connect UX for public multi-restaurant onboarding
- [ ] UEP-03-b: Exchange activation code and fetch available Uber stores for the merchant
- [ ] UEP-03-c: Provision selected stores and persist per-store activation status
- [ ] UEP-03-d: Add reconnect, deprovision, and failed-provision recovery flows

#### Phase UEP-04 - Reporting and income ingestion

- [ ] UEP-04-a: Replace `INCOME_UBER_EATS_EVENTS_URL` JSON sync with a real Uber reporting client
- [ ] UEP-04-b: Implement report generation, polling, download, parsing, and idempotent import
- [ ] UEP-04-c: Reconcile Uber orders, fees, payouts, and ledger rows against canonical financial transactions
- [ ] UEP-04-d: Add merchant-visible sync status, stale-sync alerts, and retry flows

#### Phase UEP-05 - Menu publishing, availability, and store controls

- [ ] UEP-05-a: Map local menu domain to Uber menu payload requirements and validation rules
- [ ] UEP-05-b: Implement full menu publish and publish-diff preview
- [ ] UEP-05-c: Implement item-level price, stock, and availability updates from app controls
- [ ] UEP-05-d: Implement store online or offline status and holiday-hours controls

#### Phase UEP-06 - Webhooks and operational event handling

- [ ] UEP-06-a: Replace heartbeat-only webhook handling with Uber-specific verified event ingestion
- [ ] UEP-06-b: Route menu, store, and reporting-related events into idempotent processing paths
- [ ] UEP-06-c: Add order lifecycle ingestion if V1 approval includes order events
- [ ] UEP-06-d: Add optional order action endpoints only if Uber approves the necessary scopes

#### Phase UEP-07 - Public app UX, permissions, and support operations

- [ ] UEP-07-a: Add multi-location store-linking and health-status UX in `/integrations`
- [ ] UEP-07-b: Add per-business audit log for Uber provisioning, publish, availability, and sync actions
- [ ] UEP-07-c: Add role-appropriate controls so owner or manager can manage Uber without exposing unrelated admin data
- [ ] UEP-07-d: Add support diagnostics for broken webhook, stale report job, scope mismatch, and deprovisioned store states

#### Phase UEP-08 - Production hardening and launch gate

- [ ] UEP-08-a: Run end-to-end pilot with multiple restaurants and multiple Uber stores
- [ ] UEP-08-b: Validate menu publish, availability toggles, income sync, and webhook replay failure paths
- [ ] UEP-08-c: Add monitoring, alerting, runbooks, and rollback procedures
- [ ] UEP-08-d: Mark Uber Eats public app support production-ready only after approved-scope live verification

## Post-V1 Queue

Deferred until V1 is stable:

- order acceptance, denial, and ready-for-pickup actions
- automated inventory-driven 86 logic tied directly to Uber availability updates
- menu drift detection between local menu and Uber live state
- payout discrepancy assistant and exception dashboard
- SLA alerts for paused stores, failed menu publishes, and stale report imports

## Documentation Sync Checklist (Run Every Session)

- [ ] Source plan file(s) updated (`Last Updated`, status markers, and `Last Left Off Here`).
- [ ] Mandatory restatement recorded for the executed task(s).
- [ ] Validation evidence recorded, including proportional diff, unrelated-file check, dependency check, env-var check.
- [ ] For UI-touching tasks, design restatement and UI governance checks recorded.
- [ ] Checklist + left-off marker + completion percentage updated.
- [ ] `docs/active/codebase-changelog.md` appended with newest entry at top when implementation work occurs.
- [ ] Single touched-files log included in that changelog entry when implementation work occurs.
- [ ] `docs/active/codebase-overview.md` updated when behavior or architecture changed.
- [ ] Scoped git commit to this repository created after each completed implementation step before advancing.

## Completion Snapshot

- Active initiatives: `1` (`UEP`)
- Checklist items complete: `4`
- Checklist items remaining: `28`

## Latest Planning Summary

### 2026-03-06 - UEP-00-d completed (V1 feature lock codified and sandbox store-management path scaffolded)

- Planning restatement:
  - Task ID: `UEP-00-d`
  - Scope: codify the supported Uber V1 surface in code and add the first usable sandbox store-management path without expanding into orders or promotions.
  - Invariants confirmed: V1 remains limited to income, menu, availability, and store status; no order API enablement; no fake reporting endpoint introduced.
  - Validation controls confirmed: targeted tests, lint, and full typecheck required.
- Implementation:
  - Added `UBER_EATS_V1_CAPABILITIES` to lock the supported product surface in server code.
  - Added a dedicated `/integrations/uber-eats` page that loads merchant stores from the Uber sandbox provisioning token.
  - Added sandbox provision and deprovision routes for Uber merchant stores.
  - Updated the connected Uber card on `/integrations` to open the new Uber management page instead of immediately forcing reconnect.
  - Extended store parsing to expose provisioning-related fields from Uber `pos_data`.
- Validation:
  - `node --test src/features/integrations/providers/uber-eats.marketplace.test.mjs` -> PASS
  - `npx eslint app/(dashboard)/integrations/uber-eats/page.tsx app/api/integrations/uber-eats/stores/provision/route.ts app/api/integrations/uber-eats/stores/deprovision/route.ts src/features/integrations/server/uber-eats.service.ts src/features/integrations/server/provider-catalog.ts src/features/integrations/providers/uber-eats.marketplace.ts src/features/integrations/providers/uber-eats.marketplace.test.mjs` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Immediate next execution target:
  - `UEP-03-a` / `UEP-03-b` validation against real Uber sandbox stores so the new discovery/provisioning path can be confirmed end-to-end

### 2026-03-06 - UEP-00-c completed (Uber auth/runtime split scaffolded in code)

- Planning restatement:
  - Task ID: `UEP-00-c`
  - Scope: codify the Uber auth/runtime split so authorization-code connect flow is reserved for provisioning and client-credentials runtime helpers exist for store/reporting calls.
  - Invariants confirmed: no order API expansion; no fake production event endpoint added; sandbox-safe setup preserved for the test app.
  - Validation controls confirmed: targeted tests, lint, and full typecheck required.
- Implementation:
  - Added a Uber-specific OAuth adapter that now treats `eats.pos_provisioning` as the authorization-code connect scope.
  - Added Uber marketplace helpers for client-credentials token exchange, sandbox-vs-production API base inference, store listing, and POS provisioning endpoint wrappers.
  - Updated webhook secret handling to fall back to the configured Uber client secret and to match on both account and location identifiers.
  - Updated sandbox env config to use sandbox OAuth endpoints and provisioning scope for the test app.
  - Kept reporting sync explicitly unfinished rather than inventing a fake `INCOME_UBER_EATS_EVENTS_URL` contract.
- Validation:
  - `node --test src/features/integrations/providers/uber-eats.marketplace.test.mjs` -> PASS
  - `npx eslint src/features/integrations/providers/registry.ts src/features/integrations/providers/uber-eats.marketplace.ts src/features/integrations/providers/uber-eats.provider.ts src/features/integrations/shared/oauth.contracts.ts app/api/integrations/webhooks/uber-eats/route.ts` -> PASS
  - `npx tsc --noEmit --incremental false` -> PASS
- Immediate next execution target:
  - `UEP-00-d` to lock the exact V1 surface that will sit on top of this auth/runtime split before UI or route expansion starts

### 2026-03-06 - Initial public-app production plan created from code audit and Uber production requirements review

- Planning restatement:
  - Scope: define the canonical execution plan for a public multi-restaurant Uber Eats production integration covering income, menu publishing, and availability controls.
  - Invariants confirmed: no single-merchant shortcuts; auth model and approved API surface must be locked before code changes; production readiness cannot rely on the current generic Uber adapter.
  - Validation controls confirmed: planning-only slice; no runtime code changed.
- Baseline audit findings captured in this plan:
  - current Uber implementation is a generic income adapter, not a production Uber Marketplace integration
  - current sync path assumes a configurable JSON events endpoint instead of Uber's documented reporting workflow
  - current webhook route only verifies and timestamps, without operational event ingestion
  - current connection model does not yet represent the full store-provisioning lifecycle required for a public multi-restaurant app
- Immediate next execution target:
  - `UEP-00-c` to lock the exact production auth and approved API surface before any schema or runtime refactor starts
