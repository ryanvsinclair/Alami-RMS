# Responsive Layout System and Page Matrix

Status: active reference  
Created: 2026-03-03  
Last Updated: 2026-03-03  
Primary Purpose: define an efficient, maintainable responsive system for Mobile, iPad, and Desktop across all pages.

## Executive Summary

The codebase is strongly mobile-first, but the current dashboard shell hard-caps almost all authenticated pages to phone width. The most efficient path is:

1. Introduce one shared responsive shell for dashboard routes.
2. Standardize page container variants (`narrow`, `standard`, `wide`, `full`).
3. Migrate pages by archetype (workflow, list, detail, analytics, settings), not one-off CSS edits.
4. Keep mobile UX intact while adding iPad and desktop layouts progressively.

## Review Findings (Ordered by Severity)

### High

1. Dashboard width is globally constrained to phone width.
   - `app/(dashboard)/layout.tsx` uses `max-w-lg`, forcing mobile-width rendering on larger viewports.

2. Bottom nav is always fixed and mobile-sized, with no tablet/desktop navigation mode.
   - `components/nav/bottom-nav.tsx` renders fixed bottom nav at all breakpoints and constrains nav frame to `max-w-lg`.

3. Several flows use fixed mobile offsets that will collide on larger layouts.
   - `app/(dashboard)/shopping/page.tsx` uses `pb-44`, fixed summary bar at `bottom-24`, and `max-w-lg` inside fixed area.

### Medium

4. Inconsistent local width wrappers reduce predictability.
   - Example: `app/(dashboard)/service/host/page.tsx` (`max-w-3xl`) and kitchen client (`max-w-4xl`) while parent shell is still `max-w-lg`.

5. Desktop header component is not a real desktop shell.
   - `components/nav/page-header.tsx` is `hidden md:block` but still constrained with `max-w-lg` and not integrated globally.

6. Many pages are single-column with minimal breakpoint behavior.
   - Multiple feature clients use `p-4` stacks with no `md/lg` layout strategy.

### Low

7. Schedule defaults are not adaptive for smaller screens.
   - Week/month 7-column views remain dense on small devices.

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

Implementation target:

- Refactor `app/(dashboard)/layout.tsx` to remove `max-w-lg` shell cap.
- Update `components/nav/bottom-nav.tsx` to `md:hidden`.
- Add md+ nav rail component (new).

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

## Implementation Plan (Efficient Rollout)

### Phase 1: Foundation (shared shell + nav)

1. Refactor dashboard shell to responsive grid/rails.
2. Make bottom nav mobile-only.
3. Add md+ side navigation rail.
4. Introduce page container variants.

### Phase 2: High-impact workspaces

1. Shopping pages.
2. Receipt receive + detail.
3. Service host + kitchen.
4. Documents draft detail.

### Phase 3: List/detail and analytics pages

1. Inventory, contacts, documents inbox, integrations.
2. Schedule + reports.
3. Profile and staff refinements.

### Phase 4: Polish + consistency

1. Auth/onboarding/public menu responsive tuning.
2. Standardize spacing, sticky actions, and empty states.
3. Remove ad-hoc route-level width wrappers replaced by container variants.

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

## Concrete First Refactor Targets

Start with these files for maximum leverage:

1. `app/(dashboard)/layout.tsx`
2. `components/nav/bottom-nav.tsx`
3. `components/nav/page-header.tsx` (or replace with md+ shell header)
4. `app/(dashboard)/shopping/page.tsx`
5. `src/features/table-service/ui/KitchenQueuePageClient.tsx`
6. `src/features/table-service/ui/HostOrderComposerPageClient.tsx`

These changes unlock responsive behavior across most of the authenticated app with the least duplicated effort.
