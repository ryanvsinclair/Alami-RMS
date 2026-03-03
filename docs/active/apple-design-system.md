# Apple Design System — Vynance Reference Document

> **Purpose:** This document is the single source of truth for transforming Vynance's visual and interaction design to match Apple's native iOS aesthetic. It combines deep research into Apple's Human Interface Guidelines (HIG), a full audit of the current codebase, and a precise page-by-page gap analysis.

---

## Table of Contents

1. [Apple HIG Core Principles](#1-apple-hig-core-principles)
2. [Apple Visual Foundation — Exact Specifications](#2-apple-visual-foundation--exact-specifications)
3. [Apple Navigation Patterns](#3-apple-navigation-patterns)
4. [Apple Component Specifications](#4-apple-component-specifications)
5. [Apple Interaction Language](#5-apple-interaction-language)
6. [Current App Audit — Page by Page](#6-current-app-audit--page-by-page)
7. [Current Design System Inventory](#7-current-design-system-inventory)
8. [Gap Analysis — What is Non-Apple](#8-gap-analysis--what-is-non-apple)
9. [Target Design Tokens](#9-target-design-tokens)
10. [Agent Implementation Guide — Step by Step](#10-agent-implementation-guide--step-by-step)

---

## 1. Apple HIG Core Principles

Apple's design philosophy is built on three foundational pillars:

### 1.1 Clarity
- Text is legible at every size
- Icons are precise and lucid
- Adornments are subtle and appropriate
- A focus on functionality motivates the design

### 1.2 Deference
- Fluid motion and crisp, beautiful interface help people understand and interact without competing with content
- Content typically fills the entire screen; translucency and blurring often hint at more

### 1.3 Depth
- Distinct visual layers and realistic motion convey hierarchy
- Touch and discoverability heighten delight and enable access to functionality without loss of context

### 1.4 What These Mean Practically

| Principle | What it Forbids | What it Demands |
|-----------|----------------|-----------------|
| Clarity | Uppercase labels, excessive tracking, busy backgrounds | Sentence case, SF Pro text hierarchy, clean white/system-gray backgrounds |
| Deference | Decorative chrome, aggressive shadows, scale animations | Content-first layouts, translucent materials over white/dark, no scale transforms |
| Depth | Flat cards without meaning, uniform elevations | Layered materials (blur), meaningful elevation hierarchy, spring physics |

---

## 2. Apple Visual Foundation — Exact Specifications

### 2.1 Typography System

Apple uses **SF Pro** (San Francisco) with a strict Dynamic Type scale. We map to Inter (our current font) with equivalent sizing.

#### Dynamic Type Scale (iOS 17+)

| Style | Size (pt) | Weight | Leading (pt) | Use Case |
|-------|-----------|--------|--------------|---------|
| Large Title | 34 | Regular (400) | 41 | Hero balance, splash screen title |
| Title 1 | 28 | Regular (400) | 34 | Page titles (large title mode) |
| Title 2 | 22 | Regular (400) | 28 | Section headers |
| Title 3 | 20 | Regular (400) | 25 | Card primary labels |
| Headline | 17 | Semibold (600) | 22 | List item titles, button labels |
| Body | 17 | Regular (400) | 22 | Default body text |
| Callout | 16 | Regular (400) | 21 | Subtitles, helper text |
| Subhead | 15 | Regular (400) | 20 | Secondary descriptions |
| Footnote | 13 | Regular (400) | 18 | Fine print, captions |
| Caption 1 | 12 | Regular (400) | 16 | Timestamps, metadata |
| Caption 2 | 11 | Regular (400) | 13 | Badge labels, micro-text |

#### Typography Rules (Critical)
- **NEVER use `uppercase` on UI text** — Apple uses sentence case everywhere
- **NEVER use `tracking-wide`, `tracking-wider`, `tracking-widest`** — Apple uses default or `tracking-normal`
- Font weight communicates hierarchy, not capitalization
- `font-semibold` (600) is reserved for Headline style and button labels only
- Labels under inputs use Caption 1 (12pt) in secondary color — NOT bold, NOT uppercase

### 2.2 Color System

#### Semantic System Colors (Light / Dark)

| Token Name | Light Mode | Dark Mode | Usage |
|------------|-----------|-----------|-------|
| systemBlue | `#007AFF` | `#0A84FF` | Primary actions, links, active states |
| systemGreen | `#34C759` | `#30D158` | Success, confirmations |
| systemRed | `#FF3B30` | `#FF453A` | Destructive actions, errors |
| systemOrange | `#FF9500` | `#FF9F0A` | Warnings |
| systemGray | `#8E8E93` | `#8E8E93` | Secondary labels, disabled |
| systemGray2 | `#AEAEB2` | `#636366` | Tertiary labels |
| systemGray3 | `#C7C7CC` | `#48484A` | Borders, dividers |
| systemGray4 | `#D1D1D6` | `#3A3A3C` | Filled controls background |
| systemGray5 | `#E5E5EA` | `#2C2C2E` | Secondary background |
| systemGray6 | `#F2F2F7` | `#1C1C1E` | Grouped table background |

> **Note:** Our current `#007fff` primary blue is close to Apple's `#007AFF`. Keep it. Our `#0d0d0f` dark background maps to near `#000000` (iOS true dark). This is correct.

#### Background Layering System

Apple uses a strict two-stack background system:

**Standard Stack (non-grouped views)**
```
Layer 0: systemBackground       — white / #000000
Layer 1: secondarySystemBackground — #F2F2F7 / #1C1C1E
Layer 2: tertiarySystemBackground  — #FFFFFF / #2C2C2E
```

**Grouped Stack (settings-style views)**
```
Layer 0: systemGroupedBackground    — #F2F2F7 / #000000
Layer 1: secondaryGroupedBackground — #FFFFFF / #1C1C1E
Layer 2: tertiaryGroupedBackground  — #F2F2F7 / #2C2C2E
```

#### Label Hierarchy
```
Primary label:   foreground full opacity    — #000000 / #FFFFFF
Secondary label: foreground at 60%          — rgba(0,0,0,0.6) / rgba(255,255,255,0.6)
Tertiary label:  foreground at 30%          — rgba(0,0,0,0.3) / rgba(255,255,255,0.3)
Quaternary label: foreground at 18%         — rgba(0,0,0,0.18) / rgba(255,255,255,0.18)
```

### 2.3 Spacing and Layout

Apple uses an **8pt base grid** exclusively.

#### Standard Spacing Tokens
```
spacing-1:  4pt   — icon gap, micro spacing
spacing-2:  8pt   — compact row padding, icon-to-label gap
spacing-3: 12pt   — tight list item padding
spacing-4: 16pt   — standard content padding (most used)
spacing-5: 20pt   — comfortable section padding
spacing-6: 24pt   — section gap
spacing-8: 32pt   — major section separation
```

#### Layout Margins
- **Horizontal content margin:** 16pt (iPhone standard), 20pt (iPhone Plus/Max)
- **Safe area:** Always respected — content never behind home indicator
- **Card internal padding:** 16pt
- **List item height:** 44pt minimum (touch target requirement)

### 2.4 Corner Radius System

Apple uses the **continuous curve** (squircle) corner style, not standard circular arcs.

| Component | Corner Radius | Notes |
|-----------|--------------|-------|
| App icons | 22pt | System-managed |
| Large cards / hero | 16pt | Never exceed this |
| Standard cards | 12pt | Most common |
| Buttons (standard) | 10pt | Height-dependent |
| Buttons (pill shape) | `borderRadius = height / 2` | For tag-style buttons only |
| Input fields | 10-12pt | |
| Badges / tags | `rounded-full` | Small elements only |
| Alert sheets | 14pt | |
| Action sheets | 20pt at top only | |
| Bottom sheet | 20pt at top | |
| Segmented control | 9pt | |

> **Key Rule:** The larger the container, the smaller the effective radius appears. 24px radius on a button looks "bubbly" — reduce to 10-12px.

### 2.5 Shadow System

Apple uses extremely subtle shadows. Heavy shadows are a non-Apple pattern.

#### Shadow Tokens

```css
/* Floating elements (modals, sheets) */
shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.12)

/* Cards and grouped containers */
shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06)

/* Light mode only — dark mode uses borders instead */
shadow-card-light: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.06)

/* Navigation / tab bar */
shadow-nav: 0 -1px 0 rgba(0, 0, 0, 0.08)  /* top border only on light mode */

/* No shadow in dark mode — use borders or materials instead */
```

> **Rule:** In dark mode, elevation is communicated through **background color lightness** (darker = lower, lighter = higher) — NOT through shadows. In light mode, subtle shadows can indicate elevation.

### 2.6 Materials and Translucency

Apple's material system (used for nav bars, sheets, alerts):

```
ultraThinMaterial:   backdrop-blur(20px) + white/8% (dark) or white/72% (light)
thinMaterial:        backdrop-blur(20px) + white/12% (dark) or white/82% (light)
regularMaterial:     backdrop-blur(20px) + white/18% (dark) or white/88% (light)
thickMaterial:       backdrop-blur(20px) + white/24% (dark) or white/94% (light)
ultraThickMaterial:  backdrop-blur(20px) + white/32% (dark) or white/96% (light)
```

**CSS Implementation:**
```css
/* Tab bar / nav bar material */
.material-regular-dark  { background: rgba(28, 28, 30, 0.82); backdrop-filter: blur(20px); }
.material-regular-light { background: rgba(242, 242, 247, 0.85); backdrop-filter: blur(20px); }

/* Bottom sheet / action sheet material */
.material-thick-dark  { background: rgba(28, 28, 30, 0.94); backdrop-filter: blur(20px); }
.material-thick-light { background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(20px); }
```

---

## 3. Apple Navigation Patterns

### 3.1 Tab Bar (Bottom Navigation)

**Specification:**
- Height: **49pt** (not 72px — we are using 72px which is too tall)
- Background: regularMaterial (see above)
- Icons: 25pt × 25pt (portrait), filled when active, outlined when inactive
- Labels: 10pt, not bold, not uppercase, not letter-spaced
- Active: icon + label both switch to systemBlue
- No background pill behind active icon — iOS 17+ removed it
- Separator: single top hairline (0.5pt / 1px) at border/15% opacity
- Safe area: background extends below safe area

**Tab Bar — Exact CSS Target:**
```css
height: 49px + safe-area-inset-bottom
border-top: 0.5px solid rgba(0,0,0,0.12)  /* light mode */
border-top: 0.5px solid rgba(255,255,255,0.1)  /* dark mode */
background: material-regular
padding: 4px 0 0 0
icon size: 26px (our target)
label: 10px, font-weight: 500, letter-spacing: normal
```

### 3.2 Navigation Bar (Top Header)

**Inline title (compact):**
- Height: 44pt
- Title: 17pt semibold, centered or leading
- Back button: system blue chevron + back title

**Large title:**
- Title: 34pt Regular weight
- Collapses to inline on scroll
- Background: systemBackground or material

**Key Rules:**
- Navigation title is NEVER `text-2xl font-bold` (current) — use Large Title 34pt Regular
- Page section headers use Title 2 (22pt) or Title 3 (20pt)

### 3.3 Modal Sheets

```
Half sheet (.medium detent):  covers ~50% of screen
Large sheet (.large detent):  covers ~92% of screen, with drag handle

Visual:
- Corner radius: 20pt at top only
- Drag indicator: 36×5pt pill, foreground/30%, centered
- Background: thick material
- Top safe area: not respected (sheet is modal)
```

### 3.4 Context Menus and Action Sheets

- Long press → context menu with preview
- Destructive actions: red text, always last in menu
- Confirmation: only for irreversible destructive actions
- Action sheets appear from bottom with cancel button separated

---

## 4. Apple Component Specifications

### 4.1 Buttons

#### Four Official Styles

| Style | Background | Use When |
|-------|-----------|---------|
| Filled | systemBlue / semantic | Primary, single-action pages |
| Tinted | systemBlue/15% bg + blue text | Secondary actions near a primary |
| Gray | systemGray5 bg + foreground text | Neutral, non-semantic actions |
| Plain | transparent + tinted text | Tertiary, list row accessory |

#### Size Specifications
```
Large:   height 50pt, horizontal padding 20pt, corner radius 12pt
Medium:  height 44pt, horizontal padding 16pt, corner radius 10pt
Small:   height 32pt, horizontal padding 12pt, corner radius 8pt
Mini:    height 24pt, horizontal padding 8pt,  corner radius 6pt
```

#### Button Typography
- Label: Headline style (17pt Semibold) for large/medium
- Label: Subhead style (15pt Semibold) for small

#### Press State (Critical)
- **NO scale transform** — Apple does NOT scale buttons on press
- Instead: opacity drops to 0.7-0.8 on press (done via opacity transition, not background change for filled)
- Duration: 100ms ease-in

```css
.btn-apple {
  transition: opacity 100ms ease;
}
.btn-apple:active {
  opacity: 0.75;
}
/* Remove: active:scale-[0.98] */
```

### 4.2 Lists and Table Views

#### Inset Grouped Style (most common in iOS apps)
```
Outer margin:     16pt horizontal
Corner radius:    10pt on the grouped section container
Background:       secondaryGroupedBackground (white / #1C1C1E)
Row height:       44pt minimum
Row separator:    1px, systemGray4 color, starting at 16pt inset (not full-width)
Disclosure arrow: 8×13pt chevron.right, systemGray3
```

#### List Row Anatomy
```
[16pt] [icon 28pt] [8pt] [title Body/Headline] ——> [detail Subhead muted] [8pt] [chevron] [16pt]
Row height: 44-54pt
```

### 4.3 Cards

Apple's card treatment is much simpler than what we have:

```css
/* iOS card */
.card-apple {
  background: secondaryGroupedBackground;  /* white in light, #1C1C1E in dark */
  border-radius: 12px;
  padding: 16px;
  /* Light mode only: */
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
  /* Dark mode: no shadow, background lightness communicates elevation */
}
```

No hover shadow transitions. No active scale. Just subtle resting shadow.

### 4.4 Input Fields

Apple input fields have TWO styles:

**Rounded Rectangle (default for forms):**
```css
height: 44px;
background: systemGray6 (#F2F2F7 light / #1C1C1E dark);
border-radius: 10px;
padding: 0 12px;
font-size: 17px;  /* Body style */
border: none;  /* No border — background communicates the field */
/* On focus: no ring, just content appears */
```

**Outline Style (search, secondary):**
```css
height: 36px;
background: systemGray6;
border-radius: 10px;
/* Rounded search with magnifier icon */
```

**Label above field:**
```css
font-size: 13px;  /* Footnote */
color: secondaryLabel;
font-weight: 400;  /* NOT bold */
text-transform: none;  /* NEVER uppercase */
letter-spacing: normal;  /* NEVER tracking-wide */
margin-bottom: 6px;
```

### 4.5 Badges and Tags

Apple uses badges minimally:

**Notification Badge (count on icon):**
- Background: systemRed
- Text: white, 12pt bold
- Size: 18pt minimum, scales with content
- Position: top-right of icon

**Status Pills (inline):**
- Background: semantic color at 12-15% opacity (light) or full solid (dark)
- Text: semantic color (NOT uppercase, NOT letter-spaced)
- Radius: `rounded-full`
- Padding: `px-2 py-0.5`
- Text size: 12pt (Caption 1)
- Font weight: 500 (Medium) — NOT semibold, NOT uppercase

```css
/* Apple-style badge */
.badge-success {
  background: rgba(52, 199, 89, 0.12);  /* light mode */
  color: #34C759;
  /* dark mode: solid #30D158 with white text */
  border-radius: 9999px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
}
```

**Maximum badges per item: 1 (never 2+)**

### 4.6 Segmented Control

```css
height: 32px;
background: systemGray5 (#E5E5EA / #2C2C2E);
border-radius: 9px;
/* Selected segment */
selected-bg: white (light) / #3A3A3C (dark);
selected-shadow: 0 1px 2px rgba(0,0,0,0.12);
/* Text: 13pt Semibold */
/* Max 5 segments on iPhone */
```

---

## 5. Apple Interaction Language

### 5.1 Animation Principles

Apple uses **spring physics** for all meaningful animations:

```
Standard spring:    stiffness: 300, damping: 30  (0.25-0.35s)
Snappy spring:      stiffness: 400, damping: 25  (0.2-0.25s)
Gentle spring:      stiffness: 200, damping: 30  (0.35-0.5s)
```

**CSS equivalent (spring approximation):**
```css
transition: all 250ms cubic-bezier(0.2, 0, 0, 1);      /* standard */
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);    /* snappy */
transition: all 350ms cubic-bezier(0.34, 1.56, 0.64, 1); /* bouncy */
```

#### What to Animate (Apple does)
- Page transitions (slide from right)
- Sheet presentation (slide from bottom)
- List insertions/deletions (expand/collapse)
- Tab switches (fade)
- Content loading (fade-in)

#### What NOT to Animate (Apple avoids)
- Button scale on press
- Card hover shadows
- Background color transitions on hover (no hover on touch)
- Border color transitions on focus

### 5.2 Press / Tap States

```css
/* The ONLY press feedback Apple uses for most controls */
:active { opacity: 0.75; transition: opacity 100ms ease; }

/* For list rows */
:active { background: rgba(0,0,0,0.06) (light) / rgba(255,255,255,0.08) (dark); }
```

**Remove all:**
- `active:scale-[0.98]` — not Apple
- `active:scale-[0.995]` — not Apple
- `hover:shadow-*` — no hover states on touch UI

### 5.3 Loading States

| Duration | Pattern |
|---------|---------|
| < 300ms | No indicator needed |
| 300ms – 2s | Spinner (activity indicator) |
| > 2s or known length | Progress bar |
| Content replacement | Skeleton screens with shimmer |

Apple skeleton shimmer:
```css
@keyframes shimmer {
  from { background-position: -200% 0; }
  to   { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.05) 25%,
    rgba(255,255,255,0.1) 50%,
    rgba(255,255,255,0.05) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}
```

### 5.4 Empty States

Apple empty states have three parts:
1. **SF Symbol** — large, muted color (~60pt, foreground/25%)
2. **Headline** — Title 3 (20pt), centered, foreground
3. **Description** — Body (17pt), centered, secondaryLabel, max 2 lines
4. **Action button** — optional, tinted style

### 5.5 Haptic Feedback Triggers

| Haptic Type | When to Trigger |
|------------|----------------|
| `selection` (light) | Picker scroll, segmented control change |
| `impact-light` | Appearing modal, successful scan |
| `impact-medium` | Button press for major action |
| `impact-heavy` | Destructive action confirmation |
| `notification-success` | Transaction completed |
| `notification-warning` | Soft error, validation issue |
| `notification-error` | Hard error, failed action |

---

## 6. Current App Audit — Page by Page

### 6.1 Home Dashboard (`/`)

**Purpose:** Financial overview — balance, income, spending, recent transactions

**Current Patterns:**
- Stacked layer design (blue hero → dark layer 2 → card layer 3)
- Large balance display (44px/font-bold)
- Top bar: profile, search, reports, contacts
- Quick actions: "Add Receipt", "Scan Barcode"
- Layer border radii: 28px, 32px (excessive)

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Layer top radius | 28px, 32px | 20px |
| Hero section radius | 24px | 16px |
| Balance font size | 44px bold | Large Title 34pt regular |
| Quick action buttons | `rounded-full pill` | Acceptable for this use case |
| Section labels | uppercase + tracking-widest | Sentence case, normal tracking |
| Top bar icon size | 24px | 26-28px |
| Balance toggle button | `rounded-full` with border | Tinted segmented control |
| Watermark opacity | 18% | Remove (not Apple pattern) |

**Verdict:** Strong conceptual direction but over-engineered radii and typography.

---

### 6.2 Authentication (`/auth/login`, `/auth/signup`)

**Purpose:** Email/password sign-in, sign-up flow

**Current Patterns:**
- Centered form card (`app-sheet`)
- Small uppercase label ("Welcome back")
- Large title (text-3xl)
- Full-width inputs and button
- Ring border on sheet (`ring-1 ring-primary/10`)

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| "WELCOME BACK" label | `uppercase tracking-[0.16em]` | Sentence case "Welcome back" |
| Input border radius | 24px | 10-12px |
| Primary button radius | 24px | 12px |
| Primary button shadow | `shadow-[0_6px_18px_rgba(0,127,255,0.3)]` | No shadow — Apple filled buttons have no shadow |
| Sheet ring | `ring-1 ring-primary/10` | Remove ring — use card background |
| Form label style | bold uppercase | 13pt regular sentence case |

**Verdict:** Layout is correct (centered card), styling is off.

---

### 6.3 Onboarding (`/onboarding/*`)

**Purpose:** Business setup, income source selection, multi-step flow

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Step indicators | Unknown — needs audit | `Capsule` shaped progress, or numbered breadcrumbs |
| Card selection | Large bordered cards | Inset grouped list with checkmarks |
| CTA button placement | Full-width bottom | Fixed to bottom safe area, full-width |
| Progress | None seen | Top progress bar or step count |

**Verdict:** Needs specific audit — likely has similar radius/typography issues.

---

### 6.4 Intake Hub (`/intake`)

**Purpose:** Choose between live purchase vs bulk intake

**Current Patterns:**
- Large intent cards with icon, title, description, right chevron
- Color-coded icons (blue, green)

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Intent cards | 24px radius | 12px radius |
| Chevron icon | Heroicons chevron-right | Standard `›` or custom 10×16pt chevron |
| Card shadow | `var(--surface-card-shadow)` | Very subtle or none |
| Section header | Likely uppercase | Title 2 (22pt), sentence case |

**Verdict:** Pattern is correct (Inset Grouped list style). Fix radius and typography only.

---

### 6.5 Shopping — Live Purchase (`/shopping`)

**Purpose:** Real-time inventory intake with store selection, barcode scan, basket management

**Current Patterns:**
- Store selection with Google Places
- Barcode scanner card
- Shelf label card
- Items basket (with multiple status badges per item)
- Fixed bottom commit panel with gradient background

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Multiple simultaneous cards | 7+ visible at once | Collapsible sections, 2 primary visible |
| Item badges | 4 per item (origin, status, barcode, quantity) | 1 per item maximum |
| Bottom commit panel | Gradient + inset ring + heavy shadow | Solid background + single top border |
| Basket card radius | 24px | 12px |
| Badge text | `uppercase tracking-wide` | Sentence case, normal spacing |
| Button shadows | `shadow-[0_6px_18px_...]` | No color shadows |
| "Active" / "Staged" text | All-caps badge | Pill with sentence case |

**Verdict:** Most work needed here — information architecture must also be simplified.

---

### 6.6 Inventory (`/inventory`)

**Purpose:** Inventory list + enrichment queue management

**Current Patterns:**
- "Fix Later Queue" card at top
- Filter toggle (All / Purchase confirmation)
- Grid/list view toggle
- Item cards with image, name, quantity, category badges

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Queue card | Complex multi-stat card | Simple list row with count badge |
| Multiple badge types | info, warning, danger simultaneously | 1 status badge |
| Grid/list toggle | Custom control | SF segmented control style |
| Item card radius | 24px | 12px |
| Section header | Uppercase | Title 3 (20pt) sentence case |
| View toggle | Two separate buttons | Segmented control (2 options) |

**Verdict:** Architecture is fine, excessive visual decoration.

---

### 6.7 Documents Inbox (`/documents`)

**Purpose:** Document pipeline — draft inbox, filter, review, post

**Current Patterns:**
- Hero section with title + analytics link
- Horizontal filter pills
- List cards: vendor, date, total, status, confidence
- Skeleton loading states

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Filter pills | `uppercase tracking-wide` text | Sentence case, normal spacing |
| Card badges | 3 simultaneous (status + confidence + auto-post) | 1 visible, rest in detail view |
| Card hover | border-color transition | Background highlight on press |
| Confidence badge | Percentage in badge | Plain secondary text "94% confidence" |
| Analytics link | Button in hero | Navigation bar trailing button |
| Hero section | Elaborate multi-line | Simple nav bar with large title |

**Verdict:** Good architecture. Remove badge overload and uppercase text.

---

### 6.8 Schedule (`/schedule`)

**Purpose:** Operational calendar, event management

**Apple Gap Analysis:**
- Calendar views: use weekly/monthly grid — Apple uses compact header date selector
- Event creation: full sheet, Apple-standard form layout
- Likely has same radius/typography issues

---

### 6.9 Service — Host/Kitchen Workspaces (`/service/*`)

**Purpose:** Restaurant table management, order flow, kitchen display

**Apple Gap Analysis:**
- Table grid: custom layout — Apple uses collection view grid
- Status badges on tables: should be minimal (Available / Occupied — no uppercase)
- Kitchen view: order cards should use high-contrast, minimal-chrome design for glanceable use

---

### 6.10 Profile (`/profile`)

**Purpose:** User account, settings, theme toggle, logout

**Apple Gap Analysis:**
- Likely uses settings-style list — which is correct Apple pattern
- Needs inset-grouped styling (not flat card list)
- Theme toggle: use segmented control, not custom buttons

---

### 6.11 Integrations (`/integrations`)

**Purpose:** OAuth connections — DoorDash, Uber Eats, GoDaddy POS

**Current Patterns:**
- Connection cards with logo, provider name, connect/disconnect button
- Status badges

**Apple Gap Analysis:**
| Issue | Current | Apple Target |
|-------|---------|-------------|
| Connection card | 24px radius | 12px, inset-grouped row |
| Status badge | Uppercase, bordered | Sentence case, filled |
| Connect button | Primary with shadow | Tinted style (blue bg/15%, blue text) |

---

## 7. Current Design System Inventory

### 7.1 Color Tokens (Current)

```css
/* Dark mode (default) */
--background: #0d0d0f          /* Near-black — correct */
--foreground: #eef3f8          /* Blue-tinted white — slightly off (Apple uses pure #FFFFFF) */
--primary: #007fff             /* Close to Apple systemBlue — keep */
--primary-hover: #0070e6       /* Fine */
--success: #10b981             /* Tailwind emerald — vs Apple #34C759 — adjust */
--warning: #f59e0b             /* Tailwind amber — vs Apple #FF9500 — adjust */
--danger: #ef4444              /* Tailwind red — vs Apple #FF3B30 — adjust */
--muted: #808088               /* Close to Apple systemGray — keep */
--border: #242428              /* Good dark border */
--card: #161618                /* Good dark card bg */

/* Surface shadows — ALL TOO HEAVY */
--surface-card-shadow: 0 10px 24px rgba(0,0,0,0.28)     /* 10x too strong */
--surface-nav-shadow:  0 12px 24px rgba(0,0,0,0.28)     /* replace with top border */
```

### 7.2 Component Tokens (Current vs Target)

| Component | Current Radius | Target Radius | Current Shadow | Target Shadow |
|-----------|--------------|--------------|----------------|--------------|
| Button | 24px (`rounded-2xl`) | 12px (`rounded-xl`) | `0 6px 18px rgba(0,127,255,0.3)` | none |
| Card | 24px | 12px (`rounded-xl`) | `0 10px 24px rgba(0,0,0,0.28)` | `0 2px 8px rgba(0,0,0,0.06)` |
| Input | 24px | 10px | inset shadow | none |
| Badge | `rounded-full` | `rounded-full` | none | none |
| Bottom Nav | `rounded-full` | stay | `0 12px 24px rgba(0,0,0,0.28)` | `0 4px 16px rgba(0,0,0,0.12)` |
| Sheet | N/A | N/A | `0 16px 28px rgba(0,0,0,0.22)` | `0 4px 16px rgba(0,0,0,0.12)` |
| Hero card | 24px | 16px | `0 16px 30px rgba(0,60,160,0.28)` | `0 8px 20px rgba(0,60,160,0.18)` |
| Layer-summary | 28px top | 22px top | none | none |
| Layer-transactions | 32px top | 22px top | none | none |

### 7.3 Typography Tokens (Current Problems)

| Location | Current Class | Problem | Fix |
|---------|-------------|---------|-----|
| Form labels | `text-xs uppercase tracking-wide font-semibold` | 3 Apple violations | `text-[13px] text-muted normal-case tracking-normal font-normal` |
| Badge text | `text-[11px] uppercase tracking-wide font-semibold` | 2 Apple violations | `text-[11px] normal-case tracking-normal font-medium` |
| Nav labels | `text-[10px] font-semibold tracking-wide capitalize` | `tracking-wide` | `text-[10px] font-medium tracking-normal` |
| Section headers | varies — often uppercase | uppercase | `text-[22px] font-semibold` (Title 2) |
| Page titles | `text-2xl font-bold` | bold on title | `text-[28px] font-semibold` |
| Button labels | `font-semibold tracking-tight` | `tracking-tight` | `font-semibold tracking-normal` |

---

## 8. Gap Analysis — What is Non-Apple

### 8.1 Critical Issues (Destroy the Apple Feel)

#### C1 — Uppercase Typography
**Files affected:** `badge.tsx`, `button.tsx`, `bottom-nav.tsx`, every form label across 37 pages

Apple **never** uses uppercase for UI labels in modern iOS (iOS 13+). It was used in iOS 6-era design.

Evidence in code:
- `badge.tsx:23` — `uppercase tracking-wide`
- `bottom-nav.tsx:166` — `tracking-wide capitalize`
- Form labels everywhere — `uppercase tracking-[0.16em]`

**Impact score: 10/10** — this alone makes the app feel non-Apple.

#### C2 — Border Radius 24px on Non-Pill Elements
**Files affected:** `button.tsx:31`, `card.tsx:14`, inputs across all pages

Apple's `rounded-2xl` (24px) is reserved for **icons only** in the iOS system. All buttons, cards, and inputs use 10-14px.

**Impact score: 9/10**

#### C3 — Active Scale Animation
**Files affected:** `button.tsx:33` (`active:scale-[0.98]`), `card.tsx:16` (`active:scale-[0.995]`)

iOS never scales UI elements on tap. It uses opacity or background highlight.

**Impact score: 8/10**

#### C4 — Dramatic Shadows with High Blur
**Files affected:** `globals.css` — all `--surface-*-shadow` variables

```css
Current: 0 10px 24px rgba(0,0,0,0.28)  /* Looks Material Design */
Apple:   0 2px 8px rgba(0,0,0,0.06)    /* Near invisible, suggests structure */
```

**Impact score: 8/10**

#### C5 — Color Button Shadow
**Files affected:** `button.tsx:7` — `shadow-[0_6px_18px_rgba(0,127,255,0.3)]`

Apple buttons NEVER have colored drop shadows. This is an old Material Design pattern.

**Impact score: 7/10**

### 8.2 Major Issues (Undermine the Apple Feel)

#### M1 — Badge Overload
Multiple badges per list item. Apple shows maximum 1 badge. Use detail view for the rest.

#### M2 — Transparent Borders Throughout
```css
--surface-card-border: transparent   /* means: no border, rely on shadow */
--sheet-border: transparent
```
In dark mode, Apple uses subtle visible borders (not shadows) to separate layers:
`rgba(255,255,255,0.1)` on dark surfaces.

#### M3 — Primary Button Has No Analog in Apple HIG
Currently: Glowing shadow + heavy border radius. Apple filled button: solid color, no shadow, 12px radius.

#### M4 — Heavy Hover States
```css
hover:shadow-[var(--surface-card-shadow-hover)]
hover:border-[var(--surface-card-border-hover)]
```
Touch UIs have no hover state. These cause visual noise when accidentally triggered on mobile.

#### M5 — Watermark Behind Content
The 18% opacity logo watermark in the home hero is not an Apple pattern. Apple never puts decorative watermarks behind content.

### 8.3 Minor Issues (Polish)

#### P1 — Nav Bar Icon Size (24px → 26px)
#### P2 — Bottom Nav Height (72px → 49px + safe area)
#### P3 — Input Inset Shadow (remove)
#### P4 — Foreground Color (#eef3f8 → #ffffff / #f2f2f7)
#### P5 — Success/Warning/Danger Colors (Tailwind → Apple system colors)
#### P6 — Nav Active State (remove pill background — iOS 17 removed it)

---

## 9. Target Design Tokens

This is the complete replacement design token set. Apply these changes to achieve the Apple aesthetic.

### 9.1 CSS Variables — globals.css Target

```css
/* ── Dark Mode (default — mirrors iOS dark appearance) ── */
:root {
  /* Backgrounds */
  --background: #000000;                    /* iOS systemBackground dark */
  --background-secondary: #1c1c1e;          /* iOS secondarySystemBackground dark */
  --background-tertiary: #2c2c2e;           /* iOS tertiarySystemBackground dark */
  --background-grouped: #000000;            /* iOS systemGroupedBackground dark */
  --background-grouped-secondary: #1c1c1e; /* iOS secondaryGroupedBackground dark */

  /* Text */
  --foreground: #ffffff;                    /* iOS label dark */
  --foreground-secondary: rgba(255,255,255,0.60);  /* iOS secondaryLabel dark */
  --foreground-tertiary:  rgba(255,255,255,0.30);  /* iOS tertiaryLabel dark */
  --foreground-quaternary: rgba(255,255,255,0.18); /* iOS quaternaryLabel dark */

  /* System Colors */
  --primary: #0a84ff;                       /* iOS systemBlue dark */
  --primary-hover: #409cff;
  --primary-light: rgba(10, 132, 255, 0.15);
  --success: #30d158;                       /* iOS systemGreen dark */
  --warning: #ff9f0a;                       /* iOS systemOrange dark */
  --danger: #ff453a;                        /* iOS systemRed dark */
  --muted: #8e8e93;                         /* iOS systemGray dark */

  /* Fills */
  --fill-primary:   rgba(120,120,128,0.36); /* iOS systemFill */
  --fill-secondary: rgba(120,120,128,0.32); /* iOS secondarySystemFill */
  --fill-tertiary:  rgba(118,118,128,0.24); /* iOS tertiarySystemFill */
  --fill-quaternary:rgba(116,116,128,0.18); /* iOS quaternarySystemFill */

  /* Borders */
  --border: rgba(255,255,255,0.10);         /* iOS separator dark */
  --border-strong: rgba(255,255,255,0.18);  /* iOS opaqueSeparator dark */

  /* Surfaces */
  --card: #1c1c1e;
  --surface-card-bg: #1c1c1e;
  --surface-card-border: rgba(255,255,255,0.08);
  --surface-card-shadow: none;              /* Dark mode: no shadows */

  /* Navigation */
  --surface-nav-bg: rgba(28, 28, 30, 0.82);
  --surface-nav-border: rgba(255,255,255,0.10);
  --surface-nav-shadow: none;              /* Dark mode: use border instead */
  --surface-nav-active-bg: transparent;    /* iOS 17: no bg behind active tab */

  /* Controls */
  --surface-control-bg: rgba(120,120,128,0.24);
  --surface-control-bg-hover: rgba(120,120,128,0.32);

  /* Hero */
  --hero-bg: linear-gradient(160deg, #007fff 0%, #0066d6 52%, #004fa8 100%);
  --hero-shadow: 0 8px 20px rgba(0, 60, 160, 0.20);

  /* Sheets / Modals */
  --sheet-bg: rgba(28, 28, 30, 0.94);
  --sheet-border: rgba(255,255,255,0.10);
  --sheet-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

/* ── Light Mode ── */
[data-theme="light"] {
  --background: #f2f2f7;                    /* iOS systemGroupedBackground light */
  --background-secondary: #ffffff;
  --background-tertiary: #f2f2f7;
  --background-grouped: #f2f2f7;
  --background-grouped-secondary: #ffffff;

  --foreground: #000000;
  --foreground-secondary: rgba(0,0,0,0.60);
  --foreground-tertiary:  rgba(0,0,0,0.30);
  --foreground-quaternary: rgba(0,0,0,0.18);

  --primary: #007aff;                       /* iOS systemBlue light */
  --primary-hover: #0066d6;
  --primary-light: rgba(0, 122, 255, 0.12);
  --success: #34c759;                       /* iOS systemGreen light */
  --warning: #ff9500;                       /* iOS systemOrange light */
  --danger: #ff3b30;                        /* iOS systemRed light */
  --muted: #8e8e93;

  --fill-primary:   rgba(120,120,128,0.20);
  --fill-secondary: rgba(120,120,128,0.16);
  --fill-tertiary:  rgba(118,118,128,0.12);
  --fill-quaternary:rgba(116,116,128,0.08);

  --border: rgba(0,0,0,0.12);
  --border-strong: rgba(0,0,0,0.22);

  --card: #ffffff;
  --surface-card-bg: #ffffff;
  --surface-card-border: transparent;
  --surface-card-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);

  --surface-nav-bg: rgba(242, 242, 247, 0.85);
  --surface-nav-border: rgba(0,0,0,0.12);
  --surface-nav-shadow: none;
  --surface-nav-active-bg: transparent;

  --surface-control-bg: rgba(120,120,128,0.12);
  --surface-control-bg-hover: rgba(120,120,128,0.18);

  --hero-bg: linear-gradient(160deg, #0080ff 0%, #0066d6 52%, #004fa8 100%);
  --hero-shadow: 0 8px 20px rgba(0, 80, 180, 0.18);

  --sheet-bg: rgba(255, 255, 255, 0.97);
  --sheet-border: rgba(0,0,0,0.10);
  --sheet-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

### 9.2 Tailwind Class Replacements

| Old Class | New Class | Reason |
|-----------|----------|--------|
| `rounded-2xl` (buttons) | `rounded-xl` | 24px → 12px |
| `rounded-[24px]` (cards) | `rounded-xl` | 24px → 12px |
| `rounded-2xl` (inputs) | `rounded-[10px]` | 24px → 10px |
| `uppercase tracking-wide` | `normal-case tracking-normal` | Anti-Apple |
| `tracking-widest` | `tracking-normal` | Anti-Apple |
| `tracking-[0.16em]` | `tracking-normal` | Anti-Apple |
| `active:scale-[0.98]` | `active:opacity-75` | iOS press behavior |
| `active:scale-[0.995]` | `active:opacity-75` | iOS press behavior |
| `font-bold` (page titles) | `font-semibold` | Apple uses semibold max |
| `hover:shadow-*` | remove | No hover on touch |
| `shadow-[0_6px_18px_rgba(0,127,255,0.3)]` | remove | No colored shadows |

### 9.3 Layer Radii Targets

```css
/* Home screen layers */
.layer-summary     { border-radius: 22px 22px 0 0; }  /* was 28px */
.layer-transactions { border-radius: 22px 22px 0 0; } /* was 32px */
.app-hero-card     { border-radius: 16px; }            /* was 24px */
```

---

## 10. Agent Implementation Guide — Step by Step

> This section is a precise, executable guide for an agent to transform Vynance into an Apple-original-looking app. Each phase is independent and testable.

See the companion document: **`docs/active/apple-redesign-agent-playbook.md`**

---

*Document created: 2026-03-03*
*Based on: Apple Human Interface Guidelines iOS 17/18, Vynance codebase audit*
*Status: Reference — do not edit without design review*
