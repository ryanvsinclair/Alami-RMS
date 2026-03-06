# Apple Redesign Agent Playbook â€” Canonical Checklist

Status: COMPLETED
Created: 2026-03-03
Last Updated: 2026-03-03
Primary Purpose: Canonical sequencing and progress tracker for transforming Vynance into an Apple-original-looking iOS app.

## Compressed Invariant Block (Read First Every Session)

- The goal is to make the app look and feel like an Apple original iOS app.
- Only className strings, CSS custom property values, and variantStyles objects may be changed.
- No logic changes. No new components. No new pages. No new features.
- No changes to TypeScript types, interfaces, or business logic.
- Never touch: `app/actions/`, `lib/modules/`, `lib/config/`, `prisma/`, any `*.test.*` file.
- One phase at a time. Verify the phase checklist before advancing.
- Each completed checklist step must have a scoped git commit before advancing.
- If the playbook says "do not change X", do not change X.
- When unsure between two values, always choose the more conservative (smaller radius, less change).
- No silent scope expansion. Use the Deviation Proposal block if scope must change.

Design source: `docs/active/apple-design-system.md`

## How To Use This File

1. Start each session by reading:
   - `## Last Left Off Here`
   - `## Canonical Order Checklist`
2. Claim exactly one phase at a time (one `[ ]` â†’ `[~]`).
3. Read the full phase spec in this file before touching any code.
4. Execute only that phase's scope.
5. Run the phase verify gate before marking complete.
6. Update:
   - this file (checklist + latest left-off marker)
   - `docs/active/codebase-changelog.md` (always)
7. Commit checkpoint:
   - one scoped git commit per completed phase, message format: `design(phase-N): <what changed>`

## Immutable Scope Reference (Required)

- Design research and exact specifications live in `docs/active/apple-design-system.md`.
- This playbook must not contradict that document.
- If a target value here conflicts with `apple-design-system.md`, the design system doc wins.

## Mandatory Preflight Before Each Phase (Required)

Before starting any phase:

1. Read the full phase spec below.
2. Run a targeted search for the patterns you are about to change:
   - `rg -n "uppercase\|tracking-wide" src app components` (for Phase 1)
   - `rg -n "rounded-2xl\|rounded-\[24px\]" src app components` (for Phase 2)
   - etc.
3. Record how many matches exist before you start.
4. After changes, re-run the same search and confirm match count dropped to zero (or expected remainder).

## Explicit Deviation Proposal Mechanism (No Silent Scope Expansion)

If any change outside the defined scope is needed:

1. Create a `Deviation Proposal` block in this file.
2. Mark the current phase `[!]` blocked.
3. Do not execute the deviation until approved by user.
4. After approval, update this file before implementing.

## Autonomous Execution Contract (Required)

1. Determine active phase deterministically:
   - if any phase is `[~]`, resume that phase first
   - else pick the first eligible `[ ]` top-to-bottom
2. Run the mandatory preflight before edits.
3. Execute only the selected phase scope.
4. Run the verify gate.
5. If complete, mark `[x]` and commit.
6. Continue to next phase unless a stop condition exists.

Hard rules:
- Only one phase may be `[~]` at a time.
- Do not skip earlier open phases.
- Do not move `[ ]` to `[x]` without verify gate evidence.

Stop conditions:
- verify gate fails
- unresolved dependency or product decision blocker
- unapproved deviation request

## Validation Gate (Required Before Marking Any Phase `[x]`)

A phase can be marked `[x]` only if all applicable checks pass:

1. Typecheck passes: `npx tsc --noEmit --incremental false`
2. Targeted lint passes for changed files: `npx eslint <changed files>`
3. Diff-size proportionality recorded:
   - changed file count
   - line delta summary
   - confirm size matches phase scope
4. Unrelated-file check: confirm no files outside the phase scope were modified
5. No new dependencies added
6. No new environment variables introduced
7. Design governance check:
   - no new hex colors introduced that are not in `apple-design-system.md` target tokens
   - no new shadows introduced that exceed Apple spec (blur > 20px)
   - no new border-radius values that exceed Apple spec (> 20px except `rounded-full`)
   - zero `uppercase` remaining in className strings touched by this phase
