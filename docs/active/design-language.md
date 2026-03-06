# Design Language Reference

Derived from the `IntegrationSection` component. Use this document as the single source of truth when building new UI in this visual system.

---

## 1. Core Philosophy

The design language is glassmorphism on a gradient field.

- Surfaces are translucent and layered.
- Depth comes from blur, soft shadows, and subtle inner glow.
- Borders are soft and semi-transparent.
- The system is light-mode only.

---

## 2. Color Tokens

All values are Tailwind CSS v4 utility classes. Hex/RGBA values are included for non-Tailwind contexts.

### 2.1 Background

| Role | Tailwind class | Hex / RGBA |
|---|---|---|
| Section base | `bg-white` | `#ffffff` |
| Gradient layer 1 | `from-sky-400/20 via-blue-500/20 to-indigo-600/20` | `rgba(56,189,248,0.20)` -> `rgba(59,130,246,0.20)` -> `rgba(99,102,241,0.20)` |
| Radial highlight (top-left) | n/a | `rgba(255,255,255,0.35)` at 30% 20%, fades to transparent at 40% |
| Radial accent (bottom-right) | n/a | `rgba(59,130,246,0.25)` at 70% 70%, fades to transparent at 45% |

### 2.2 Typography

| Role | Token |
|---|---|
| Primary heading (h2) | `text-slate-900` (`#0f172a`) |
| Secondary heading (h3) | `text-slate-900` (`#0f172a`) |
| Body / description | `text-slate-700` (`#334155`) |
| Subtitle / caption | `text-slate-600` (`#475569`) |
| De-emphasized / meta | `text-slate-600` (`#475569`) |
| Code text | `text-slate-800` (`#1e293b`) |
| Filename / chrome label | `text-slate-500` (`#64748b`) |

### 2.3 Glass Surface Colors

| Surface | Token |
|---|---|
| Primary card background | `bg-white/30` |
| Primary card border | `border-white/30` |
| Primary card ring | `ring-white/40` |
| Nested card background | `bg-white/70` |
| Nested card border | `border-white/40` |
| Chrome bar background | `bg-white/50` |
| Chrome bar border | `border-white/40` |
| Inner glow overlay | `from-white/20` |

### 2.4 Interactive Elements

| Element | Token |
|---|---|
| Primary button | `bg-blue-500 text-white` |
| Primary button shadow | `shadow-blue-500/30` |
| Ghost button background | `bg-white/60` |
| Ghost button border | `border-white/40` |
| Ghost button text | `text-slate-800` |
| Icon button background | `bg-white/60` |
| Icon button border | `border-white/40` |
| Icon button icon color | `text-slate-600` |
| Icon button hover | `bg-white/80` |

### 2.5 Chip / Tag Elements

| Property | Token |
|---|---|
| Background | `bg-white/60` |
| Border | `border-white/40` |
| Text | `text-slate-700` |

### 2.6 Decorative / Ambient

| Element | Token |
|---|---|
| Soft glow behind nested card | `bg-blue-400/10` |

---

## 3. Typography Scale

| Element | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Section heading (h2) | `text-3xl` / `sm:text-4xl` (30px / 36px) | `font-bold` (700) | `tracking-tight` | default |
| Panel heading (h3) | `text-xl` (20px) | `font-semibold` (600) | default | default |
| Body paragraph | `text-base` (16px) | 400 | default | `leading-relaxed` |
| Caption / meta line | `text-sm` (14px) | 400 | default | default |
| Chip label | `text-xs` (12px) | `font-medium` (500) | default | default |
| Button label | `text-sm` (14px) | `font-medium` (500) | default | default |
| Code block | `text-sm` (14px) | 400 | default | default (monospace) |

---

## 4. Spacing System

All spacing follows Tailwind's default 4px base unit.

| Context | Value |
|---|---|
| Section vertical padding | `py-28` (112px) / `sm:py-36` (144px) |
| Content max width | `max-w-7xl` (1280px) |
| Content horizontal padding | `px-6` / `lg:px-8` |
| Header max width | `max-w-3xl` (768px) |
| Card container max width | `max-w-5xl` (1024px) |
| Card top margin | `mt-14` (56px) |
| Card inner padding | `p-8` (32px) / `sm:p-10` (40px) |
| Two-column gap | `gap-10` (40px) |
| Heading to subtitle gap | `mt-4` (16px) |
| Heading to body gap | `mt-4` (16px) |
| Body to chips gap | `mt-6` (24px) |
| Chips to meta line gap | `mt-6` (24px) |
| Actions top margin | `mt-10` (40px) |
| Button row gap | `gap-4` (16px) |
| Chip horizontal padding | `px-3` (12px) |
| Chip vertical padding | `py-1` (4px) |
| Chip row gap | `gap-2` (8px) |
| Code panel inner padding | `p-5` (20px) |
| Chrome bar padding | `px-4 py-3` (16px / 12px) |

---

## 5. Border Radius

| Element | Value |
|---|---|
| Primary card | `rounded-2xl` (16px) |
| Nested card (code panel) | `rounded-xl` (12px) |
| Buttons | `rounded-md` (6px) |
| Chips | `rounded-full` |
| Dots | `rounded-full` |
| Soft glow pseudo-element | `rounded-2xl` |

---

## 6. Shadow and Depth System

Depth is expressed in tiers. Do not rely on flat color blocks for separation.

