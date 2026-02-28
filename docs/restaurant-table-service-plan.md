# Restaurant Table QR + Host/Kitchen Ops Plan (Restaurant-Only V1)

Status: COMPLETE - RTS-00 through RTS-05 complete
Created: 2026-02-28
Last Updated: 2026-02-28
Primary Purpose: launch restaurant table service with QR routing, host order confirmation, and kitchen queue operations.

## Compressed Invariant Block (Always In Scope)

- Restaurant-only launch target for this plan.
- No guest checkout/payment scope in V1.
- No forced login on QR scan route.
- Logged-in member scan -> host flow; otherwise -> public diner landing.
- Host confirmation creates kitchen-visible order immediately.
- 30-minute timer starts at order confirmation.
- Queue remains FIFO by confirmation time; overdue affects urgency styling only.
- One active `TableSession` per `DiningTable` at a time.
- One `KitchenOrder` per `TableSession`; post-confirm edits append `KitchenOrderItem` rows to the same order.
- Orders collapse from kitchen queue when all items are `served`/`cancelled`, but remain open until host marks done/paid.
- Temporary Host/Kitchen profile mode is a launch bridge and must be refactored when formal roles are introduced.
- Any UI-touching tasks in this plan must follow `docs/execution-constitution.md` UI and UX rules.

Constitution source: `docs/execution-constitution.md`

## Latest Update

- **2026-02-28 - RTS-05-d completed (launch smoke coverage for QR/host/kitchen loop).**
  - Added launch smoke test suite at `src/features/table-service/shared/table-service.launch-smoke.test.ts`.
  - Smoke coverage includes route presence, queue lifecycle collapse/resurface contract, timer window contract, and mode-toggle/redirect wiring checks.
  - Executed with: `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts src/features/table-service/shared/table-service.launch-smoke.test.ts`.
  - RTS source checklist is now fully complete.

- **2026-02-28 - RTS-05-c completed (temporary-mode note explicitly present).**
  - Verified explicit temporary-note text is present in profile mode toggle UI:
    "This launch toggle is temporary and will be replaced by role-based access in a future refactor."
  - No additional runtime code required beyond RTS-05-a implementation.
  - Source and master trackers updated to mark this contractual documentation/control requirement complete.

- **2026-02-28 - RTS-05-b completed (Kitchen mode redirect from `/` to `/service/kitchen`).**
  - Home route now checks table-service workspace mode preference from local storage.
  - For restaurant businesses with `table_service` enabled and mode `kitchen`, `/` redirects to `/service/kitchen`.
  - Redirect preserves module/industry gating and does not alter home data fetch contracts.

- **2026-02-28 - RTS-05-a completed (profile Host/Kitchen mode toggle).**
  - Added profile toggle card for table-service workspace mode (`Host` / `Kitchen`).
  - Persisted mode selection in local storage via shared table-service workspace-mode constants.
  - Toggle is shown only for restaurant businesses with `table_service` enabled.
  - Added explicit temporary note in toggle UI that role-based refactor will replace this launch control.

- **2026-02-28 - RTS-04-f completed (overdue visual urgency without queue reorder).**
  - Kitchen queue cards now surface overdue urgency label (`Xm overdue`) when `due_at` is past.
  - Added overdue visual treatment on queue cards using existing danger tokens only.
  - Preserved FIFO queue ordering by `confirmed_at`; no urgency-based reordering was introduced.

- **2026-02-28 - RTS-04-g completed (host done/paid closes order + table session).**
  - Added close service/action path to set `KitchenOrder.closed_at` and `TableSession.closed_at` together.
  - Added host `Done/Paid` control to close active order/session from host workspace.
  - Host workspace now reflects closed-order state and blocks post-close append/edit operations.
  - Confirmed source `RTS-04-d` re-surface and `RTS-04-e` served-immutability are satisfied by existing terminal-collapse + append-only behavior.

- **2026-02-28 - RTS-04-c completed (queue collapse on terminal-only items).**
  - Kitchen queue read path now hides orders where all items are terminal (`served`/`cancelled`).
  - Orders remain open in storage (`kitchen_orders.closed_at` unchanged) while collapsed from visible queue.
  - Queue visibility now derives from presence of at least one non-terminal item.
  - This preserves re-surface behavior when append adds new non-terminal items in follow-on scope.