8. Phase verify checklist (defined per phase below) all ticked
9. Commit exists with correct message format

## Auto-Advance Sequence Gates

- Start Phase 2 only after Phase 1 is `[x]`
- Start Phase 3 only after Phase 2 is `[x]`
- Start Phase 4 only after Phase 3 is `[x]`
- Start Phase 5 only after Phase 4 is `[x]`
- Start Phase 6 only after Phase 5 is `[x]`
- Start Phase 7 only after Phase 6 is `[x]`
- Start Phase 8 only after Phase 7 is `[x]`
- Start Phase 9 only after Phase 8 is `[x]`
- Start Phase 10 only after Phase 9 is `[x]`
- Start Phase 11 only after Phase 10 is `[x]`
- Start Phase 12 (QA) only after Phase 11 is `[x]`

## Completion Percentage (Update Every Phase)

- Total phases: `12`
- `[x]` completed: `12`
- `[~]` in progress: `0`
- Strict completion: `100%`

Update rule after each phase:
1. Update checklist statuses first.
2. Recalculate: `([x] count / 12) * 100`
3. Update this section.

---

## Last Left Off Here

- Current phase: Phase 12 â€” Final QA Audit
- Status: `[x]`
- Last updated: 2026-03-03
- Next action: Redesign complete; monitor for regressions

---

## Canonical Order Checklist

Status legend:
- `[ ]` not started
- `[~]` in progress
- `[x]` completed
- `[!]` blocked

---

### Phase 1 â€” Typography: Remove All Uppercase and Tracking

**Why:** Apple never uses uppercase UI text in modern iOS. This single change has the highest visual impact.
**Risk:** Low â€” className changes only, no logic
**Files in scope:** `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/nav/bottom-nav.tsx`, all form label elements across `src/` and `app/`
**Do NOT touch:** Any TypeScript logic, any non-className attribute

- [ ] AP-01-a: `components/ui/badge.tsx` â€” remove `uppercase tracking-wide font-semibold`, replace with `tracking-normal font-medium`
- [ ] AP-01-b: `components/ui/button.tsx` â€” remove `tracking-tight`, replace with `tracking-normal`
- [ ] AP-01-c: `components/nav/bottom-nav.tsx` â€” remove `tracking-wide capitalize font-semibold` on label span, replace with `tracking-normal font-medium`
- [ ] AP-01-d: `app/auth/login/page.tsx` and `app/auth/signup/page.tsx` â€” remove all `uppercase tracking-[0.16em]` patterns from label/subtitle elements; replace with `text-[13px] font-normal tracking-normal`
- [ ] AP-01-e: `app/onboarding/` all pages â€” grep and fix same uppercase/tracking patterns on labels
- [ ] AP-01-f: `src/features/` â€” grep for `uppercase tracking-` in all className strings; fix every match
- [ ] AP-01-g: Section headers across `src/features/` â€” remove `uppercase tracking-widest` / `tracking-wide`; leave sentence-case text unchanged

**Phase 1 Verify:**
- [ ] `rg "uppercase" src app components` â€” zero matches in className strings
- [ ] `rg "tracking-wide\|tracking-widest\|tracking-\[0" src app components` â€” zero matches in className strings
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Lint passes on all changed files
- [ ] Commit: `design(phase-1): remove uppercase and wide tracking from all UI labels`

---

### Phase 2 â€” Border Radius: Reduce to Apple Scale

**Why:** 24px radius on buttons, cards, and inputs looks bubbly â€” not iOS. Apple max for rectangles is 16px; standard is 10-12px.
**Risk:** Low â€” className and CSS value changes only
**Files in scope:** `components/ui/button.tsx`, `components/ui/card.tsx`, `app/globals.css`, all `<input>` and `<textarea>` elements across `src/` and `app/`
**Do NOT change:** `rounded-full` anywhere (keep all pill shapes), modal/sheet top corners at 20px, hero card at 16px

