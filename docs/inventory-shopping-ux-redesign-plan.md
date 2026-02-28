# Inventory & Shopping UX Redesign Plan

Last updated: February 28, 2026
Status: LAUNCH SLICE COMPLETE - UX launch primitive baseline/wiring done; UX-01 through UX-04 post-launch continuation
Constitution source: `docs/execution-constitution.md`

---

## Latest Update

- **2026-02-28 - UX-L-00-c completed (post-launch defer lock).**
  - Confirmed UX-01 and UX-02 are deferred for post-launch execution.
  - Confirmed full UX-03/UX-04 backlog remains post-launch scope as well.
  - Launch UX slice is complete with UX-00 primitives + targeted launch-surface wiring only.

- **2026-02-28 - UX-L-00-b completed (launch-surface primitive wiring).**
  - Wired UX-00 primitives into required launch surfaces only:
    - `src/features/inventory/ui/InventoryListPageClient.tsx` now uses `ItemImage`, `QuantityBadge`, `SortSelect`, `ViewModeToggle`, and `useInventoryView`.
    - `app/(dashboard)/shopping/page.tsx` basket rows now use `ItemImage` + `QuantityBadge`.
  - Updated shopping UI contracts to carry optional `inventory_item.image_url` metadata for item image rendering.
  - Kept full UX-01/UX-02 redesign scope deferred for post-launch.
  - Ran targeted eslint + `npx tsc --noEmit --incremental false`; pass.

- **2026-02-28 - UX-L-00-a completed (UX-00 primitive baseline).**
  - Added shared primitives:
    - `src/shared/ui/item-image.tsx`
    - `src/shared/ui/quantity-badge.tsx`
    - `src/shared/ui/view-mode-toggle.tsx`
    - `src/shared/ui/sort-select.tsx`
  - Added inventory view preference hook:
    - `src/features/inventory/ui/use-inventory-view.ts`
  - Confirmed data-layer prerequisite is already satisfied in current code:
    - inventory list projection resolves and returns `image_url` + source chain metadata
    - `InventoryLevel` shape includes image fields in the active list surface
  - Ran targeted eslint + `npx tsc --noEmit --incremental false`; pass.

- **2026-02-28 - Mandatory execution restatement gate added.**
  - Added explicit "Mandatory Restatement Before Phase Work" section.
  - Requires constitution restatement before starting any `UX-*` task.

- **2026-02-28 - Launch scope confirmation finalized.**
  - Restaurant launch UX slice is UX-00 shared primitives only.
  - UX-01 (inventory grid/list) and UX-02 (shopping basket redesign) are explicitly post-launch.

- **2026-02-28 - UI and UX constitution enforcement added.**
  - Added required constitution overlay for all UX tasks in this plan.
  - Added per-phase design restatement checklist steps (`UX-00-0` through `UX-04-0`).
  - Replaced conflicting styling guidance with token-governed minimal defaults.

- **2026-02-28 - Launch slicing applied from master plan v2.**
  - Launch-critical UX work is a targeted subset needed for restaurant launch flows.
  - Full redesign backlog remains planned for post-launch continuation.

- **2026-02-28 â€” Plan created (v1).** Full redesign plan authored covering inventory grid, shopping basket, and enrichment queue condensation.

---
 
## Pick Up Here

Launch path: complete for launch slice.

Then continue full UX backlog post-launch, starting at UX-01.

---

## UI and UX Constitution Overlay (Required)

All tasks in this plan must follow `docs/execution-constitution.md` (`UI and UX Design Constitution`).

Required constraints:

1. Structural UI only during refactor slices (no brand exploration).
2. No glow, no gradients, no glassmorphism, no decorative motion.
3. Homepage-defined color tokens only, plus grayscale and transparent variants.
4. No new ad-hoc hex values or random Tailwind accent colors.
5. Existing font stack only.
6. If uncertain, default to grayscale minimal system UI.
7. Do not redesign existing layout hierarchy in autonomous runs.

---

## Mandatory Restatement Before Phase Work