- **2026-02-28 - RTS-04-b completed (kitchen item status lifecycle controls).**
  - Added status update service/action path for `KitchenOrderItem.status`.
  - Kitchen queue now supports per-item status changes across canonical lifecycle values:
    `pending`, `preparing`, `ready_to_serve`, `served`, `cancelled`.
  - Converted kitchen queue to client-driven refresh flow for immediate status updates.
  - Preserved open-order FIFO ordering behavior from `RTS-04-a`.

- **2026-02-28 - RTS-04-a completed (FIFO kitchen queue rendering by confirmation time).**
  - Added module-gated kitchen route at `app/(dashboard)/service/kitchen/page.tsx`.
  - Added queue read service that returns confirmed, open orders sorted by `confirmed_at ASC` (FIFO).
  - Kitchen queue surface now renders table/session ticket cards in queue-order sequence with item/status visibility.
  - Added host workspace link to kitchen queue for cross-workspace navigation.

- **2026-02-28 - RTS-03-d completed (post-confirm edits append to same order).**
  - Added append service path to write new `KitchenOrderItem` rows onto existing active `KitchenOrder`.
  - Added host post-confirm append action so additional draft lines are appended to the same kitchen ticket.
  - Preserved one-order-per-session invariant and did not introduce amendment table behavior.
  - Host ticket panel now shows recent appended item lines with status visibility.

- **2026-02-28 - RTS-03-c completed (confirmation timestamp + 30-minute due timer).**
  - Confirmation flow now sets `KitchenOrder.confirmed_at` at confirm action time.
  - Confirmation flow now sets `KitchenOrder.due_at = confirmed_at + 30 minutes`.
  - Existing session ticket fallback now backfills missing `confirmed_at`/`due_at` if older rows exist without timer fields.
  - Host ticket panel now surfaces `confirmed_at` and `due_at` values.

- **2026-02-28 - RTS-03-b completed (confirm creates kitchen ticket immediately).**
  - Added server-side order confirmation flow that creates `KitchenOrder` plus `KitchenOrderItem` rows in one transaction.
  - Enforced business/session/menu validation at confirmation time (active table session + business-scoped available menu items).
  - Enabled host workspace confirm action to create ticket immediately and display created ticket state.
  - Preserved timer fields for follow-on `RTS-03-c` scope and append behavior for `RTS-03-d`.

- **2026-02-28 - RTS-03-a completed (host table order composer draft UI).**
  - Replaced host placeholder surface with table/session-aware order composer at `app/(dashboard)/service/host/page.tsx`.
  - Added `HostOrderComposerPageClient` with menu-item line drafting (item selection, quantity, per-line notes), editable/removable lines, and subtotal summary.
  - Wired host workspace to available menu items only (`isAvailable=true`) while preserving module and tenant guard path.
  - Reserved order confirmation action as disabled CTA for `RTS-03-b` implementation scope.

- **2026-02-28 - RTS-02-d/e/f completed (review CTA gating + public-scan constraints).**
  - Added public landing review CTA and gated it to businesses with `google_place_id` only.
  - Confirmed public scan flow does not force login before landing resolution.
  - Confirmed guest path has no ordering/session-join affordances in V1 baseline.

- **2026-02-28 - RTS-02-c completed (`/r/[publicSlug]` menu-first diner landing baseline).**
  - Expanded public landing route `app/r/[publicSlug]/page.tsx` to menu-first rendering.
  - Added category-grouped menu output with uncategorized fallback section.
  - Added availability filter (`is_available=true`) for diner-visible menu items.

- **2026-02-28 - RTS-02-b completed (session-aware scan branching baseline).**
  - Updated `/scan/t/[token]` route to branch by membership context:
    - authenticated business member -> host workspace path (`/service/host?...`) with active session open/create
    - non-member/guest -> public landing path (`/r/[publicSlug]`)
  - Added host workspace baseline route at `app/(dashboard)/service/host/page.tsx`.
  - Added placeholder public landing route at `app/r/[publicSlug]/page.tsx` for non-member scan path continuity.