- [ ] AP-02-a: `components/ui/button.tsx` â€” change `rounded-2xl` to `rounded-xl` (24px â†’ 12px)
- [ ] AP-02-b: `components/ui/card.tsx` â€” change `rounded-[24px]` to `rounded-xl` (24px â†’ 12px)
- [ ] AP-02-c: All `<input>` and `<textarea>` elements in `src/` and `app/` â€” change `rounded-2xl` to `rounded-[10px]`
- [ ] AP-02-d: `app/globals.css` `.app-hero-card` â€” change `border-radius: 24px` to `border-radius: 16px`
- [ ] AP-02-e: `app/globals.css` `.layer-summary` â€” change `border-radius: 28px 28px 0 0` to `border-radius: 22px 22px 0 0`
- [ ] AP-02-f: `app/globals.css` `.layer-transactions` â€” change `border-radius: 32px 32px 0 0` to `border-radius: 22px 22px 0 0`
- [ ] AP-02-g: Grep for any remaining `rounded-[24px]` or `rounded-2xl` on non-pill elements and fix

**Phase 2 Verify:**
- [ ] `rg "rounded-2xl\|rounded-\[24px\]\|rounded-\[28px\]\|rounded-\[32px\]" src app components` â€” zero matches on card/button/input elements
- [ ] `.layer-summary` top radius is `22px 22px 0 0` in globals.css
- [ ] `.layer-transactions` top radius is `22px 22px 0 0` in globals.css
- [ ] `.app-hero-card` radius is `16px` in globals.css
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Lint passes on all changed files
- [ ] Commit: `design(phase-2): reduce border radius to Apple scale`

---

### Phase 3 â€” Shadows: Reduce to Apple Subtlety

**Why:** Shadows with 18-28px blur look like Material Design. Apple uses near-invisible shadows in light mode and zero shadows (borders instead) in dark mode.
**Risk:** Very Low â€” CSS variable values in globals.css only
**Files in scope:** `app/globals.css` and `components/ui/button.tsx` (one line)
**Do NOT touch:** Any `.tsx` files except the one button shadow line

- [ ] AP-03-a: `globals.css` dark mode â€” `--surface-card-shadow` â†’ `none`
- [ ] AP-03-b: `globals.css` dark mode â€” `--surface-card-shadow-hover` â†’ `none`
- [ ] AP-03-c: `globals.css` dark mode â€” `--surface-nav-shadow` â†’ `0 4px 20px rgba(0, 0, 0, 0.15)`
- [ ] AP-03-d: `globals.css` dark mode â€” `--hero-shadow` â†’ `0 8px 20px rgba(0, 60, 160, 0.18)`
- [ ] AP-03-e: `globals.css` dark mode â€” `--sheet-shadow` â†’ `0 4px 16px rgba(0, 0, 0, 0.12)`
- [ ] AP-03-f: `globals.css` dark mode â€” `--surface-card-border` â†’ `rgba(255, 255, 255, 0.08)` (border replaces shadow for dark mode elevation)
- [ ] AP-03-g: `globals.css` dark mode â€” `--surface-nav-border` â†’ `rgba(255, 255, 255, 0.10)`
- [ ] AP-03-h: `globals.css` dark mode â€” `--sheet-border` â†’ `rgba(255, 255, 255, 0.10)`
- [ ] AP-03-i: `globals.css` light mode â€” `--surface-card-shadow` â†’ `0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)`
- [ ] AP-03-j: `globals.css` light mode â€” `--surface-card-shadow-hover` â†’ `0 2px 6px rgba(0, 0, 0, 0.10), 0 6px 16px rgba(0, 0, 0, 0.06)`
- [ ] AP-03-k: `globals.css` light mode â€” `--surface-nav-shadow` â†’ `none`
- [ ] AP-03-l: `globals.css` light mode â€” `--sheet-shadow` â†’ `0 4px 16px rgba(0, 0, 0, 0.08)`
- [ ] AP-03-m: `components/ui/button.tsx` primary variant â€” remove `shadow-[0_6px_18px_rgba(0,127,255,0.3)]` entirely

