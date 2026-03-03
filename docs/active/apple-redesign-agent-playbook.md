# Apple Redesign — Agent Playbook
## Step-by-Step Implementation Guide

> **Reference:** Read `docs/active/apple-design-system.md` before executing any phase.
> **Goal:** Transform Vynance to look and feel like an Apple original iOS app.
> **Approach:** Work phase by phase. Complete and verify each phase before moving on. Never do all phases at once.

---

## How to Use This Playbook

Each phase has:
- **Scope:** Exactly which files to touch
- **Changes:** Precise instructions (old → new)
- **Verify:** How to confirm success before moving to next phase
- **Do NOT touch:** Files explicitly excluded from that phase

Work on one phase at a time. Commit after each phase with a descriptive message like `design(phase-1): remove uppercase typography`.

---

## Phase 1 — Typography: Remove All Uppercase and Tracking

**Why first:** This single change has the most visible impact on Apple aesthetics. Apple never uses uppercase text in UI labels in modern iOS.

**Estimated effort:** 2-4 hours
**Risk:** Low — purely cosmetic, no logic changes
**Files to change:** 6 core files + all form labels across pages

---

### Step 1.1 — Fix Badge Component

**File:** `components/ui/badge.tsx`

Find:
```tsx
inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase
```

Replace with:
```tsx
inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-normal
```

**Why:** `uppercase` and `tracking-wide` are the two biggest non-Apple badge violations. Change `font-semibold` to `font-medium` — Apple badges use 500 weight.

---

### Step 1.2 — Fix Button Component

**File:** `components/ui/button.tsx`

Find:
```tsx
inline-flex items-center justify-center rounded-2xl font-semibold tracking-tight
```

Replace with:
```tsx
inline-flex items-center justify-center rounded-2xl font-semibold tracking-normal
```

**Why:** Remove `tracking-tight`. Apple uses default tracking on buttons. (We fix `rounded-2xl` in Phase 2.)

---

### Step 1.3 — Fix Bottom Navigation Labels

**File:** `components/nav/bottom-nav.tsx`

Find (line ~166):
```tsx
text-[10px] font-semibold tracking-wide transition-all duration-200 capitalize
```

Replace with:
```tsx
text-[10px] font-medium tracking-normal transition-all duration-200
```

**Why:**
- Remove `tracking-wide` — Apple tab bar labels have normal tracking
- Change `font-semibold` to `font-medium` — Apple tab labels are medium weight
- Remove `capitalize` — Apple uses the label text as-is (our labels are already capitalized in the data)

---

### Step 1.4 — Fix Form Labels (Global Search)

Search the entire `src/` and `app/` directory for this pattern:
```
uppercase tracking-
```

For every match in form label elements (`<label>`, `<p>`, `<span>` used as labels), replace:
```tsx
// Pattern variations to find and fix:
"text-xs uppercase tracking-wide font-semibold text-muted"
"text-xs uppercase tracking-widest text-muted"
"text-xs uppercase tracking-[0.16em]"
"text-xs font-semibold uppercase tracking-wide"
"text-[11px] uppercase tracking-[0.2em]"
```

Replace all with the Apple label pattern:
```tsx
"text-[13px] text-muted font-normal tracking-normal"
```

**Files known to have this:**
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/onboarding/page.tsx`
- All intake pages under `app/(dashboard)/`
- `src/features/shopping/ui/`
- `src/features/inventory/ui/`
- `src/features/documents/ui/`

**Important:** Only change the label/caption elements. Do NOT change heading text (Title 1, Title 2) — those may legitimately use `font-bold` or `font-semibold`.

---

### Step 1.5 — Fix Section Headers

Throughout the app, section headers like "RECENT ACTIVITY", "QUICK ACTIONS", "INVENTORY ITEMS" are uppercase.

Search for:
```
uppercase tracking-wide
uppercase tracking-widest
```

In `<h2>`, `<h3>`, `<p className="... uppercase ...">` that are used as section headers:

Replace with:
- Keep same size but remove `uppercase` and `tracking-wide`
- Change weight to match Apple Title 2 (22pt semibold) or Title 3 (20pt regular)

Example:
```tsx
// Before
<p className="text-xs uppercase tracking-widest text-muted font-semibold">Quick Actions</p>

