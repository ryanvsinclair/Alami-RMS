# UI Redesign Plan — Neutral Dark Design Language

Status: PENDING EXECUTION
Created: 2026-03-02
Last Updated: 2026-03-02
Primary Purpose: Migrate the app's visual language from navy-tinted surfaces with gradient cards and heavy borders toward a true neutral dark system (Zero/Revolut/Wise reference), while preserving azure (`#007fff`) as the sole brand/action color.

Constitution source: `docs/active/execution-constitution.md`

---

## Reference

Design direction is sourced from the following apps (screenshot reference on file):

- **Zero** — flat neutral dark cards, minimal borders, clean list rows
- **Wise** — solid fill pill CTAs, clear elevation via lightness contrast only
- **Revolut** — section grouping pattern, tight accent usage, heavy display numbers
- **Microsoft Teams / Google Fit** — large display typography, muted section headers

**Non-negotiables:**
- Azure `#007fff` stays as the primary color for all actions, highlights, and active states
- Home page hero blue gradient stays — it is a brand-intentional surface
- Dark/light theme support stays
- No new colors introduced — only neutralize existing surface tints

---

## What Changes and Why

### Current Problems

| Problem | Current | Target |
|---|---|---|
| Background has blue tint | `#0b1120` (navy) | `#0d0d0f` (neutral near-black) |
| Cards have blue tint | `#111c2e` (navy card) | `#161618` (neutral dark) |
| Card surfaces use gradients | `rgba(18,30,48,0.92)` gradient | Flat `#161618` |
| Borders on everything | `rgba(255,255,255,0.06)` on every card/row | Removed — use lightness contrast only |
| Layer 2 home is deep blue | `#1a3a6a` | `#1c1c1e` (neutral) |
| Nav uses gradient bg | `rgba(14,22,36,0.92)` gradient | Flat `rgba(18,18,20,0.94)` |
| Muted color is blue-gray | `#8899b0` | `#808088` (neutral gray) |
| Border color is navy | `#1e2d42` | `#242428` (neutral) |
| Row items have borders | `border` on each row | `divide-y` hairline or spacing only |
| CTAs mixed styles | outline + ghost variants inconsistent | Solid fill pill (primary) or flat ghost only |

---

## Phase 1 — Token System (`globals.css`)

**Scope:** CSS variable updates only. Highest impact, zero JSX changes required. All `var()` references across the app inherit automatically.

### Dark theme token changes

```css
/* Before → After */
--background:        #0b1120  →  #0d0d0f
--card:              #111c2e  →  #161618
--border:            #1e2d42  →  #242428
--muted:             #8899b0  →  #808088

--surface-card-bg:   gradient(rgba(18,30,48,0.92)…)  →  #161618  (flat)
--surface-card-border: rgba(255,255,255,0.06)         →  transparent (removed)

--surface-nav-bg:    gradient(rgba(14,22,36,0.92)…)  →  rgba(18,18,20,0.94)  (flat)
```

### Light theme token changes

```css
--background:  #f0f4f8  →  #f5f5f7   (Apple-neutral, no blue tint)
/* --card: #ffffff stays */
/* --border: #d4dce8 stays (already neutral enough) */
```

### Layer color changes (home page stack)

```css
/* Layer 2 — income/summary */
.layer-summary          { background: #1a3a6a; }   →   { background: #1c1c1e; }
[data-theme="light"] .layer-summary { background: #4a90e2; }  →  { background: #e8e8ed; }

/* Layer 1 — hero blue gradient: NO CHANGE */
/* Layer 3 — transactions (var(--card)): inherits new neutral #161618 automatically */
```

**Validation:** `npx tsc --noEmit --incremental false` + visual smoke on home, inventory, documents pages.

---

## Phase 2 — Surface Utility Classes (`globals.css`)

**Scope:** Update `.app-control`, `.app-sheet`, `.app-sheet-row` utility classes. No JSX changes.

### `.app-control`

```css
/* Before */
.app-control {
  border: 1px solid var(--surface-control-border);
  background: var(--surface-control-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

/* After — remove border, keep bg */
.app-control {
  background: var(--surface-control-bg);
}
```

### `.app-sheet`

```css
/* Before */
.app-sheet {
  border: 1px solid var(--sheet-border);
  background: var(--sheet-bg);
  box-shadow: var(--sheet-shadow);
}

/* After — remove border, keep bg + shadow for elevation */
.app-sheet {
  background: var(--sheet-bg);
  box-shadow: var(--sheet-shadow);
}
```

### `.app-sheet-row`

```css
/* Before */
.app-sheet-row {
  border: 1px solid var(--sheet-row-border);
  background: var(--sheet-row-bg);
}

/* After — remove border, keep subtle bg tint */
.app-sheet-row {
  background: var(--sheet-row-bg);
}
```

**Validation:** Visual smoke on profile settings, documents inbox, transaction rows.