**Phase 3 Verify:**
- [ ] No shadow blur value exceeds 20px anywhere in globals.css
- [ ] Dark mode `--surface-card-shadow` is `none`
- [ ] Primary button variant has no `shadow-*` class
- [ ] `--surface-card-border` is non-transparent in dark mode (has rgba value)
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Lint passes on changed files
- [ ] Commit: `design(phase-3): reduce shadows to Apple spec`

---

### Phase 4 â€” Interactions: Fix Press States

**Why:** `active:scale-[0.98]` is a Material Design pattern. iOS uses opacity reduction on press, never scale transforms.
**Risk:** Low â€” className changes only
**Files in scope:** `components/ui/button.tsx`, `components/ui/card.tsx`, any other file with `active:scale-`
**Do NOT touch:** Any logic, event handlers, or other components

- [ ] AP-04-a: `components/ui/button.tsx` â€” replace `transition-all duration-200 active:scale-[0.98]` with `transition-opacity duration-100 active:opacity-75`
- [ ] AP-04-b: `components/ui/card.tsx` â€” replace `active:scale-[0.995] transition-all duration-200` with `active:opacity-80 transition-opacity duration-100`
- [ ] AP-04-c: `components/ui/card.tsx` â€” replace `hover:shadow-[var(--surface-card-shadow-hover)]` with `hover:bg-foreground/[0.02]`
- [ ] AP-04-d: `components/ui/card.tsx` â€” remove `hover:border-[var(--surface-card-border-hover)]`
- [ ] AP-04-e: Grep `rg "active:scale-" src app components` â€” fix every remaining match by replacing with `active:opacity-75`

**Phase 4 Verify:**
- [ ] `rg "active:scale-" src app components` â€” zero matches
- [ ] `rg "hover:shadow-" src app components` â€” zero matches
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-4): replace scale press states with opacity`

---

### Phase 5 â€” Colors: Align to Apple System Colors

**Why:** Semantic colors (success/warning/danger) are Tailwind defaults, not Apple system colors. Primary blue and foreground also need slight adjustment for dark mode.
**Risk:** Low â€” CSS variable values and one variantStyles object
**Files in scope:** `app/globals.css`, `components/ui/badge.tsx`
**Do NOT touch:** Any other component files

- [ ] AP-05-a: `globals.css` dark mode â€” `--background` â†’ `#000000`
- [ ] AP-05-b: `globals.css` dark mode â€” `--foreground` â†’ `#ffffff`
- [ ] AP-05-c: `globals.css` dark mode â€” `--primary` â†’ `#0a84ff`
- [ ] AP-05-d: `globals.css` dark mode â€” `--primary-hover` â†’ `#409cff`
- [ ] AP-05-e: `globals.css` dark mode â€” `--success` â†’ `#30d158`
- [ ] AP-05-f: `globals.css` dark mode â€” `--warning` â†’ `#ff9f0a`
- [ ] AP-05-g: `globals.css` dark mode â€” `--danger` â†’ `#ff453a`
- [ ] AP-05-h: `globals.css` light mode â€” `--background` â†’ `#f2f2f7`
- [ ] AP-05-i: `globals.css` light mode â€” `--primary` â†’ `#007aff`
- [ ] AP-05-j: `globals.css` light mode â€” `--success` â†’ `#34c759`
- [ ] AP-05-k: `globals.css` light mode â€” `--warning` â†’ `#ff9500`
- [ ] AP-05-l: `globals.css` light mode â€” `--danger` â†’ `#ff3b30`
- [ ] AP-05-m: `globals.css` dark mode â€” add `--foreground-secondary: rgba(255,255,255,0.60)` and `--foreground-tertiary: rgba(255,255,255,0.30)`
- [ ] AP-05-n: `globals.css` light mode â€” add `--foreground-secondary: rgba(0,0,0,0.60)` and `--foreground-tertiary: rgba(0,0,0,0.30)`
- [ ] AP-05-o: `globals.css` dark mode â€” add `--fill-tertiary: rgba(118,118,128,0.24)` (used for input backgrounds in Phase 8)
- [ ] AP-05-p: `globals.css` light mode â€” add `--fill-tertiary: rgba(118,118,128,0.12)`
- [ ] AP-05-q: `components/ui/badge.tsx` â€” replace entire `variantStyles` object with borderless version (target below); remove all `border` classes

