# Responsive Layout System and Page Matrix

Status: completed execution tracker  
Created: 2026-03-03  
Last Updated: 2026-03-03  
Primary Purpose: define and track a maintainable responsive system for Mobile, iPad, and Desktop across all primary routes.

## Compressed Invariant Block (Read First Every Session)

- Mobile UX must remain fully functional while adding tablet/desktop layouts.
- Shared shell and shared layout primitives take priority over route-level media hacks.
- Layout changes are presentation-first; business logic and data flow must not change.
- Touch targets stay >= 44px across breakpoints.
- Each completed checklist step should include a validation pass and doc sync.

## How To Use This File

1. Start each session by reading:
   - `## Last Left Off Here`
   - `## Canonical Order Checklist`
2. Claim one or two adjacent checklist items.
3. Implement only scoped responsive/layout changes.
4. Run viewport and lint/type validation for touched routes.
5. Update checklist status, completion snapshot, and latest job summary.

## Last Left Off Here

- Current task ID: `RL-03-c`
- Current task: `Final responsive consistency pass and checklist closeout`
- Status: `COMPLETED`
- Last updated: `2026-03-03`
- Note: `RL-00` through `RL-03` are now complete in code and validated.

## Canonical Order Checklist

Status legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` completed
- `[!]` blocked

### Phase RL-00 - Foundation Shell and Shared Primitives

- [x] RL-00-a: Refactor dashboard shell to remove global phone-width cap and support md+/xl layout rails.
- [x] RL-00-b: Make bottom nav mobile-only (`md:hidden`).
- [x] RL-00-c: Add md+/xl dashboard side navigation rail.
- [x] RL-00-d: Introduce shared page container variants (`narrow`, `standard`, `wide`, `full`).
- [x] RL-00-e: Update md+ page-header container width behavior to align with new shell.

### Phase RL-01 - High-Impact Workspaces

- [x] RL-01-a: `/shopping` responsive workspace migration (mobile fixed commit card + md+ sidebar commit rail).
- [x] RL-01-b: `/shopping/orders` responsive list migration.
- [x] RL-01-c: `/shopping/orders/[id]` responsive detail migration.
- [x] RL-01-d: `/receive/receipt` + `/receive/receipt/[id]` responsive workspace migration.
- [x] RL-01-e: `/service/host` responsive split layout migration.
- [x] RL-01-f: `/service/kitchen` responsive queue-grid migration.
- [x] RL-01-g: `/documents/[draftId]` responsive review workspace migration.

### Phase RL-02 - List, Detail, and Analytics Routes

- [x] RL-02-a: `/inventory` + `/inventory/[id]` responsive migration.
- [x] RL-02-b: `/contacts` responsive split/editor migration.
- [x] RL-02-c: `/documents` + `/documents/analytics` responsive migration.
- [x] RL-02-d: `/integrations` responsive grouped-grid migration.
- [x] RL-02-e: `/schedule` + `/reports` responsive analytics/calendar migration.
- [x] RL-02-f: `/profile` + `/staff` responsive refinements.

### Phase RL-03 - Non-Dashboard Polish and Consistency

- [x] RL-03-a: `/auth/*` and `/onboarding/*` responsive tuning.
- [x] RL-03-b: `/r/[publicSlug]`, `/privacy`, `/terms`, and public `/` responsive cleanup.
- [x] RL-03-c: Remove remaining ad-hoc route wrappers and standardize spacing/sticky/empty-state patterns.

## Completion Percentage (Update Every Slice)

Current snapshot (2026-03-03):

- Checklist items total: `21`
- Checklist `[x]`: `21`
- Checklist `[~]`: `0`
- Strict completion: `100.00%`
- Weighted progress: `100.00%`

## Executive Summary

The codebase started strongly mobile-first, with dashboard routes hard-capped to phone width. The current strategy is:

1. Keep one shared responsive shell for dashboard routes.
2. Standardize page container variants (`narrow`, `standard`, `wide`, `full`).
3. Migrate by page archetype/workspace impact, not one-off CSS.
4. Preserve mobile behavior while progressively unlocking iPad and desktop productivity layouts.

## Review Findings Status (Ordered by Severity)

### High

1. [x] Dashboard width was globally constrained to phone width.
   - Implemented in `app/(dashboard)/layout.tsx` (removed `max-w-lg` dashboard shell cap).

2. [x] Bottom nav was always fixed/mobile-sized at all breakpoints.
   - Implemented in `components/nav/bottom-nav.tsx` (`md:hidden`).

3. [x] Shopping used fixed mobile offsets that collided on larger layouts.
   - Implemented in `app/(dashboard)/shopping/page.tsx` (md+ sidebar commit rail; fixed commit card now mobile-only).

### Medium

4. [x] Inconsistent host/kitchen wrappers reduced predictability.
   - Implemented via shared container usage and responsive host/kitchen workspace structure.

5. [x] Desktop header was constrained with `max-w-lg`.
   - Implemented in `components/nav/page-header.tsx` (md+/xl width expansion).

6. [x] Many routes remained single-column with minimal breakpoint behavior.
   - Resolved via responsive route-client migrations across receive, documents, inventory, contacts, integrations, schedule, reports, staff, and profile.

### Low

7. [x] Schedule defaults were not adaptive for smaller screens.
   - Resolved in `src/features/schedule/ui/ScheduleClient.tsx` (mobile day-view default, desktop diagnostics rail layout).

## Responsive System (Recommended)

## 1) Breakpoint Contract

Use current Tailwind defaults and treat them as product device buckets:

- Mobile: `< md` (phones)
- iPad / Tablet: `md` to `< xl` (portrait + landscape tablets)
- Desktop: `xl+`

Product rules:

- Mobile-first remains default.
- iPad introduces split panes and wider grids.
- Desktop introduces workspace rails and multi-pane productivity layouts.

## 2) Shared Shell Architecture

Create one dashboard shell that supports 3 modes without per-page hacks:

- Mobile:
  - full-width content stack
  - bottom nav visible
- iPad:
  - left icon rail + content canvas
  - bottom nav hidden
- Desktop:
  - left expanded nav + main content + optional right context panel
  - bottom nav hidden

## 3) Container Variants (Per Page)

Define reusable page container variants:

- `narrow`: forms/settings/legal (`max-w-2xl`)
- `standard`: most list/detail pages (`max-w-4xl`)
- `wide`: operational pages (`max-w-6xl`)
- `full`: dense workspaces and data grids (fill available main canvas)

Each route selects a variant instead of hardcoding one-off `max-w-*`.

## 4) Page Archetypes (For Efficient Rollout)

- Workflow pages:
  - command-style steps, sticky actions, scanners/uploads
- List pages:
  - filters + cards/tables + quick actions
- Detail pages:
  - entity summary + metadata + history panels
- Analytics pages:
  - cards/charts with responsive multi-column grids
- Settings pages:
  - profile/preferences/forms

Build shared wrappers for archetypes to avoid repeated breakpoint logic.

## Page Layout Matrix (Best Layout by Route)

### Dashboard Routes

1. `/` (Home)
   - Mobile: current stacked hero + activity list.
   - iPad: 2-column (`hero/summary` left, `activity` right).
   - Desktop: 3-panel (`hero KPIs`, `activity`, `quick actions/integrations`).

2. `/staff`
   - Mobile: invite form then lists.
   - iPad: split (`invite` left, `invites/team` right).
   - Desktop: 3 columns (`invite`, `pending`, `team`).

3. `/intake`
   - Mobile: stacked intent cards.
   - iPad: 2-column intent grid.
   - Desktop: 3-column intent grid + optional recent activity rail.

4. `/receive`
   - Mobile: stacked method cards.
   - iPad: 2x2 method grid.
   - Desktop: 2x2 method grid + recent receipts side card.

5. `/receive/barcode`
   - Mobile: single-column scan -> form flow.
   - iPad: 2-pane (`scanner` + `item/quantity`).
   - Desktop: 3-pane (`scanner`, `form`, `recent scans`).

6. `/receive/photo`
   - Mobile: capture + parse flow stack.
   - iPad: 2-pane (`capture/ocr` + `matches/form`).
   - Desktop: 3-pane with persistent preview/metadata.

7. `/receive/manual`
   - Mobile: search then form stack.
   - iPad: `search list` + `entry form` split.
   - Desktop: wider split with sticky form actions.

8. `/receive/receipt`
   - Mobile: step flow with sticky finalize.
   - iPad: 2-column (`line items` + `produce checklist/actions`).
   - Desktop: 3-column (`receipt source`, `line item review`, `commit sidebar`).

9. `/receive/receipt/[id]`
   - Mobile: digital/photo tab.
   - iPad: side-by-side photo + digital receipt.
   - Desktop: main receipt view + metadata/status side panel.

10. `/shopping`
    - Mobile: existing flow + bottom commit card.
    - iPad: 2-column workspace (`scan/basket` + `reconciliation/receipt`).
    - Desktop: 3-column command center (`session+scan`, `basket`, `pairing+checkout`).

11. `/shopping/orders`
    - Mobile: card list.
    - iPad: 2-column cards.
    - Desktop: table/list with quick actions.

12. `/shopping/orders/[id]`
    - Mobile: stacked summary -> receipt -> items.
    - iPad: `summary/receipt` + `items` split.
    - Desktop: `summary`, `receipt`, `items` multi-pane.

13. `/inventory`
    - Mobile: list/grid toggle as is.
    - iPad: 3-column grid mode and richer filter row.
    - Desktop: 4-5 column grid + Fix Later queue side rail.

14. `/inventory/[id]`
    - Mobile: stacked cards.
    - iPad: 2-column (`item details` + `transaction history`).
    - Desktop: 2-column with denser transaction table.

15. `/contacts`
    - Mobile: stacked list + modal-like editing.
    - iPad: split (`contact list` + `editor`).
    - Desktop: wider split with persistent editor panel.

16. `/documents`
    - Mobile: filter chips + cards.
    - iPad: list with richer metadata rows.
    - Desktop: table-like inbox + filter toolbar + side quick preview.

17. `/documents/[draftId]`
    - Mobile: stacked sections.
    - iPad: 2-column (`draft core` + `vendor/trust`).
    - Desktop: 3-column review workspace (`source`, `parsed/mapping`, `actions/trust`).

18. `/documents/analytics`
    - Mobile: stacked cards/charts.
    - iPad: 2-column chart grid.
    - Desktop: dashboard grid (`vendor spend`, `trend`, `tax`, `cogs`, `reorder`).

19. `/integrations`
    - Mobile: grouped provider lists.
    - iPad: 2-column group layout.
    - Desktop: 3-column grouped providers.

20. `/schedule`
    - Mobile: default to Day view; Week/Month optional.
    - iPad: default Week view.
    - Desktop: Week view + right-side agenda/diagnostics.

21. `/reports`
    - Mobile: stacked summary cards.
    - iPad: 2-column analytics cards.
    - Desktop: 3-column analytics dashboard.

22. `/profile`
    - Mobile: current stacked settings.
    - iPad: 2-column (`profile card` + `settings groups`).
    - Desktop: settings page with grouped sections and sticky account summary.

23. `/service/tables`
    - Mobile: stacked table cards.
    - iPad: table list + QR/actions panel split.
    - Desktop: 2-pane management layout.

24. `/service/menu`
    - Mobile: stacked forms/lists.
    - iPad: split (`category/item forms` + `lists`).
    - Desktop: 3-pane (`category`, `item`, `CSV/import + preview`).

25. `/service/host`
    - Mobile: stacked order composer.
    - iPad: split (`draft composer` + `ticket summary`).
    - Desktop: wide host console with sticky action rail.

26. `/service/kitchen`
    - Mobile: queue cards list.
    - iPad: denser queue cards with two-column card internals.
    - Desktop: board-style grouped lanes by status (optional) or wide dense queue list.

### Non-Dashboard Routes

1. `/auth/login`, `/auth/signup`, `/auth/accept-invite`
   - Mobile: centered card.
   - iPad: centered card with wider width.
   - Desktop: split hero + form card.

2. `/onboarding/income-sources/[step]`
   - Mobile: current guided flow.
   - iPad: wider card deck with sticky action bar.
   - Desktop: split (`step context` + `provider cards`).

3. `/r/[publicSlug]`
   - Mobile: stacked menu cards.
   - iPad: 2-column category layout.
   - Desktop: 3-column menu/sections with sticky top summary.

4. `/privacy`, `/terms`
   - Mobile: reading layout.
   - iPad/Desktop: keep readable center column, slightly wider max.

5. `/` public marketing
   - Already reasonably adaptive; keep and tune spacing.

## Latest Job Summary

### 2026-03-03 - RL-01 through RL-03 completed and checklist closed

- Completed high-impact workspace closeout:
  - `app/(dashboard)/shopping/orders/page.tsx`
  - `app/(dashboard)/shopping/orders/[id]/page.tsx`
  - `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx`
  - `src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx`
  - `src/features/documents/ui/DocumentDraftDetailClient.tsx`
- Completed list/detail/analytics responsive migrations:
  - `src/features/inventory/ui/InventoryListPageClient.tsx`
  - `src/features/inventory/ui/InventoryDetailPageClient.tsx`
  - `src/features/contacts/ui/ContactsPageClient.tsx`
  - `src/features/documents/ui/DocumentInboxClient.tsx`
  - `src/features/documents/ui/DocumentAnalyticsClient.tsx`
  - `src/features/integrations/ui/IncomeConnectionsPageClient.tsx`
  - `src/features/schedule/ui/ScheduleClient.tsx`
  - `src/features/staff/ui/StaffPageClient.tsx`
  - `app/(dashboard)/profile/page.tsx`
- Completed non-dashboard consistency pass:
  - `app/auth/layout.tsx`
  - `src/features/integrations/ui/OnboardingConnectionsStep.tsx`
  - `app/r/[publicSlug]/page.tsx`
  - `src/features/home/ui/HomeDashboardClient.tsx`
- Validation completed:
  - `npx eslint` on all touched responsive route/client files -> pass
  - `npx tsc --noEmit` -> pass
- Next task ID: `N/A (responsive matrix complete)`

### 2026-03-03 - RL-00 completed and RL-01 partially completed

- Completed foundation shell and navigation work:
  - `app/(dashboard)/layout.tsx`
  - `components/nav/bottom-nav.tsx`
  - `components/nav/dashboard-side-nav.tsx`
  - `components/layout/dashboard-page-container.tsx`
  - `components/nav/page-header.tsx`
- Completed high-impact workspace updates:
  - `app/(dashboard)/shopping/page.tsx`
  - `app/(dashboard)/service/host/page.tsx`
  - `src/features/table-service/ui/HostOrderComposerPageClient.tsx`
  - `src/features/table-service/ui/KitchenQueuePageClient.tsx`
- Validation completed:
  - `npx eslint` on touched files -> pass
  - `npx tsc --noEmit` -> pass
- Next task ID at that time: `RL-01-b`

## Guardrails

1. Do not break mobile UX while introducing larger breakpoints.
2. Keep touch targets >= 44px on all devices.
3. Prefer shared layout primitives over per-page custom media hacks.
4. Preserve existing business logic; layout changes should be presentation-first.

## Validation Strategy

For each migrated route:

1. Validate at `390x844` (mobile), `820x1180` (iPad portrait), `1366x768` (desktop).
2. Confirm:
   - no horizontal overflow
   - sticky bars do not obscure actionable controls
   - keyboard/focus flow remains usable
3. Run targeted lint and route smoke checks.
4. Add/update Playwright visual regression snapshots for key routes.

## Concrete First Refactor Targets (Status)

- [x] `app/(dashboard)/layout.tsx`
- [x] `components/nav/bottom-nav.tsx`
- [x] `components/nav/page-header.tsx`
- [x] `app/(dashboard)/shopping/page.tsx`
- [x] `src/features/table-service/ui/KitchenQueuePageClient.tsx`
- [x] `src/features/table-service/ui/HostOrderComposerPageClient.tsx`

These first targets are complete and unlocked the shared responsive foundation plus the first high-impact workspace migrations.