// After
<p className="text-sm text-muted font-medium">Quick Actions</p>
```

---

### Step 1.6 — Fix Auth Pages Specifically

**File:** `app/auth/login/page.tsx`

The "Welcome back" label at top uses something like:
```tsx
<p className="text-xs uppercase tracking-[0.16em] text-muted">Welcome back</p>
```

Change to:
```tsx
<p className="text-sm text-muted">Welcome back</p>
```

---

### Phase 1 — Verify

After all Step 1.x changes, do a final scan:
```
Search: "uppercase" in src/ and app/ and components/
```

The only remaining `uppercase` should be in:
- Tailwind config utilities (legitimate)
- Code comments
- String values (not className values)

If any `uppercase` remains in a `className` string that is UI-facing, fix it.

---

## Phase 2 — Border Radius: Reduce to Apple Scale

**Why second:** The 24px radius on non-pill elements makes the UI look "bubbly" and non-Apple.

**Estimated effort:** 1-2 hours
**Risk:** Low — purely cosmetic
**Files to change:** `button.tsx`, `card.tsx`, `globals.css`, input elements across pages

---

### Step 2.1 — Fix Button Border Radius

**File:** `components/ui/button.tsx`

Find:
```tsx
rounded-2xl
```

Replace with:
```tsx
rounded-xl
```

**Result:** 24px → 12px. This is the correct Apple button radius for medium/large buttons.

---

### Step 2.2 — Fix Card Border Radius

**File:** `components/ui/card.tsx`

Find:
```tsx
rounded-[24px]
```

Replace with:
```tsx
rounded-xl
```

**Result:** 24px → 12px.

---

### Step 2.3 — Fix Input Border Radius

Search for inputs across the codebase:
```
rounded-2xl
```
in `<input>`, `<textarea>`, `<select>` elements.

Replace all with:
```tsx
rounded-[10px]
```

**Why 10px specifically:** Apple's standard input field uses 10pt corner radius, which matches our `rounded-[10px]`.

---

### Step 2.4 — Fix Hero Card and Layer Radii

**File:** `app/globals.css`

Find:
```css
.app-hero-card {
  border-radius: 24px;
```

Change to:
```css
.app-hero-card {
  border-radius: 16px;
```

Find:
```css
.layer-summary {
  border-radius: 28px 28px 0 0;
```

Change to:
```css
.layer-summary {
  border-radius: 22px 22px 0 0;
```

Find:
```css
.layer-transactions {
  border-radius: 32px 32px 0 0;
```

Change to:
```css
.layer-transactions {
  border-radius: 22px 22px 0 0;
```

---

### Step 2.5 — Fix Inline Rounded Classes

Search the codebase for these patterns and replace:
```
rounded-[24px]  → rounded-xl  (12px)
rounded-[20px]  → rounded-xl  (12px, unless it's a sheet/modal top — keep 20px)
rounded-[16px]  → rounded-xl  (12px, unless it's a large hero — keep 16px)
```

**Exceptions — do NOT change:**
- `rounded-full` — Keep all rounded-full (pills, avatars, badges — these ARE Apple)
- Modal/sheet top corners — Keep at 20px
- The bottom nav container — Keep `rounded-full`

---

### Phase 2 — Verify

Check that `rounded-2xl` only appears on legitimate pill buttons (if any). No `rounded-[24px]` in any card or button className.

---

## Phase 3 — Shadows: Reduce to Apple Subtlety

**Why third:** Heavy shadows make the app look like Material Design, not iOS.

**Estimated effort:** 1 hour
**Risk:** Very low
**Files to change:** `app/globals.css` only (shadow values are centralized)

---

### Step 3.1 — Replace All Shadow Variables in globals.css

**File:** `app/globals.css`

Replace the dark mode surface shadows:
```css
/* OLD */
--surface-card-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
--surface-card-shadow-hover: 0 12px 28px rgba(0, 0, 0, 0.34);
--surface-nav-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
--hero-shadow: 0 16px 30px rgba(0, 60, 160, 0.28);
--sheet-shadow: 0 16px 28px rgba(0, 0, 0, 0.22);

/* NEW — dark mode uses no shadows, uses borders instead */
--surface-card-shadow: none;
--surface-card-shadow-hover: none;
--surface-nav-shadow: none;
--hero-shadow: 0 8px 20px rgba(0, 60, 160, 0.18);
--sheet-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
```

Replace the light mode surface shadows:
```css
/* OLD */
--surface-card-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
--surface-card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.09);
--surface-nav-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
--sheet-shadow: 0 8px 24px rgba(0, 0, 0, 0.07);

/* NEW — light mode uses very subtle shadows */
--surface-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04);
--surface-card-shadow-hover: 0 2px 6px rgba(0, 0, 0, 0.10), 0 6px 16px rgba(0, 0, 0, 0.06);
--surface-nav-shadow: none;
--sheet-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
```

---

### Step 3.2 — Add Visible Borders for Dark Mode Elevation

Apple communicates elevation in dark mode through **border color**, not shadow. Add borders to cards and nav.

**File:** `app/globals.css`

Change in dark mode:
```css
/* OLD */
--surface-card-border: transparent;
--surface-nav-border: transparent;
--sheet-border: transparent;

/* NEW */
--surface-card-border: rgba(255, 255, 255, 0.08);
--surface-nav-border: rgba(255, 255, 255, 0.10);
--sheet-border: rgba(255, 255, 255, 0.10);
```

---

### Step 3.3 — Remove Primary Button Colored Shadow

**File:** `components/ui/button.tsx`

Find:
```tsx
primary: "bg-primary text-white shadow-[0_6px_18px_rgba(0,127,255,0.3)] hover:bg-primary-hover",
```

Replace with:
```tsx
primary: "bg-primary text-white hover:bg-primary-hover",
```

Apple filled buttons have NO shadow. The fill communicates their prominence.

---

### Step 3.4 — Fix Nav Bar Bottom Shadow Direction

**File:** `components/nav/bottom-nav.tsx`

The nav bar currently uses a downward shadow (`0 12px 24px`). Apple tab bars use a **top hairline border** to separate from content.

Find (in the style prop):
```tsx
style={{
  background: "var(--surface-nav-bg)",
  boxShadow: "var(--surface-nav-shadow)",
}}
```

Replace with:
```tsx
style={{
  background: "var(--surface-nav-bg)",
  borderTop: "0.5px solid var(--surface-nav-border)",
}}
```

Wait — the nav is a floating pill, not a full-width bar. For a floating pill, the shadow should be a soft all-around glow, not directional. Replace the nav shadow variable with:
```css
/* In globals.css, for both dark and light */
--surface-nav-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);  /* subtle all-around */
```

And revert the bottom-nav.tsx change (keep using boxShadow var, not borderTop).

---

### Phase 3 — Verify

Visually: Cards in dark mode should look like they "float" slightly above the background, defined by a subtle border, not a heavy shadow. Light mode cards should have near-invisible shadows.

---

## Phase 4 — Interactions: Fix Press States

**Why fourth:** Scale animations on press actively feel un-Apple. iOS uses opacity reduction.

**Estimated effort:** 30 minutes
**Risk:** Low
**Files to change:** `button.tsx`, `card.tsx`

---

### Step 4.1 — Fix Button Press State

**File:** `components/ui/button.tsx`

Find:
```tsx
transition-all duration-200 active:scale-[0.98]
```

Replace with:
```tsx
transition-opacity duration-100 active:opacity-75
```

**Why `transition-opacity` not `transition-all`:** Limiting the transition scope prevents unwanted transitions on other properties.

---

### Step 4.2 — Fix Card Press State

**File:** `components/ui/card.tsx`

Find:
```tsx
active:scale-[0.995] transition-all duration-200
```

Replace with:
```tsx
active:opacity-80 transition-opacity duration-100
```

---

### Step 4.3 — Remove Hover Shadow Transitions on Cards

**File:** `components/ui/card.tsx`

Find:
```tsx
hover:border-[var(--surface-card-border-hover)] hover:shadow-[var(--surface-card-shadow-hover)]
```

Replace with:
```tsx
hover:bg-foreground/[0.02]
```

This is a very subtle background change on hover — acceptable for mouse users, invisible on touch.

---

### Phase 4 — Verify

Press a button. It should dim (opacity) but not shrink. Press a card. It should dim slightly. No scale transforms anywhere.

---

## Phase 5 — Colors: Align to Apple System Colors

**Why fifth:** Our semantic colors are Tailwind defaults, not Apple system colors.

**Estimated effort:** 1 hour
**Risk:** Low — changes CSS variables only

---

### Step 5.1 — Update Semantic Colors in globals.css

**File:** `app/globals.css`

**Dark mode (`:root`) changes:**
```css
/* OLD */
--background: #0d0d0f;
--foreground: #eef3f8;
--success: #10b981;
--warning: #f59e0b;
--danger: #ef4444;
--primary: #007fff;

/* NEW */
--background: #000000;          /* iOS systemBackground dark */
--foreground: #ffffff;           /* iOS label dark */
--success: #30d158;              /* iOS systemGreen dark */
--warning: #ff9f0a;              /* iOS systemOrange dark */
--danger: #ff453a;               /* iOS systemRed dark */
--primary: #0a84ff;              /* iOS systemBlue dark */
--primary-hover: #409cff;
```

**Light mode (`[data-theme="light"]`) changes:**
```css
/* OLD */
--background: #f5f5f7;
--success: #059669;
--warning: #d97706;
--danger: #dc2626;

/* NEW */
--background: #f2f2f7;          /* iOS systemGroupedBackground light */
--success: #34c759;              /* iOS systemGreen light */
--warning: #ff9500;              /* iOS systemOrange light */
--danger: #ff3b30;               /* iOS systemRed light */
--primary: #007aff;              /* iOS systemBlue light */
```

---

### Step 5.2 — Add Secondary Background Variables

**File:** `app/globals.css`

Add these new variables to both dark and light sections:

**Dark mode:**
```css
--background-secondary: #1c1c1e;
--background-tertiary: #2c2c2e;
--foreground-secondary: rgba(255,255,255,0.60);
--foreground-tertiary:  rgba(255,255,255,0.30);
--border: rgba(255,255,255,0.10);
```

**Light mode:**
```css
--background-secondary: #ffffff;
--background-tertiary: #f2f2f7;
--foreground-secondary: rgba(0,0,0,0.60);
--foreground-tertiary:  rgba(0,0,0,0.30);
--border: rgba(0,0,0,0.12);
```

---

### Step 5.3 — Update @theme inline Block

**File:** `app/globals.css`

Add to the `@theme inline` block:
```css
--color-background-secondary: var(--background-secondary);
--color-background-tertiary: var(--background-tertiary);
--color-foreground-secondary: var(--foreground-secondary);
--color-foreground-tertiary: var(--foreground-tertiary);
```

---

### Step 5.4 — Update Badge Color System

**File:** `components/ui/badge.tsx`

Replace the `variantStyles` object:

```tsx
// OLD — uses Tailwind arbitrary opacity colors
const variantStyles: Record<Variant, string> = {
  default:  "bg-foreground/8 text-foreground/80 border border-foreground/10",
  success:  "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  warning:  "bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  danger:   "bg-red-500/12 text-red-600 dark:text-red-400 border border-red-500/20",
  info:     "bg-[rgba(0,127,255,0.1)] text-[#007fff] border border-[rgba(0,127,255,0.2)]",
};

// NEW — Apple-style: solid fills in dark mode, tinted in light mode
// Uses semantic CSS variable colors
const variantStyles: Record<Variant, string> = {
  default:  "bg-[var(--fill-secondary)] text-[var(--foreground-secondary)]",
  success:  "bg-success/15 text-success",
  warning:  "bg-warning/15 text-warning",
  danger:   "bg-danger/15 text-danger",
  info:     "bg-primary/15 text-primary",
};
```

**Remove all `border` classes from badges** — Apple status pills do not have borders.

---

### Phase 5 — Verify

Colors should now match iOS system colors exactly. Success green should be brighter (#30d158 in dark), blue should be slightly brighter (#0a84ff in dark). The `border` on badges should be gone.

---

## Phase 6 — Bottom Navigation: Apple Tab Bar Standards

**Why sixth:** The nav bar has several non-Apple properties.

**Estimated effort:** 1-2 hours
**Files to change:** `components/nav/bottom-nav.tsx`, `app/globals.css`

---

### Step 6.1 — Reduce Nav Height from 72px to 49px

**File:** `components/nav/bottom-nav.tsx`

Find:
```tsx
className="... flex h-[72px] max-w-lg items-center ..."
```

Change to:
```tsx
className="... flex max-w-lg items-center ..."
```

Add explicit height via style:
```tsx
style={{
  height: "49px",
  background: "var(--surface-nav-bg)",
  boxShadow: "var(--surface-nav-shadow)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
}}
```

Wait — our nav is a floating pill, not a full-width tab bar. A floating pill doesn't need to match the 49px standard exactly. The 72px is the internal pill height. A more Apple-like floating pill would be:
- Height: 58-64px (includes icon + label + padding)
- Pill shape with `rounded-full` — keep this
- Keep the max-width: lg constraint

**Decision:** Keep the floating pill concept but reduce height from 72px to 62px:
```tsx
className="... flex h-[62px] max-w-lg items-center ..."
```

---

### Step 6.2 — Increase Nav Icon Size

**File:** `components/nav/bottom-nav.tsx`

Icons are currently `w-6 h-6` (24px). Change to 26px:

Find all:
```tsx
<svg className="w-6 h-6"
```

Replace with:
```tsx
<svg className="w-[26px] h-[26px]"
```

Do this for all nav icons (the app logo icon and all SVG icons).

---

### Step 6.3 — Remove Active Background Pill

**File:** `app/globals.css`

Find:
```css
--surface-nav-active-bg: rgba(0, 127, 255, 0.14);
--surface-nav-active-ring: inset 0 0 0 1px rgba(0, 127, 255, 0.24);
```

Change to:
```css
--surface-nav-active-bg: transparent;
--surface-nav-active-ring: none;
```

**File:** `components/nav/bottom-nav.tsx`

Find the active state styling on the Link element and remove any background/ring application. The active state should ONLY change color (text-primary vs text-foreground/45) — no pill background.

---

### Step 6.4 — Fix Nav Label Typography

Already handled in Phase 1.3. Double-check that nav labels are:
- `text-[10px]` — correct
- `font-medium` — correct after Phase 1
- `tracking-normal` — correct after Phase 1
- NOT uppercase — correct after Phase 1

---

### Phase 6 — Verify

The bottom nav should look like a clean frosted-glass pill with:
- Icon (26px) + label (10px medium) per tab
- Active tab: blue icon + blue label
- Inactive tab: muted icon + muted label
- No blue pill behind active icon

---

## Phase 7 — Information Architecture: Reduce Density

**Why seventh:** Some pages show too many elements simultaneously, which is not Apple's style of progressive disclosure.

**Estimated effort:** 3-5 hours per page
**Risk:** Medium — changes layout structure
**Files to change:** Shopping page, Inventory page

---

### Step 7.1 — Shopping Page Badge Reduction

**File:** `app/(dashboard)/shopping/page.tsx` and related feature files

For each item in the basket/cart, find where multiple badges are rendered per item.

**Current pattern (do not keep):**
```tsx
<Badge variant="info">staged</Badge>
<Badge variant="success">exact match</Badge>
<Badge variant="warning">UPC 012345</Badge>
<QuantityBadge quantity={3} />
```

**Target pattern (Apple: max 1 badge per item):**
```tsx
// Show ONLY the most important status badge
// Status priority: danger > warning > success > info > default
<Badge variant="success">Matched</Badge>
// Quantity shown as plain text, not a special badge component
<span className="text-sm text-muted">×3</span>
```

Move secondary info (barcode, origin) to the item detail view or a long-press menu.

---

### Step 7.2 — Inventory Page Badge Reduction

**File:** `src/features/inventory/ui/InventoryListPageClient.tsx`

Same approach: find each item card, reduce to maximum 1 status badge.

Item quantity should be displayed as plain text (`×12`) next to the item name, not as a badge.

Category should be plain secondary text, not a badge.

---

### Step 7.3 — Simplify Document Item Rows

**File:** `src/features/documents/ui/DocumentInboxClient.tsx`

Each document row currently shows: status badge + confidence badge + auto-posted badge.

**Target:** Show only the status badge. Move confidence to the detail view.

```tsx
// Remove this:
<Badge variant="info">94% confidence</Badge>
<Badge variant="success">auto-posted</Badge>

// Keep only this:
<Badge variant="success">Posted</Badge>
```

---

### Phase 7 — Verify

Each list item should have at most 1 badge. Tap into the detail to see secondary information.

---

## Phase 8 — Component Polish: Inputs and Forms

**Estimated effort:** 2-3 hours
**Risk:** Low

---

### Step 8.1 — Remove Input Inset Shadow

Search for:
```
shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]
```

Remove this class entirely from all inputs. Apple inputs have no inset shadows.

---

### Step 8.2 — Update Input Background

Apple inputs use the system fill:

Find input className patterns and update background from:
```tsx
bg-foreground/[0.04]
```

To:
```tsx
bg-[var(--fill-tertiary)]
```

This maps to `rgba(118,118,128,0.24)` which is the Apple `tertiarySystemFill` — exactly correct for input field backgrounds.

---

### Step 8.3 — Standardize Input Focus Style

Remove focus rings from inputs (Apple uses no focus ring — the field label changes color):

Find:
```tsx
focus:ring-2 focus:ring-primary/25
```

Replace with:
```tsx
focus:outline-none
```

This matches iOS behavior where there's no visible ring around focused inputs.

---

### Phase 8 — Verify

Inputs should look clean — background fill, no border (dark mode), no inset shadow, no focus ring.

---

## Phase 9 — Home Dashboard Refinement

**Estimated effort:** 2-3 hours
**Risk:** Medium — touches core home UI

---

### Step 9.1 — Remove Watermark Logo

**File:** `src/features/home/ui/HomeDashboardClient.tsx` (or wherever the watermark is rendered)

Find the low-opacity logo/watermark in the hero section:
```tsx
// Something like:
<div className="absolute ... opacity-[0.18] ...">
  <Logo />
</div>
```

Remove it entirely. Apple does not use watermarks behind content.

---

### Step 9.2 — Reduce Hero Balance Text

The current balance display uses 44px bold. Apple's Wallet app uses:
- Amount: 34pt (Large Title) Regular weight

Find the balance amount display:
```tsx
// Something like:
<p className="text-[44px] font-bold ...">${balance}</p>
```

Change to:
```tsx
<p className="text-[34px] font-normal tracking-tight ...">${balance}</p>
```

---

### Step 9.3 — Home Quick Action Buttons

The "Add Receipt" and "Scan Barcode" quick actions are pill-shaped buttons. In Apple's style (Wallet app):

- Use the **tinted button style** (not solid primary)
- Keep `rounded-full` for pill shape (this is correct for this case)
- White text on primary-tinted background

```tsx
// Target style:
className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
```

---

### Phase 9 — Verify

Home screen should feel clean. Large balance number, subtle layer transitions, no watermark.

---

## Phase 10 — Nav Bar and Page Headers

**Estimated effort:** 2-3 hours

---

### Step 10.1 — Update Page Header Typography

**File:** `components/nav/page-header.tsx`

Find the page title rendering:
```tsx
// Something like:
<h1 className="text-2xl font-bold">
```

Change to:
```tsx
<h1 className="text-[28px] font-semibold tracking-tight">
```

**Why:** Apple Title 1 is 28pt semibold for page-level titles (when not using Large Title mode).

---

### Step 10.2 — Page Header Back Button Style

Apple back buttons are:
- Primary blue color
- `‹` chevron or `chevron.left` SF Symbol
- "Back" text or previous screen name
- No background, no border, no pill

Ensure the back button in `page-header.tsx` is:
```tsx
<button className="flex items-center gap-1 text-primary text-[17px] font-normal -ml-1">
  <ChevronLeftIcon className="w-5 h-5 stroke-[2.5]" />
  <span>Back</span>
</button>
```

---

### Phase 10 — Verify

Page headers should look like iOS navigation bars — clean, no border unless scrolled, title in semibold, back button in blue.

---

## Phase 11 — Auth Pages Final Polish

**Estimated effort:** 1-2 hours

---

### Step 11.1 — Reduce Sheet Card Styling

**File:** `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`

The `.app-sheet` class has `ring-1 ring-primary/10`. This subtle ring is non-Apple. Remove it.

Find any `ring-1 ring-primary/10` or similar on the auth card wrapper.

Replace with just the standard card class without the ring.

---

### Step 11.2 — Fix Auth Form Layout

Apple form layout for auth screens:
1. App logo (centered, 60-80px)
2. Large title: "Sign In" (not "Welcome back" — that's secondary text below)
3. Large title: 28pt semibold (Title 1)
4. Subtitle: 17pt regular, secondaryLabel color
5. Form fields (labeled, stacked)
6. Primary CTA button (full width, 50px height)
7. Secondary action link below button

Ensure the auth pages follow this hierarchy. The "Welcome back" text should be the subtitle (smaller, muted), not the main label.

---

## Phase 12 — Final Audit and QA

**After all phases are complete:**

### Checklist

**Typography**
- [ ] Zero `uppercase` in UI classNames
- [ ] Zero `tracking-wide` / `tracking-widest` in UI classNames
- [ ] All form labels: `text-[13px] font-normal tracking-normal text-muted`
- [ ] All badges: no uppercase, no tracking-wide
- [ ] Nav labels: `text-[10px] font-medium tracking-normal`
- [ ] Page titles: `text-[28px] font-semibold`

**Border Radius**
- [ ] All buttons: `rounded-xl` (12px) or `rounded-full` (pills only)
- [ ] All cards: `rounded-xl` (12px)
- [ ] All inputs: `rounded-[10px]`
- [ ] Hero card: 16px
- [ ] Layer radii: 22px top

**Shadows**
- [ ] Dark mode card: no shadow (border only)
- [ ] Light mode card: subtle double shadow
- [ ] Primary button: no shadow
- [ ] Nav: soft 4px shadow (floating pill)

**Interactions**
- [ ] No `active:scale-*` anywhere
- [ ] All interactive elements: `active:opacity-75`
- [ ] No hover shadow transitions

**Colors**
- [ ] Dark primary: `#0a84ff`
- [ ] Light primary: `#007aff`
- [ ] Dark success: `#30d158`
- [ ] Dark danger: `#ff453a`
- [ ] Badge borders: removed

**Navigation**
- [ ] Nav icons: 26px
- [ ] Nav labels: 10px medium, normal tracking
- [ ] Active state: color only (no background)

**Information Density**
- [ ] Max 1 badge per list item
- [ ] No watermark in hero
- [ ] Confidence/secondary info moved to detail views

---

## Implementation Order Summary

| Phase | What | Effort | Risk |
|-------|------|--------|------|
| 1 | Remove uppercase & tracking | 2-4h | Low |
| 2 | Fix border radius | 1-2h | Low |
| 3 | Fix shadows | 1h | Very Low |
| 4 | Fix press states | 30m | Very Low |
| 5 | Align system colors | 1h | Low |
| 6 | Fix bottom nav | 1-2h | Low |
| 7 | Reduce badge density | 3-5h | Medium |
| 8 | Fix inputs | 2-3h | Low |
| 9 | Home dashboard | 2-3h | Medium |
| 10 | Nav bar headers | 2-3h | Low |
| 11 | Auth pages | 1-2h | Low |
| 12 | QA checklist | 1-2h | None |

**Total estimated: 18-32 hours of agent work**

---

## What NOT to Change

These elements are already Apple-like and should NOT be touched:
- Bottom nav floating pill concept (just resize it)
- Backdrop blur on nav and sheets
- Home layered-stack design concept (just fix radii)
- Welcome splash animation
- Card component structure
- Feature module architecture
- PWA manifest and Apple touch icons
- The primary blue color direction
- Rounded-full on pills and badges (shape is correct)
- Loading spinner in buttons
- Skeleton loading states in Documents

---

*Playbook version: 1.0 — 2026-03-03*
*Companion to: docs/active/apple-design-system.md*