**Badge variantStyles target for AP-05-q:**
```tsx
const variantStyles: Record<Variant, string> = {
  default:  "bg-[var(--fill-tertiary)] text-[var(--foreground-secondary)]",
  success:  "bg-success/15 text-success",
  warning:  "bg-warning/15 text-warning",
  danger:   "bg-danger/15 text-danger",
  info:     "bg-primary/15 text-primary",
};
```

**Phase 5 Verify:**
- [ ] Dark `--primary` is `#0a84ff` in globals.css
- [ ] Dark `--success` is `#30d158` in globals.css
- [ ] Dark `--danger` is `#ff453a` in globals.css
- [ ] No `border` class remains in badge.tsx variantStyles
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-5): align semantic colors to Apple system palette`

---

### Phase 6 â€” Bottom Navigation: Apple Tab Bar Standards

**Why:** Nav is 72px tall (too tall), icons are 24px (too small), active state shows a pill background (iOS 17 removed it).
**Risk:** Low â€” className and inline style changes only
**Files in scope:** `components/nav/bottom-nav.tsx`, `app/globals.css`

- [ ] AP-06-a: `bottom-nav.tsx` â€” reduce pill height from `h-[72px]` to `h-[62px]`
- [ ] AP-06-b: `bottom-nav.tsx` â€” increase all nav SVG icons from `w-6 h-6` to `w-[26px] h-[26px]` (applies to all icons in the navItems array)
- [ ] AP-06-c: `globals.css` dark and light mode â€” set `--surface-nav-active-bg: transparent`
- [ ] AP-06-d: `globals.css` dark and light mode â€” set `--surface-nav-active-ring: none`
- [ ] AP-06-e: `bottom-nav.tsx` â€” audit the active Link className; remove any conditional `bg-[var(--surface-nav-active-bg)]` or ring style application; active state must only change text color
- [ ] AP-06-f: `bottom-nav.tsx` â€” confirm the nav container style prop includes `backdropFilter: "blur(20px)"` and `WebkitBackdropFilter: "blur(20px)"` â€” add if missing

**Phase 6 Verify:**
- [ ] Nav pill height is `h-[62px]`
- [ ] Nav SVG icons are `w-[26px] h-[26px]`
- [ ] Active tab shows color change only â€” no background, no ring visible
- [ ] Backdrop blur is 20px in style prop
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-6): align bottom nav to Apple tab bar standards`

---

### Phase 7 â€” Badge Density: Max 1 Per List Item

**Why:** Apple shows maximum 1 badge per list item. Showing 3-4 simultaneously creates visual noise Apple avoids.
**Risk:** Medium â€” touches multiple feature UI files; only removes/hides badge renders, does NOT delete underlying data or logic
**Files in scope:** `src/features/shopping/ui/`, `src/features/inventory/ui/`, `src/features/documents/ui/`
**Rule:** Only remove or comment-out extra `<Badge` renders. Do NOT delete badge data, props, or server logic.

- [ ] AP-07-a: Shopping basket items â€” reduce to 1 badge per item; keep the primary status badge; remove origin/barcode/secondary badges; show quantity as plain text `Ã—N` alongside item name
- [ ] AP-07-b: Inventory list items â€” reduce to 1 badge per item; keep status badge; show category as plain secondary text; show quantity as plain `Ã—N` text
- [ ] AP-07-c: Documents inbox items â€” reduce to 1 badge per item; keep status badge only; remove confidence percentage badge; remove separate auto-posted badge (status badge covers it)
- [ ] AP-07-d: `rg "<Badge" src app components` â€” audit any other list contexts with 2+ Badge renders per item and reduce to 1