Before starting any checklist item in this plan:

- [ ] Paste `Constitution Restatement` template from `docs/execution-constitution.md` into session/job summary.
- [ ] Confirm scope sentence references exact `UX-*` task ID.
- [ ] Log design restatement for the active phase (`UX-00-0`, `UX-01-0`, `UX-02-0`, `UX-03-0`, `UX-04-0`).

---

## Commit Checkpoint (Required)

After each completed checklist step in this plan:

- [ ] Create one scoped git commit to this repository before moving to the next step.
- [ ] Include the `UX-*` task ID in the commit message.
- [ ] Record commit hash + title in job summary/changelog evidence.

---

## Vision

Replace the current vertical card stack UI with a dense, image-forward inventory grid and a clean shopping basket that mirrors the Uber Eats grocery experience â€” minimal chrome, maximum density, images as the primary identifier, quantity always visible. The system should feel like a professional tool used daily at speed, not a form.

---

## Design Principles

1. **Density over decoration.** Show more items per viewport. Every pixel counts on mobile.
2. **Image-first identity.** When an image exists, it IS the item. Text is secondary.
3. **Graceful no-image state.** Placeholder is designed, not an afterthought. Category icon or item initials.
4. **One-tap actions.** Quantity adjustment never requires navigating away in the shopping context.
5. **Unobtrusive intelligence.** The enrichment queue is always accessible but never in the way.
6. **View preference is remembered.** Grid vs list choice persists across sessions.

---

## What Changes

| Area | Before | After |
|---|---|---|
| Inventory list | Vertical card stack, text only | Grid (2-col) or compact list toggle |
| Enrichment queue | Expanded card at top of page | Condensed `!` badge button, opens drawer |
| Search | Top-of-page input | Sticky top bar: search + sort + view toggle |
| Sort/filter | None | Category tabs + sort dropdown (name, qty, last updated, low stock) |
| Shopping basket | Vertical cards, small text, status badges everywhere | Uber Eats cart row: image, name, qty stepper â€” clean |
| Item card (grid) | N/A | Square card: image fills top 2/3, name + qty below |
| Item row (list) | Card with padding, badges | Tight row: 40px, no card border, image thumbnail or dot, name, qty right-aligned |

---

## Architecture Placement

| Layer | Location |
|---|---|
| Shared UI primitives | `src/shared/ui/` |
| Inventory UI components | `src/features/inventory/ui/` |
| Shopping UI components | `src/features/shopping/ui/` |
| Inventory data layer update | `src/features/inventory/server/inventory.repository.ts` |
| View mode persistence hook | `src/features/inventory/ui/use-inventory-view.ts` |

---

## Phases

---

### UX-00 â€” Shared Primitives and Data Layer

**Goal:** Build the shared UI atoms needed by all subsequent phases. Update the inventory data layer to include `image_url` from the resolver chain (own â†’ barcode catalog â†’ null). Nothing renders differently yet â€” this is the foundation.

**Status:** `[x]` completed

**Prerequisite:** IMG-00 complete (so `image_url` exists on `InventoryItem` and `GlobalBarcodeCatalog`). Can proceed without IMG-02/IMG-03 enrichment runs â€” those just fill in actual images; the field being nullable is fine.

#### Components

**`src/shared/ui/item-image.tsx` â€” `<ItemImage />`**

The single image component used everywhere: inventory grid, inventory list, shopping basket.

```
Props:
  src: string | null | undefined
  name: string              â† used for initials fallback
  category?: string | null  â† used for category icon fallback
  size: 'sm' | 'md' | 'lg' | 'xl'
    sm  = 32Ã—32   (list row thumbnail)
    md  = 48Ã—48   (shopping basket row)
    lg  = 80Ã—80   (compact grid card)
    xl  = full-width square (large grid card)
  className?: string

Render logic:
  1. src present â†’ <Image> with object-cover, fade-in on load
  2. src null, category present â†’ category icon (SVG, muted color)
  3. src null, no category -> 2-letter initials on neutral grayscale placeholder
  4. Always consistent aspect ratio (1:1 square)

Styling:
  - Rounded corners: rounded-xl (12px)
  - Background: var(--surface-card-bg) so it blends on placeholders
  - Transition: opacity 0 â†’ 1 on image load (no layout shift)
```