- **2026-02-28 - RTS-02-a completed (`/scan/t/[token]` resolver baseline).**
  - Added public scan resolver route at `app/scan/t/[token]/page.tsx`.
  - Added server resolver `resolveDiningTableByQrToken(...)` on table-service server layer.
  - Resolver now maps static `DiningTable.qr_token` to table + business context and returns 404 for unknown tokens.

- **2026-02-28 - RTS-01-c/d/e completed (dining-table CRUD + static scan-token generation).**
  - Added module-gated route `/service/tables` for dining-table setup operations.
  - Implemented business-scoped dining-table CRUD (`create`, `update`, `delete`).
  - Added static scan token generation and regeneration (`DiningTable.qr_token`) for `/scan/t/[token]` pathing.
  - Added copyable static scan URL output for each configured table.
  - Confirmed menu availability toggle (`is_available`) is active in setup workflows.

- **2026-02-28 - RTS-01-a/b completed (manual menu CRUD + CSV import).**
  - Added table-service module-gated route `/service/menu` with setup UI for category/item management.
  - Implemented business-scoped manual menu category/item CRUD actions and service layer.
  - Added CSV parser + import flow for menu items (header-based mapping with row-level validation).
  - Added import upsert behavior by item name + category and import result reporting (`created`, `updated`, `skipped`, errors).

- **2026-02-28 - RTS-00-c completed (shared contract baseline + phase closeout).**
  - Added canonical shared contracts at `src/features/table-service/shared/table-service.contracts.ts` for menu/table/session/order flows.
  - Locked one-order-per-session and same-order append invariants in shared contract constants.
  - Added contract invariant test `src/features/table-service/shared/table-service.contracts.test.ts`.
  - Completed RTS-00-d tenant/authorization boundary validation via module/industry guard baseline from `RTS-00-b`.

- **2026-02-28 - RTS-00-b completed (table_service module registration + guard baseline).**
  - Registered `table_service` in shared module registry (`MODULE_REGISTRY`) with dedicated module definition.
  - Added restaurant provisioning defaults so new restaurant businesses enable `table_service` at creation.
  - Added `requireTableServiceAccess()` guard helper to enforce restaurant-industry and module-enabled access.
  - Applied additive migration `20260228130000_table_service_module_backfill` to enable `table_service` for existing restaurant businesses.

- **2026-02-28 - RTS-00-a completed (table-service schema baseline + additive migration).**
  - Added Prisma enum `KitchenOrderItemStatus` and models `DiningTable`, `MenuCategory`, `MenuItem`, `TableSession`, `KitchenOrder`, `KitchenOrderItem`.
  - Added required constraints/indexes, including per-business table uniqueness and one-order-per-session (`kitchen_orders.table_session_id` unique).
  - Added DB-level partial unique index for one active session per table (`table_sessions_dining_table_id_active_key` where `closed_at IS NULL`).
  - Applied additive migration `20260228123000_rts00_table_service_schema` and regenerated Prisma client.

- **2026-02-28 - RTS schema and lifecycle decisions locked.**
  - Added authoritative RTS schema decisions for `DiningTable`, `MenuCategory`, `MenuItem`, `TableSession`, `KitchenOrder`, and `KitchenOrderItem`.
  - Replaced amendment-ticket assumption with same-order item append behavior.
  - Updated queue/session lifecycle to collapse-on-terminal-items and host-controlled close (`done/paid`).

- **2026-02-28 - UI and UX constitution linkage added.**
  - Added explicit UI-governance requirement for any UI-touching tasks in this plan.

- **2026-02-28 - Execution format normalized.**
  - Converted this plan to explicit in-progress/checklist phase format.
  - Added status ledger, `Pick Up Here`, mandatory restatement, and expanded validation gate.

## Pick Up Here

- Current phase: `RTS-05`
- Current task: `COMPLETE`
- Status: `[x]` completed

## Scope

In scope for V1:

- menu management (manual + CSV import)
- unique static QR per table
- session-aware QR branching
- host-confirmed order -> kitchen ticket creation
- kitchen queue with item actions (`pending`, `preparing`, `ready_to_serve`, `served`, `cancelled`)
- 30-minute visual healthy-time timer
- profile Host/Kitchen mode toggle + kitchen home redirect

Out of scope for V1:

- guest ordering payment flows
- guest session joining flows
- kiosk PIN mode
- full role/permission matrix redesign

## Temporary Access Model (Explicit)

- Profile mode toggle (`Host` / `Kitchen`) controls workflow emphasis.
- Kitchen mode auto-redirects restaurant users from `/` to `/service/kitchen`.
- Explicit future refactor note must remain visible in code/docs: this is workflow preference, not long-term authorization.

## QR Routing Model

Entry route: `/scan/t/[token]`

Rules:

- resolve token from `DiningTable.qr_token` to dining table + business context
- if requester is authenticated and a member of that business, route to host table workspace (open active session or start a new session)
- otherwise route to public diner landing: `/r/[publicSlug]` with digital menu + optional Google Reviews CTA
- never force login in this scan flow
- no guest ordering and no guest session joining in V1

## RTS Schema Decision Lock (Resolved)

This section is authoritative for RTS V1 Prisma modeling.

### A) DiningTable

- Primary identifier: `table_number` (required).
- Constraint: unique per business (`@@unique([business_id, table_number])`).
- QR token storage: `qr_token` on `DiningTable` (required, globally unique).
- No `capacity` field in V1.
- No sections/zones in V1.
- Model table anchors as logical identifiers (not fixed seating geometry).

### B) MenuCategory and MenuItem

- `MenuCategory` is per business.
- Supports seeded defaults (e.g. Entrees/Appetizers/Drinks) plus custom categories.
- `MenuItem` has optional `description` (`String?`).
- `MenuItem` has availability toggle `is_available` (86 support).
- V1 does not link `MenuItem` directly to `InventoryItem` for auto-deduct.

### C) TableSession

- Includes `party_size`.
- Constraint: one active session per table at a time (partial unique index at DB layer).

### D) KitchenOrder

- Exactly one `KitchenOrder` per `TableSession` (`table_session_id` unique).
- Includes order-level `notes`.
- No separate amendment table in V1.
- Post-confirm edits append `KitchenOrderItem` rows to existing order.
- Lifecycle:
  - if all items are `served` or `cancelled`, order collapses in queue but remains open.
  - adding new items later makes order reappear in queue.
  - previously served items stay served.
  - host action `done/paid` closes order and closes session.

### E) KitchenOrderItem

- Includes item-level `notes`.
- Status enum values:
  - `pending`
  - `preparing`
  - `ready_to_serve`
  - `served`
  - `cancelled`

### F) QR Token Behavior

- Token is static per table and stored directly on `DiningTable.qr_token`.
- Dual-path resolver:
  - logged-in business member -> host/table management flow.
  - guest or non-member -> public restaurant landing (`/r/[publicSlug]`).
- No guest ordering in V1.

## Phase Status Ledger

- `RTS-00`: `[x]` completed
- `RTS-01`: `[x]` completed
- `RTS-02`: `[x]` completed
- `RTS-03`: `[x]` completed
- `RTS-04`: `[x]` completed
- `RTS-05`: `[x]` completed

## Mandatory Restatement Before Phase Work

Before starting any checklist item in this plan:

- [ ] Paste `Constitution Restatement` template from `docs/execution-constitution.md` into session/job summary.
- [ ] Confirm scope sentence references exact `RTS-*` task ID.

## RTS-00 - Schema, module, and contracts baseline

**Status:** `[x]` completed

- [x] RTS-00-0: Constitution restatement logged for this phase and no deviation required.
- [x] RTS-00-a: Add table-service models/enums and required indexes per decision lock (`DiningTable`, `MenuCategory`, `MenuItem`, `TableSession`, `KitchenOrder`, `KitchenOrderItem`).
- [x] RTS-00-b: Add `table_service` module registration and guards.
- [x] RTS-00-c: Add shared contracts for menu/table/session/order flows (including one-order-per-session and same-order item append behavior).
- [x] RTS-00-d: Validate tenant scoping and authorization boundaries in contract layer.

## RTS-01 - Menu and table setup surfaces

**Status:** `[x]` completed