**Phase 7 Verify:**
- [ ] No list item in Shopping, Inventory, or Documents renders more than 1 `<Badge` component in its row
- [ ] Quantity values are shown as plain text, not as Badge components
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Lint passes on all changed feature files
- [ ] Commit: `design(phase-7): reduce badge density to Apple maximum (1 per item)`

---

### Phase 8 â€” Input Fields: Remove Non-Apple Styling

**Why:** Inputs have inset shadows (non-Apple), oversized focus rings (Apple uses none), and a too-subtle background.
**Risk:** Low â€” className-only changes on input elements
**Files in scope:** All `<input>` and `<textarea>` elements across `src/` and `app/`
**Do NOT touch:** Input logic, validation, onChange handlers, value bindings

- [ ] AP-08-a: Remove `shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]` from all input elements
- [ ] AP-08-b: Replace `bg-foreground/[0.04]` on input backgrounds with `bg-[var(--fill-tertiary)]`
- [ ] AP-08-c: Remove `focus:ring-2 focus:ring-primary/25` from all input elements; replace with `focus:outline-none`
- [ ] AP-08-d: Verify all inputs have `rounded-[10px]` (set in Phase 2 â€” confirm here)

**Phase 8 Verify:**
- [ ] `rg "inset.*rgba" src app components` â€” zero matches in input classNames
- [ ] `rg "focus:ring-2" src app components` â€” zero matches on input elements
- [ ] All inputs have `rounded-[10px]` radius
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-8): clean input field styling to Apple spec`

---

### Phase 9 â€” Home Dashboard Refinement

**Why:** Hero balance text is 44px bold (Apple uses 34pt Regular for hero numbers); a decorative watermark logo sits behind content (not an Apple pattern).
**Risk:** Medium â€” touches core home UI layout
**Files in scope:** `src/features/home/ui/HomeDashboardClient.tsx` and sibling home layer files (`HomeIncomeLayer.tsx`, etc.)
**Do NOT touch:** Home server actions, data fetching, balance calculation logic

- [ ] AP-09-a: Balance display text â€” find element using large size (text-[44px] or similar); change to `text-[34px] font-normal tracking-tight`
- [ ] AP-09-b: Watermark logo â€” find low-opacity logo/brandmark in hero background (opacity ~0.18); remove the element entirely
- [ ] AP-09-c: Quick action buttons ("Add Receipt", "Scan Barcode") â€” change from solid primary to tinted glass: `rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm` (keep `rounded-full` â€” pills are correct here)
- [ ] AP-09-d: Section labels in home layers â€” verify no uppercase remains from Phase 1; fix any missed instances

**Phase 9 Verify:**
- [ ] Balance text uses `text-[34px] font-normal`
- [ ] No watermark/low-opacity logo element exists in the hero section
- [ ] Quick action buttons use tinted glass style (not solid primary)
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-9): refine home dashboard to Apple hero standards`

---

### Phase 10 â€” Page Headers: Apple Navigation Bar Typography

**Why:** Page titles use `text-2xl font-bold` â€” Apple Title 1 is 28pt semibold. Back buttons should be plain blue text with a chevron, no pill or border.
**Risk:** Low
**Files in scope:** `components/nav/page-header.tsx`
**Do NOT touch:** Back button routing logic, navigation handlers

- [ ] AP-10-a: Page title element â€” change `text-2xl font-bold` to `text-[28px] font-semibold tracking-tight`
- [ ] AP-10-b: Back button â€” ensure style is `text-primary text-[17px] font-normal` with a plain chevron; no background, no border, no pill shape
- [ ] AP-10-c: Remove any `rounded-*`, `bg-*`, or `border-*` classes from the back button element