| Tier | Usage | Value |
|---|---|---|
| 1 - Primary card | Outermost glass container | `shadow-[0_20px_60px_rgba(0,0,0,0.12)]` |
| 2 - Nested card | Code panel inside primary card | `shadow-[0_10px_40px_rgba(0,0,0,0.12)]` |
| 3 - Buttons | Action buttons | `shadow` (ghost), `shadow-lg shadow-blue-500/30` (primary) |
| Ambient glow | Decorative halo behind nested card | `blur-2xl` on `bg-blue-400/10`, offset `-inset-2` |

---

## 7. Glass Effect Construction

Each glass surface needs these four pieces together:

```text
backdrop-blur-xl      <- primary card
backdrop-blur-lg      <- nested card
backdrop-blur         <- chips and ghost buttons

bg-white/30           <- primary translucent fill
bg-white/70           <- nested translucent fill

border border-white/30
border border-white/40

ring-1 ring-white/40  <- primary card only
```

Inner glow overlay:

```text
absolute inset-0 pointer-events-none
bg-linear-to-br from-white/20 via-transparent to-transparent
```

---

## 8. Background Construction

Backgrounds are built from three stacked absolute layers (`absolute inset-0 pointer-events-none`).

```text
Layer 1: linear gradient for overall color direction
Layer 2: top-left radial highlight
Layer 3: bottom-right radial accent
```

```css
/* Layer 1 */
background: linear-gradient(
  to bottom right,
  rgba(56,189,248,0.20),
  rgba(59,130,246,0.20),
  rgba(99,102,241,0.20)
);

/* Layer 2 */
background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 40%);

/* Layer 3 */
background: radial-gradient(circle at 70% 70%, rgba(59,130,246,0.25), transparent 45%);
```

---

## 9. Motion and Transitions

| Context | Duration | Properties |
|---|---|---|
| Surface color transitions | `duration-500` | `transition-colors`, `transition-all` |
| Button hover | `duration-300` | `transition-all` |
| Label blur/fade effects | default | `opacity`, `filter` |

Button hover pattern with ghost text:
- Primary label fades/blur out on `group-hover`.
- Secondary label fades in on `group-hover`.
- Use `group` on the `<button>`.

---

## 10. Layout Patterns

### Section wrapper

```text
relative overflow-hidden
py-28 sm:py-36
```

### Centered content column

```text
mx-auto max-w-7xl px-6 lg:px-8
```

### Centered text header block

```text
mx-auto max-w-3xl text-center
```

### Two-column card split

```text
grid grid-cols-1 lg:grid-cols-2 gap-10
```

### Action row

```text
flex flex-wrap justify-center gap-4 items-center
```

---

## 11. Component Patterns

### Glass Card (primary)

```text
relative rounded-2xl backdrop-blur-xl border ring-1 overflow-hidden
bg-white/30 border-white/30 ring-white/40
shadow-[0_20px_60px_rgba(0,0,0,0.12)]
```

### Glass Card (nested)

```text
rounded-xl backdrop-blur-lg border overflow-hidden
bg-white/70 border-white/40
shadow-[0_10px_40px_rgba(0,0,0,0.12)]
```

### Chrome Bar

```text
flex items-center gap-2 border-b px-4 py-3
bg-white/50 border-white/40
```

Dot row:
- Three 12x12 dots (`bg-rose-500`, `bg-amber-500`, `bg-emerald-500`) with `gap-2`
- Then `ml-2` filename label

### Chip / Tag

```text
rounded-full backdrop-blur border px-3 py-1 text-xs font-medium shadow-sm
bg-white/60 border-white/40 text-slate-700
```

### Primary Button

```text
inline-flex h-10 items-center justify-center rounded-md
bg-blue-500 px-6 text-sm font-medium text-white
shadow-lg shadow-blue-500/30
```

### Ghost Button

```text
inline-flex h-10 items-center justify-center rounded-md backdrop-blur border px-6 text-sm font-medium shadow
bg-white/60 border-white/40 text-slate-800
```

### Icon Button (square)

```text
inline-flex h-10 w-10 items-center justify-center rounded-md border backdrop-blur shadow
bg-white/60 border-white/40 text-slate-600 hover:bg-white/80
```

### Soft Ambient Glow

```text
pointer-events-none absolute -inset-2 rounded-2xl blur-2xl
bg-blue-400/10
```

---

## 12. Iconography

Icons are inline SVG, 16x16, stroke-only:

```text
width="16" height="16"
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
strokeWidth="2"
strokeLinecap="round"
strokeLinejoin="round"
```

Icon color inherits from parent `text-*` via `currentColor`.

---

## 13. Quick Reference Cheatsheet

```text
LIGHT SURFACE STACK
Section bg       bg-white
Gradient         sky-400/20 -> blue-500/20 -> indigo-600/20
Primary card     bg-white/30  border-white/30  ring-white/40
Nested card      bg-white/70  border-white/40
Chrome bar       bg-white/50  border-white/40
Ghost button     bg-white/60  border-white/40
Chip             bg-white/60  border-white/40
Ambient glow     bg-blue-400/10

TEXT RAMP
Headings         slate-900
Body             slate-700
Caption          slate-600
Meta             slate-600
Code             slate-800
Chrome label     slate-500

UNIVERSAL RULES
Glass requires:  blur + translucent bg + translucent border
Depth requires:  rgba shadows, not flat separators
Surface motion:  duration-500
Hover motion:    duration-300
Radius steps:    rounded-full -> rounded-2xl -> rounded-xl -> rounded-md
```