**`src/shared/ui/quantity-badge.tsx` â€” `<QuantityBadge />`**

Displays current quantity + unit. Used on grid cards.

```
Props:
  quantity: number
  unit: string
  parLevel?: number | null   â† if set and quantity < parLevel â†’ warning color
  size: 'sm' | 'md'

Render:
  - "12 cs" (quantity + abbreviated unit)
  - Color: neutral by default; semantic warning/error colors only when required
  - Compact pill shape
```

**`src/shared/ui/view-mode-toggle.tsx` â€” `<ViewModeToggle />`**

```
Props:
  value: 'grid' | 'list'
  onChange: (mode: 'grid' | 'list') => void

Render:
  - Two icon buttons side by side (grid icon, list icon)
  - Active state: filled icon, homepage primary token
  - Inactive: outline icon, muted
  - Size: 32Ã—32 touch target each
```

**`src/shared/ui/sort-select.tsx` â€” `<SortSelect />`**

```
Props:
  value: InventorySortKey
  onChange: (key: InventorySortKey) => void

type InventorySortKey = 'name_asc' | 'name_desc' | 'qty_asc' | 'qty_desc' | 'low_stock' | 'last_updated'

Render:
  - Compact select/dropdown
  - Labels: "Aâ†’Z", "Zâ†’A", "Qty â†‘", "Qty â†“", "Low stock first", "Recently updated"
```

#### Data layer

Update `src/features/inventory/server/inventory.repository.ts`:

- Modify `getAllInventoryLevels(businessId)` to include `image_url`:
  - For each inventory item: check `inventory_items.image_url` first (IMG initiative result)
  - Fall back: join through `item_barcodes` â†’ `global_barcode_catalog.image_url` (first non-null)
  - Return `image_url: string | null` on each `InventoryLevel`

Update `InventoryLevel` type to include `image_url: string | null`.

#### View mode persistence hook

Create `src/features/inventory/ui/use-inventory-view.ts`:

```typescript
// Persists view mode + sort preference to localStorage
export function useInventoryView() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')   // default: grid
  const [sortKey, setSortKey] = useState<InventorySortKey>('name_asc')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // Load from localStorage on mount
  // Persist changes on update

  return { viewMode, setViewMode, sortKey, setSortKey, categoryFilter, setCategoryFilter }
}
```

#### Checklist

- [x] UX-00-0: Design restatement logged (tokens-only, no glow/gradient, structural UI only, grayscale fallback when uncertain)
- [x] UX-00-a: Create `src/shared/ui/item-image.tsx` with all 3 fallback states + size variants
- [x] UX-00-b: Create `src/shared/ui/quantity-badge.tsx` with par level color logic
- [x] UX-00-c: Create `src/shared/ui/view-mode-toggle.tsx`
- [x] UX-00-d: Create `src/shared/ui/sort-select.tsx` with all 6 sort keys
- [x] UX-00-e: Update `getAllInventoryLevels` to include `image_url` via resolver chain
- [x] UX-00-f: Add `image_url: string | null` to `InventoryLevel` type
- [x] UX-00-g: Create `src/features/inventory/ui/use-inventory-view.ts`
- [x] UX-00-h: Validation â€” `npx tsc --noEmit --incremental false` â†’ PASS

---

### UX-01 â€” Inventory Grid and List Views

**Goal:** Rebuild `InventoryListPageClient` with the new dual-mode layout. Condense the enrichment queue into a `!` button. Add category tabs, sort, and search in a sticky top bar.

**Status:** `[ ]` pending

**Prerequisite:** UX-00 complete.