**Phase 10 Verify:**
- [ ] Page title uses `text-[28px] font-semibold tracking-tight`
- [ ] Back button has no background or border classes
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-10): align page headers to Apple nav bar typography`

---

### Phase 11 â€” Auth Pages Final Polish

**Why:** Auth cards have a primary-colored ring (`ring-1 ring-primary/10`) that is non-Apple. Subtitle text may still be uppercase from Phase 1 misses.
**Risk:** Low
**Files in scope:** `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`
**Do NOT touch:** Auth logic, form submission, Supabase calls, redirect logic

- [ ] AP-11-a: Remove `ring-1 ring-primary/10` (or any `ring-*` class) from the auth card/sheet wrapper element
- [ ] AP-11-b: Subtitle / helper text ("Welcome back" etc.) â€” confirm it is `text-sm text-muted font-normal` â€” sentence case, not bold, not uppercase
- [ ] AP-11-c: Form labels in auth pages â€” confirm `text-[13px] font-normal tracking-normal text-muted` (Phase 1 verification pass)
- [ ] AP-11-d: Primary CTA button â€” confirm no shadow class present (Phase 3 verification pass)

**Phase 11 Verify:**
- [ ] No `ring-*` class on the auth card wrapper
- [ ] Subtitle text is sentence case, muted, font-normal
- [ ] `npx tsc --noEmit --incremental false` passes
- [ ] Commit: `design(phase-11): polish auth pages to Apple form standards`

---

### Phase 12 â€” Final QA Audit

**Why:** Catch any drift or missed items from Phases 1-11.
**Risk:** None â€” read-only scan with targeted fixes only
**Files in scope:** Entire `src/`, `app/`, `components/` (scan only, fix only what is found)

- [ ] AP-12-a: `rg "uppercase" src app components` â€” fix any remaining `uppercase` in className strings
- [ ] AP-12-b: `rg "tracking-wide\|tracking-widest" src app components` â€” fix any remaining in className strings
- [ ] AP-12-c: `rg "active:scale-" src app components` â€” fix any remaining
- [ ] AP-12-d: `rg "rounded-2xl\|rounded-\[24px\]" src app components` â€” fix any remaining on non-pill elements
- [ ] AP-12-e: Audit any inline shadow values with blur > 20px in `src/` and `app/` â€” reduce if found
- [ ] AP-12-f: Verify bottom nav icons are `w-[26px] h-[26px]` (not `w-6 h-6`)
- [ ] AP-12-g: Verify balance text in home is `text-[34px] font-normal`
- [ ] AP-12-h: Verify no list item in Shopping, Inventory, or Documents has 2+ `<Badge` renders
- [ ] AP-12-i: Verify primary button variant has no `shadow-*` class
- [ ] AP-12-j: `npx tsc --noEmit --incremental false` â€” must pass clean with zero errors
- [ ] AP-12-k: `npx eslint` on all files touched across all phases â€” must pass clean
- [ ] AP-12-l: Update completion snapshot below
- [ ] AP-12-m: Commit: `design(phase-12): final QA pass â€” apple redesign complete`

**Phase 12 Verify:**
- [ ] All AP-12-a through AP-12-k items checked and passing
- [ ] Completion snapshot updated to 100%

---

## Completion Snapshot (Update After Each Phase)

- Total phases: `12`
- Total checklist steps: `62`
- `[x]` phases: `12`
- `[x]` steps: `62`
- Strict completion: `100%`
- Initiative status: `COMPLETED`

---

## What NOT to Change (Hard Boundary)

These are already Apple-like and must not be touched under any phase:

- Bottom nav floating pill concept and `rounded-full` container shape
- `backdrop-filter: blur(*)` on nav and sheets â€” keep as-is
- Home layered-stack design concept (only radii change in Phase 2)
- `components/ui/welcome-splash.tsx` â€” do not touch
- All `rounded-full` on pills, avatars, badges â€” keep all
- Loading spinner SVG inside button component
- Skeleton loading states in Documents inbox
- PWA manifest and Apple touch icons in `public/`
- Card component children API and structure
- Feature module architecture in `src/features/`
- All server actions in `app/actions/`
- All database and Prisma files
- All files in `lib/modules/`, `lib/config/`

---

*Playbook version: 2.0 â€” 2026-03-03*
*Companion reference: docs/active/apple-design-system.md*