---

## Phase 3 — Button & CTA Conventions

**Scope:** Establish and document a consistent button pattern. Not a global find-replace — apply as pages are touched. Use this as the rule for all new work and refactors going forward.

### Primary action (solid fill pill)

```tsx
// Solid azure, white text, no border
className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white
           transition-colors hover:bg-primary-hover active:scale-[0.97]"
```

### Secondary / ghost action

```tsx
// Flat dark fill, no border ring
className="rounded-full bg-foreground/[0.07] px-5 py-2.5 text-sm font-semibold
           text-foreground transition-colors hover:bg-foreground/[0.11]"
```

### Destructive

```tsx
// Semantic danger tint, no hard border
className="rounded-full bg-danger/10 px-5 py-2.5 text-sm font-semibold
           text-danger transition-colors hover:bg-danger/15"
```

### Icon action button (small)

```tsx
// Used for inline actions, quick-add, etc.
className="grid h-9 w-9 place-items-center rounded-full bg-foreground/[0.06]
           text-foreground/70 transition-colors hover:bg-foreground/[0.10] hover:text-foreground"
```

**Rule:** Never use `border` on a button. Differentiate via fill vs no-fill, not outline rings.

---

## Phase 4 — Typography Conventions

**Scope:** Document the enforced scale. Apply when touching pages, not a sweep.

### Hierarchy

| Role | Size | Weight | Opacity |
|---|---|---|---|
| Display value (balance, large stat) | `text-[44px]` or `text-4xl` | `font-bold` | 100% white |
| Page title | `text-2xl` | `font-bold` | 100% |
| Section value | `text-xl` / `text-lg` | `font-bold` or `font-semibold` | 100% |
| Body / row primary | `text-sm` or `text-[15px]` | `font-semibold` | 100% |
| Body / row secondary | `text-sm` | `font-medium` | `text-foreground/60` |
| Section divider label | `text-[11px]` | `font-medium` | `text-foreground/40` |
| Metadata / timestamp | `text-xs` | `font-medium` | `text-foreground/40` |

**Rule:** Never use `text-foreground/70` on primary row content. `/70` and above is reserved for secondary lines. Section labels and timestamps are `/40`.

---

## Phase 5 — List Row & Card Structure

**Scope:** Document the target pattern. Apply when touching feature UIs, not a sweep.

### Target pattern (Revolut/Zero style)

```
[Section Label]           ← text-[11px] font-medium tracking-widest uppercase text-foreground/40

[Card block]              ← bg-card rounded-2xl (NO border)
  [Row 1]                 ← px-4 py-3.5, flex items-center justify-between
  [Divider]               ← h-px bg-border/40 mx-4  (hairline only, no full border)
  [Row 2]
  [Divider]
  [Row 3]                 ← no divider after last row
```

### What to stop doing

- Individual `border` on every row item (`className="border border-border/70 rounded-xl"`)
- Wrapping every row in its own card container
- `app-sheet-row` class on each row — use it on the section block, not individual rows
- Mixing border-based and divider-based separation on the same page

---

## Phase 6 — Borders Audit Rule

**Going forward:** A border should only appear when it is structurally necessary (e.g., an input field, a focused state, a selected state). Not for visual grouping.

| Use case | Border? | Instead |
|---|---|---|
| Card grouping surface | No | `bg-card` contrast vs `bg-background` |
| List row separation | No (mostly) | `divide-y divide-border/30` or spacing |
| Input field | Yes | `border border-border` |
| Active/selected state | Yes (ring) | `ring-1 ring-primary` |
| Button | No | Fill contrast only |
| Nav pill container | No | Shadow only (already done) |

---

## Execution Order

```
Phase 1 → Phase 2 → (visual review) → Phase 3–6 applied progressively as pages are touched
```

Phases 1 and 2 are safe to execute in a single session — they are CSS-only, propagate via `var()`, and require no JSX changes.

Phases 3–6 are **conventions** applied incrementally. They do not require a sweep of all pages at once. Any new feature work or page-level refactor must follow these conventions from this point forward.

---

## What Does Not Change

- Azure `#007fff` primary color — all CTAs, active states, links
- Home hero gradient (`--hero-bg`) — brand surface, intentional blue
- Border radius conventions (rounded-2xl cards, rounded-full pills, rounded-xl controls)
- Typography size scale
- Spacing conventions (px-4/px-5 page padding, gap patterns)
- Splash screen design
- Dark/light theme support
- Layer-stack home architecture
- Bottom nav pill shape and icon color system

---

## Validation Checklist (Per Phase)

- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] `npx eslint` on touched files passes
- [ ] Visual smoke: home page, inventory list, documents inbox, profile, integrations
- [ ] Dark mode and light mode both checked
- [ ] No new colors introduced (only neutralizing existing tints)
- [ ] No azure replaced or weakened