#### Layout Structure

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  [Search input Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·Â·] [!] â”‚  â† sticky top bar
â”‚  [Grid|List]  [Category tabs]  [Sort]â”‚  â† controls row
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                     â”‚
â”‚  GRID MODE:                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”        â”‚
â”‚  â”‚  [image] â”‚  â”‚  [image] â”‚        â”‚
â”‚  â”‚  Name    â”‚  â”‚  Name    â”‚        â”‚
â”‚  â”‚  12 cs â–¼ â”‚  â”‚   3 ea â–¼ â”‚        â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”        â”‚
â”‚  â”‚  [image] â”‚  â”‚  [image] â”‚        â”‚
â”‚  â”‚  ...     â”‚  â”‚  ...     â”‚        â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        â”‚
â”‚                                     â”‚
â”‚  LIST MODE:                         â”‚
â”‚  [img] Name                   12 cs â”‚
â”‚  [img] Name                    3 ea â”‚
â”‚  [img] Name                   0 cs âš â”‚
â”‚                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Sticky Top Bar

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ðŸ” Search items...           [!] 2  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

- Full-width search input, rounded pill shape
- `[!]` button: neutral or semantic warning badge with count (no custom accent colors)
- Tapping `[!]` opens the enrichment queue **drawer** (slides up from bottom, not in-page card)
- Top bar is `position: sticky top-0` with solid neutral background (no blur/glass treatment)

#### Controls Row (below top bar)

```
[â‰¡â‰¡ Grid] [â‰¡ List]    [All] [Produce] [Dairy] [+]    [Sort â–¾]
```

- View mode toggle (left)
- Category filter tabs: "All" always first, then top 4 categories by item count, `+` for more
- Sort dropdown (right, compact)

#### Grid Card Component â€” `src/features/inventory/ui/InventoryGridCard.tsx`

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  â”‚
â”‚   [ItemImage xl] â”‚  â† fills top ~60% of card, object-cover
â”‚                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Name of Item     â”‚  â† font-medium, truncate, 1 line
â”‚ [12 cs]          â”‚  â† QuantityBadge (with par color)
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