- [x] RTS-01-0: Constitution restatement logged for this phase and no deviation required.
- [x] RTS-01-a: Implement menu CRUD (manual) with business-scoped `MenuCategory` (seeded + custom).
- [x] RTS-01-b: Add CSV import for menu items.
- [x] RTS-01-c: Implement dining-table CRUD.
- [x] RTS-01-d: Generate and persist static `DiningTable.qr_token` per table.
- [x] RTS-01-e: Add menu item `is_available` (86) toggle to setup/workspace surfaces.

## RTS-02 - QR router and diner landing

**Status:** `[x]` completed

- [x] RTS-02-0: Constitution restatement logged for this phase and no deviation required.
- [x] RTS-02-a: Implement `/scan/t/[token]` resolver.
- [x] RTS-02-b: Implement session-aware branch (member -> host open/start session; otherwise public).
- [x] RTS-02-c: Implement `/r/[publicSlug]` diner landing with menu-first UX.
- [x] RTS-02-d: Show review CTA only when `google_place_id` exists.
- [x] RTS-02-e: Ensure no login page is shown from public scan flow.
- [x] RTS-02-f: Enforce no guest ordering/session joining for public scanner path.

## RTS-03 - Host order confirmation flow

**Status:** `[x]` completed

- [x] RTS-03-0: Constitution restatement logged for this phase and no deviation required.
- [x] RTS-03-a: Build host table order composer (items, qty, notes).
- [x] RTS-03-b: Confirm order -> create kitchen ticket immediately.
- [x] RTS-03-c: Set `confirmed_at` and `due_at = confirmed_at + 30 minutes`.
- [x] RTS-03-d: Route post-confirm edits to append new `KitchenOrderItem` rows on same `KitchenOrder` (no amendment table in V1).

## RTS-04 - Kitchen queue operations

**Status:** `[x]` completed

- [x] RTS-04-0: Constitution restatement logged for this phase and no deviation required.
- [x] RTS-04-a: Render queue in FIFO order by confirmation timestamp.
- [x] RTS-04-b: Add item status/actions for `pending`, `preparing`, `ready_to_serve`, `served`, and `cancelled`.
- [x] RTS-04-c: Collapse order from visible queue when all items are terminal (`served`/`cancelled`) while keeping order open.
- [x] RTS-04-d: Re-surface collapsed order in queue when new items are appended post-confirm.
- [x] RTS-04-e: Keep already-served items immutable when new items are appended.
- [x] RTS-04-f: Overdue visual urgency without queue reordering.
- [x] RTS-04-g: Add explicit host close action (`done/paid`) that closes order and closes table session.

## RTS-05 - Profile mode toggle and launch hardening

**Status:** `[x]` completed

- [x] RTS-05-0: Constitution restatement logged for this phase and no deviation required.
- [x] RTS-05-a: Add Host/Kitchen mode toggle in profile.
- [x] RTS-05-b: In Kitchen mode, redirect `/` to `/service/kitchen`.
- [x] RTS-05-c: Add explicit note that this mode toggle is temporary until role model refactor.
- [x] RTS-05-d: Run launch smoke suite for QR split, host flow, kitchen flow, and queue lifecycle.

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

## Acceptance Criteria

- [ ] Table QR resolves to correct table and business.
- [ ] Logged-in member scan routes to host flow; non-member/guest routes to public landing.
- [ ] Host confirmation creates kitchen-visible order immediately.
- [ ] Kitchen can mark individual items with status lifecycle including `ready_to_serve`, `served`, and `cancelled`.
- [ ] Order collapses from queue when all items are terminal but does not auto-close.
- [ ] Adding items post-confirm reopens the same order in queue without resetting served items.
- [ ] Host `done/paid` closes order and table session.
- [ ] 30-minute timer visual states render correctly.
- [ ] Kitchen profile mode redirects to kitchen queue.
- [ ] Review CTA is shown only when place id exists.

## Dependencies and Alignment

- Depends on `docs/business-industry-packaging-refactor-plan.md` launch posture.
- Execution order is governed by `docs/master-plan-v2.md`.

## Documentation Sync Requirements

- [ ] Update this plan status/checklists.
- [ ] Update `docs/master-plan-v2.md` status/checklists.
- [ ] Append changelog entry with a single touched-files block.
- [ ] Update `docs/codebase-overview.md` when behavior/architecture changes.
- [ ] Create one scoped git commit per completed checklist step and record commit hash in changelog.