Dimensions: flexible width (grid-cols-2 gap-2.5), fixed aspect ratio via padding-bottom trick
Card style: rounded-2xl, border border-[--surface-card-border], no shadow (clean)
Tap: navigates to /inventory/{id}
Long-press (optional future): quick quantity adjust inline
```

#### List Row Component â€” `src/features/inventory/ui/InventoryListRow.tsx`

```
[img 32Ã—32]  Name of Item         [12 cs]  â€º
```

- Height: 52px (tight, dense)
- Image: `<ItemImage size="sm" />` â€” 32Ã—32, rounded-lg
- Name: `font-medium text-sm`, flex-1, truncate
- Quantity: `<QuantityBadge size="sm" />` right-aligned
- Chevron: only shown if navigable (always yes for inventory)
- Separator: 1px divider between rows (NOT individual cards â€” avoids visual noise)
- Tap: navigates to `/inventory/{id}`

No card border/shadow per row in list mode â€” just a flat list with dividers. Much denser.

#### Enrichment Queue Drawer â€” `src/features/inventory/ui/EnrichmentQueueDrawer.tsx`

Replace the in-page expanded card with a bottom drawer:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  â”â”â”  (drag handle)                  â”‚
â”‚  âš   Tasks needing attention  (2)    â”‚
â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚
â”‚  [high] Add photo â€” Chicken Breast  â”‚
â”‚  [med]  Confirm category â€” Olive Oilâ”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  â”‚
â”‚  [Dismiss all]          [View all â†’ ]â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

- Triggered by `[!]` button in sticky top bar
- Bottom sheet: slides up, 50vh max height, scrollable
- Shows top 5 tasks by priority
- Each row: priority chip, task type label, item name, [Done] [Skip] actions
- "View all" link expands to full list inside drawer
- Dismissing all â†’ drawer closes, `[!]` badge disappears

#### Filtering + Sorting Logic

Client-side (all items already loaded):

```typescript
function applyFilters(items: InventoryLevel[], opts: {
  search: string
  categoryFilter: string | null
  sortKey: InventorySortKey
}): InventoryLevel[] {
  let result = items

  // Search
  if (opts.search) {
    result = result.filter(i =>
      i.name.toLowerCase().includes(opts.search.toLowerCase()) ||
      i.category?.name.toLowerCase().includes(opts.search.toLowerCase())
    )
  }

  // Category filter
  if (opts.categoryFilter) {
    result = result.filter(i => i.category?.name === opts.categoryFilter)
  }

  // Sort
  switch (opts.sortKey) {
    case 'name_asc': return result.sort((a, b) => a.name.localeCompare(b.name))
    case 'name_desc': return result.sort((a, b) => b.name.localeCompare(a.name))
    case 'qty_asc': return result.sort((a, b) => a.current_quantity - b.current_quantity)
    case 'qty_desc': return result.sort((a, b) => b.current_quantity - a.current_quantity)
    case 'low_stock': return result.sort((a, b) => {
      const aRatio = a.par_level ? a.current_quantity / a.par_level : 1
      const bRatio = b.par_level ? b.current_quantity / b.par_level : 1
      return aRatio - bRatio
    })
    case 'last_updated': return result.sort((a, b) =>
      (b.last_transaction_at?.getTime() ?? 0) - (a.last_transaction_at?.getTime() ?? 0)
    )
  }
}
```

#### Checklist

- [ ] UX-01-0: Design restatement logged (tokens-only, no glow/gradient, structural UI only, grayscale fallback when uncertain)
- [ ] UX-01-a: Create `src/features/inventory/ui/InventoryGridCard.tsx`
- [ ] UX-01-b: Create `src/features/inventory/ui/InventoryListRow.tsx`
- [ ] UX-01-c: Create `src/features/inventory/ui/EnrichmentQueueDrawer.tsx` (replaces in-page queue card)
- [ ] UX-01-d: Rebuild `src/features/inventory/ui/InventoryListPageClient.tsx`:
  - Sticky top bar with search + `[!]` button wired to drawer
  - Controls row: view mode toggle + category tabs + sort select
  - Conditional render: grid (2-col) vs list (flat rows)
  - Client-side filter + sort logic
  - Empty state per filter/search
- [ ] UX-01-e: Derive category tabs from loaded inventory items (top 4 + overflow)
- [ ] UX-01-f: Validation â€” `npx tsc --noEmit --incremental false` â†’ PASS
- [ ] UX-01-g: Manual smoke: grid shows 2 columns, images where available, initials where not; toggling to list shows dense rows; `[!]` opens drawer; category tabs filter correctly; sort changes order

---

### UX-02 â€” Shopping Basket Redesign

**Goal:** Rebuild the shopping session item list to match the Uber Eats cart visual style. Clean rows: image, name, quantity stepper. Reconciliation state is still visible but not the dominant visual.

**Status:** `[ ]` pending

**Prerequisite:** UX-00 complete.

#### Context

The shopping page has many workflows stacked vertically (barcode scanner, shelf label, manual add, barcode pairing, receipt scan). These workflows stay as-is. Only the **item list section** is redesigned. The rest of the page is unchanged.

#### Current vs New Item Row

**Current:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Item Name            [staged] [exact] â”‚
â”‚ [UPC 123456]                         â”‚
â”‚ Qty: [1] Ã—  $2.99 = $2.99            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**New:**
```
[img 48Ã—48]  Item Name              Ã—  [âˆ’] 3 [+]
             $2.99 ea Â· $8.97 total
             [exact âœ“]                          â† status, small + muted
```

- Image: `<ItemImage size="md" />` â€” pull from linked `inventory_item_id` â†’ `image_url`, else barcode catalog via `scanned_barcode`
- Name: `font-semibold text-sm`, truncate
- Price line: `text-xs text-muted` below name
- Quantity stepper: `[âˆ’] N [+]` inline, right side â€” tapping `âˆ’` at 1 shows trash icon instead
- Reconciliation status: tiny chip below name, muted colors (not the dominant badge it currently is)
- Row height: ~72px (consistent, regardless of content)
- Rows are flat (no individual card borders) â€” the basket section itself has a card wrapper

#### Basket Section Layout

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Basket (5 items)           $26.69  â”‚  â† section header
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ [img]  Yellow Banana         [âˆ’] 1 [+]â”‚
â”‚        $0.29 ea              exact âœ“â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ [img]  English Seedless Cuc  [âˆ’] 7 [+]â”‚
â”‚        $1.99 ea Â· $13.93     exact âœ“â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ [img]  Baby Spinach          [âˆ’] 1 [+]â”‚
â”‚        $3.99 ea          qty_mismatchâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Shopping Item Image Resolution

Since `ShoppingSessionItem` has `inventory_item_id` and `scanned_barcode`, resolve image as:
1. `inventory_item.image_url` (if `inventory_item_id` is set and item has own image)
2. `global_barcode_catalog.image_url` where `barcode_normalized = scanned_barcode`
3. `produce_item_images` lookup if item name matches produce (PLU inference â€” best effort)
4. null â†’ `<ItemImage>` renders initials fallback

This resolution happens server-side: when loading the shopping session, join images in. Do not make separate API calls per item at render time.

#### New Component â€” `src/features/shopping/ui/BasketItemRow.tsx`

```
Props:
  item: ShoppingItem
  imageUrl: string | null
  onQuantityChange: (itemId, delta) => void
  onRemove: (itemId) => void
```

#### Checklist

- [ ] UX-02-0: Design restatement logged (tokens-only, no glow/gradient, structural UI only, grayscale fallback when uncertain)
- [ ] UX-02-a: Create `src/features/shopping/ui/BasketItemRow.tsx`
- [ ] UX-02-b: Update shopping session server action to include `image_url` per item (resolver chain)
- [ ] UX-02-c: Replace item list section in `app/(dashboard)/shopping/page.tsx` with new `BasketItemRow` components
- [ ] UX-02-d: Ensure reconciliation status is still visible (small chip) â€” not removed, just deprioritized visually
- [ ] UX-02-e: Validation â€” `npx tsc --noEmit --incremental false` â†’ PASS
- [ ] UX-02-f: Manual smoke: basket shows images where available, quantity stepper works, removing item at qty 1 shows trash, reconciliation chip visible but not dominant

---

### UX-03 â€” Empty States and Placeholders

**Goal:** Design the no-item, no-image, and no-results states so they're clean and informative, not just blank.

**Status:** `[ ]` pending

**Prerequisite:** UX-01 and UX-02 complete.

#### States to handle

**Inventory grid â€” no items:**
```
  [box icon]
  No items yet
  Add your first item to get started
  [+ Add Item]
```

**Inventory grid â€” no results for search/filter:**
```
  [search icon]
  No items match "{search}"
  [Clear search]
```

**Inventory grid â€” category filter empty:**
```
  [category icon]
  No items in {category}
```

**Grid card â€” no image (already handled by `<ItemImage>` initials fallback)**
- Initials: first 2 chars of item name, uppercase
- Background: neutral grayscale placeholder only (no generated palette colors)
- Same rounded-xl as real images â€” seamless

**Shopping basket â€” empty basket:**
```
  [basket icon]
  Nothing added yet
  Scan a barcode or search to add items
```

#### Checklist

- [ ] UX-03-0: Design restatement logged (tokens-only, no glow/gradient, structural UI only, grayscale fallback when uncertain)
- [ ] UX-03-a: Add empty state to `InventoryListPageClient` (no items, no search results, no category results)
- [ ] UX-03-b: Verify `<ItemImage>` initials fallback renders correctly in grid and list contexts
- [ ] UX-03-c: Add empty basket state to shopping page item list section
- [ ] UX-03-d: Validation â€” all 4 empty states render correctly without errors

---

### UX-04 â€” Polish and Performance

**Goal:** Lazy load images. Smooth view mode transition. Optimistic quantity updates in shopping basket. Keyboard/accessibility pass.

**Status:** `[ ]` pending

**Prerequisite:** UX-01, UX-02, UX-03 complete.

#### Checklist

- [ ] UX-04-0: Design restatement logged (tokens-only, no glow/gradient, structural UI only, grayscale fallback when uncertain)
- [ ] UX-04-a: Add `loading="lazy"` to all `<ItemImage>` `<img>` elements; use Next.js `<Image>` with `sizes` prop for grid vs list sizing
- [ ] UX-04-b: Add CSS transition on view mode toggle (grid â†” list) â€” subtle fade/scale, not jarring
- [ ] UX-04-c: Optimistic quantity updates in shopping basket (`onQuantityChange` updates local state immediately, syncs to server in background)
- [ ] UX-04-d: Ensure `<ItemImage>` has `alt` text set to item name
- [ ] UX-04-e: Ensure all interactive elements (stepper buttons, view toggle, sort) have accessible labels
- [ ] UX-04-f: Test on a real mobile viewport (375px width) â€” grid 2-col must not overflow; list rows must be 44px+ touch target
- [ ] UX-04-g: Validation â€” `npx tsc --noEmit --incremental false` â†’ PASS

---

## Component Inventory (New Files)

```
src/shared/ui/
  item-image.tsx              â† UX-00
  quantity-badge.tsx          â† UX-00
  view-mode-toggle.tsx        â† UX-00
  sort-select.tsx             â† UX-00

src/features/inventory/ui/
  InventoryGridCard.tsx       â† UX-01
  InventoryListRow.tsx        â† UX-01
  EnrichmentQueueDrawer.tsx   â† UX-01
  use-inventory-view.ts       â† UX-00

src/features/shopping/ui/
  BasketItemRow.tsx           â† UX-02
```

**Modified files:**
```
src/features/inventory/ui/InventoryListPageClient.tsx  â† UX-01 (rebuilt)
src/features/inventory/server/inventory.repository.ts   â† UX-00 (add image_url)
app/(dashboard)/shopping/page.tsx                       â† UX-02 (item list section only)
```

---

## Design Token Reference

These CSS variables are already in your design system â€” use them consistently:

```
var(--surface-card-bg)          â† card background
var(--surface-card-border)      â† card border
var(--surface-card-border-hover)â† hover state
var(--text-primary)             â† item name
var(--text-muted)               â† secondary text (price, unit)
```

Token policy note:

- If placeholder tokens are missing, add token names only if they map to existing homepage color tokens or grayscale values.
- Do not introduce new hex colors for these tokens during autonomous refactor work.

Placeholder token names (if needed):
```
var(--image-placeholder-bg)     â† placeholder background for items without images
var(--image-placeholder-text)   â† initials text color
```

---

## Dependency on IMG Initiative

**UX can build and ship before IMG enrichment runs.** The `<ItemImage>` component gracefully degrades to initials when `image_url` is null. As IMG-02 (PLU enrichment) and IMG-03 (barcode mirror) run progressively, images will appear automatically â€” no code change required. The UI is ready for images; images arrive on their own schedule.

---

## What Is NOT Changing

- Barcode scanner flow (stays exactly as-is)
- Shelf label scan workflow
- Manual barcode pairing section
- Receipt scan card
- Bottom commit bar
- Inventory detail page (`/inventory/{id}`)
- Navigation structure

---

## Validation Commands Reference

```bash
npx tsc --noEmit --incremental false
npx eslint src/shared/ui/item-image.tsx src/features/inventory/ui/ src/features/shopping/ui/BasketItemRow.tsx
```

---

## Codebase Update Requirements

After each phase:
1. Append entry to `docs/codebase-changelog.md`
2. Update `docs/codebase-overview.md` â€” UI section
3. Update this plan with phase completion notes
4. Create one scoped git commit to this repository per completed checklist step and record commit hash in changelog

---

## Master Plan Cross-Reference

Tracked as initiative **UX** in `docs/master-plan-v2.md`.

- UX-00 depends on IMG-00 (schema must exist; enrichment data not required)
- UX-01 through UX-04 depend only on UX-00
- UX-02 through UX-04 can run in parallel once UX-01 is done
- No dependencies on DI initiative









