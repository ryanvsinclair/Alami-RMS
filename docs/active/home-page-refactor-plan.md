# Home Page Refactor Plan

Status: COMPLETE
Created: 2026-03-02
Last Updated: 2026-03-02
Primary Purpose: Refactor the home page layout to match the Revolut-style reference design — full-width top nav, centered balance hero with 3-way toggle, two core action buttons, and a single unified transaction list that dynamically filters based on the active balance view.

Constitution source: `docs/active/execution-constitution.md`
UI Design reference: `docs/active/ui-redesign-plan.md`

---

## Reference Design (Revolut Screenshot)

Key patterns extracted:

- Full-width horizontal icon + label nav bar across the top of the hero
- Balance number centered and dominant in the hero section
- Toggle pill directly under the balance to switch the viewed figure
- Two primary action buttons side by side below the toggle
- Single unified activity list below — no separate income/expense sheets
- Revolut-style flat row items: icon circle + name + metadata left, amount right

---

## What Is Being Replaced

| Current | Replacement |
|---|---|
| Vertical column of icon buttons stacked on the right side of the hero | Full-width horizontal nav bar (4 buttons, equal width) |
| Single fixed "Total Balance" label + net value | 3-way toggle: Balance / Income / Expenses |
| No primary action buttons on home page | Two pill buttons: Add Receipt + Scan Barcode |
| Two separate layers: `HomeIncomeLayer` + `HomeTransactionsLayer` | One unified `HomeActivityList` component |
| Expense-only transaction list | Combined income + expense list, filtered by toggle state |
| Income breakdown expansion panel | Removed — data visible in unified list |

---

## Layout Structure (3 Zones)

```
┌─────────────────────────────────────────┐
│  ZONE 1 — Top Nav (full viewport width) │
│  [Profile] [Search] [Reports] [Contacts]│
├─────────────────────────────────────────┤
│  ZONE 2 — Hero Balance Section          │
│                                         │
│           $1,234.56                     │
│        [ ← Balance → ]                  │
│                                         │
│  [ + Add Receipt ]  [ ⬚ Scan Barcode ] │
├─────────────────────────────────────────┤
│  ZONE 3 — Unified Activity List         │
│  (card surface, fills remaining height) │
│                                         │
│  MON, MAR 2                             │
│  ● Coffee Shop        -$12.00           │
│  ● Uber Eats          +$340.00          │
│  ─────────────────────────────          │
│  SUN, MAR 1                             │
│  ● DoorDash           +$210.50          │
└─────────────────────────────────────────┘
```

---

## Zone 1 — Top Nav Bar

**Order:** Profile · Search · Reports · Contacts

**Layout:** `flex w-full` — 4 equal `flex-1` slots across the full viewport width.

**Each button:**
```tsx
<Link/button className="flex flex-1 flex-col items-center gap-1 py-3">
  <svg className="h-5 w-5" />
  <span className="text-[10px] font-medium text-white/70">Label</span>
</Link>
```

**Routes:**
- Profile → `/profile`
- Search → disabled (coming soon)
- Reports → `/reports`
- Contacts → `/contacts`

**Style:** No container background — buttons sit directly on hero blue. Icon + label color: `text-white/70`, hover `text-white`.

---

## Zone 2 — Hero Balance Section

### Balance display

Centered, with dynamic label above and toggle pill below:

```
[label: "Balance" / "Income" / "Expenses"  — text-[11px] uppercase tracking-widest text-white/50]
[$1,234.56  — text-[44px] font-bold text-white]
[← Balance →  — toggle pill]
```

### Balance toggle

3-way cycle pill. Tapping advances to the next state:
`balance` → `income` → `expenses` → `balance` → …

```tsx
type BalanceView = "balance" | "income" | "expenses";
```

| State | Label shown above number | Value shown | List filter |
|---|---|---|---|
| `balance` | "Balance" | `net` (income − expenses) | All transactions |
| `income` | "Income" | `income` total | `type === "income"` only |
| `expenses` | "Expenses" | `expenses` total | `type === "expense"` only |

Toggle pill style: `rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold text-white/80` with left/right chevron indicators.

### Two action buttons

Side by side, full width split:

```tsx
// Add Receipt
<Link href="/receive/photo" className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-white/10 py-3 ...">
  <svg /> {/* receipt/document icon */}
  <span className="text-[11px] font-semibold text-white/80">Add Receipt</span>
</Link>

// Scan Barcode
<Link href="/receive/barcode" className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-white/10 py-3 ...">
  <svg /> {/* barcode icon */}
  <span className="text-[11px] font-semibold text-white/80">Scan Barcode</span>
</Link>
```

Route targets:
- Add Receipt → `/receive/photo`
- Scan Barcode → `/receive/barcode`

---

## Zone 3 — Unified Activity List (`HomeActivityList`)

### Component contract

```tsx
interface HomeActivityListProps {
  loading: boolean;
  error: string;
  transactions: HomeDashboardFinancialTx[];   // all tx, both types
  view: BalanceView;
  terminology: ReturnType<typeof getTerminology>;
}
```

### Filtering logic

```ts
const visibleTx = view === "balance"
  ? transactions
  : transactions.filter(tx =>
      view === "income" ? tx.type === "income" : tx.type === "expense"
    );
```

Sorted by `occurred_at` descending (already returned sorted from server).

### Row design

Each row:
```
[source icon circle]  [name (semibold)]           [±$amount (bold)]
                      [source label · time (muted xs)]
```

- Income rows: amount in `text-success` with `+` prefix
- Expense rows: amount in `text-foreground` with `-` prefix
- Rows with `receipt_id` → tappable, navigates to `/receive/receipt/[id]`
- Grouped by day with muted uppercase day label above each group
- Rows separated by `divide-y divide-border/40`

### Empty states

| View | Message |
|---|---|
| `balance` | "No transactions yet" |
| `income` | "No income recorded this period" |
| `expenses` | "No expenses yet" |

### Integrations shortcut

Small `+ Add Integration` link in the list header (right side), always visible (integrations is now a core feature). Routes to `/integrations`.

---

## State Shape in `HomeDashboardClient`

```ts
// New state
const [balanceView, setBalanceView] = useState<BalanceView>("balance");

// Derived values
const displayValue =
  balanceView === "balance" ? net :
  balanceView === "income"  ? income : expenses;

const allTransactions = data?.transactions ?? [];
```

The `balanceView` and `setBalanceView` are owned by `HomeDashboardClient` and passed down. `HomeActivityList` receives all transactions and the current `view`, and filters internally.

---

## Component Changes Summary

| File | Change |
|---|---|
| `src/features/home/ui/HomeDashboardClient.tsx` | Full rewrite — new 3-zone layout, `balanceView` state, passes all tx + view to `HomeActivityList` |
| `src/features/home/ui/HomeActivityList.tsx` | **New file** — unified list component |
| `src/features/home/ui/HomeTransactionsLayer.tsx` | Kept as file (Rule 4 — no casual removal), no longer rendered on home page |
| `src/features/home/ui/HomeIncomeLayer.tsx` | Kept as file (Rule 4 — no casual removal), no longer rendered on home page |
| `src/features/home/ui/index.ts` | Add `HomeActivityList` export |
| `src/features/home/ui/home-financial-layer.shared.tsx` | No changes — shared helpers reused by `HomeActivityList` |

---

## CSS Changes

No `globals.css` changes required. New layout uses existing `.layer-stack`, `.layer-transactions` tokens and CSS variables.

---

## What Does Not Change

- Azure `#007fff` hero gradient background
- Watermark logo behind balance
- Restaurant kitchen redirect logic (`TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY`)
- `BottomNav` component and position
- `getDashboardSummary` server action — no backend changes
- `HomeDashboardSummary` contract — already returns all tx with `type: "income" | "expense"`
- `SOURCE_META` icons and colors
- `formatMoney`, `Skeleton`, day-grouping logic
- `BusinessConfigProvider` wrapper
- Dark/light theme support

---

## Execution Checklist

Each item must be marked `[x]` immediately upon completion. No batching.

### Step 1 — Create `HomeActivityList.tsx`

- [x] 1.1 Create `src/features/home/ui/HomeActivityList.tsx` with `"use client"` directive
- [x] 1.2 Define `BalanceView` type (`"balance" | "income" | "expenses"`)
- [x] 1.3 Define `HomeActivityListProps` interface (loading, error, transactions, view, terminology)
- [x] 1.4 Implement internal filtering logic (balance = all, income = income only, expenses = expense only)
- [x] 1.5 Implement day-grouping logic (reuse pattern from `HomeTransactionsLayer`)
- [x] 1.6 Implement list header row — left: section label driven by view, right: `+ Integrations` link to `/integrations`
- [x] 1.7 Implement loading skeleton state (4 placeholder rows)
- [x] 1.8 Implement error state
- [x] 1.9 Implement empty state — message varies by view
- [x] 1.10 Implement transaction row — source icon circle (from `SOURCE_META`), name + metadata left, amount right
- [x] 1.11 Income rows: amount `text-success` with `+` prefix
- [x] 1.12 Expense rows: amount `text-foreground` with `-` prefix
- [x] 1.13 Rows with `receipt_id` → wrapped in `<Link href="/receive/receipt/[id]">`
- [x] 1.14 Day groups separated by muted uppercase day label
- [x] 1.15 Rows within group separated by `divide-y divide-border/40`

### Step 2 — Export `HomeActivityList` from barrel

- [x] 2.1 Add `export { HomeActivityList } from "./HomeActivityList"` to `src/features/home/ui/index.ts`

### Step 3 — Rewrite `HomeDashboardClient.tsx`

- [x] 3.1 Remove `transactionsCollapsed` state — no longer needed
- [x] 3.2 Add `balanceView` state (`useState<BalanceView>("balance")`)
- [x] 3.3 Remove `expenseTransactions` derived variable — pass all transactions to `HomeActivityList`
- [x] 3.4 Add `displayValue` derived variable (net / income / expenses based on `balanceView`)
- [x] 3.5 Remove `HomeIncomeLayer` import and usage
- [x] 3.6 Remove `HomeTransactionsLayer` import and usage
- [x] 3.7 Add `HomeActivityList` import
- [x] 3.8 Build Zone 1 — full-width top nav bar with 4 equal buttons (Profile, Search, Reports, Contacts) in that order
- [x] 3.9 Profile button → `/profile`, icon: person silhouette
- [x] 3.10 Search button → disabled, icon: magnifier
- [x] 3.11 Reports button → `/reports`, icon: bar chart
- [x] 3.12 Contacts button → `/contacts`, icon: people/group
- [x] 3.13 Build Zone 2 — centered balance section
- [x] 3.14 Dynamic label above number (text changes with `balanceView`)
- [x] 3.15 Large centered balance number using `displayValue`
- [x] 3.16 Balance toggle pill — tap cycles `balance` → `income` → `expenses` → `balance`
- [x] 3.17 Toggle pill shows left chevron, current view label, right chevron
- [x] 3.18 Two action buttons side by side — Add Receipt + Scan Barcode
- [x] 3.19 Add Receipt → `/receive/photo`, receipt/document icon
- [x] 3.20 Scan Barcode → `/receive/barcode`, barcode icon
- [x] 3.21 Build Zone 3 — render `<HomeActivityList>` with all transactions + current `balanceView`
- [x] 3.22 Confirm watermark logo is still rendered in Zone 2 hero area
- [x] 3.23 Confirm restaurant kitchen redirect `useEffect` is preserved unchanged
- [x] 3.24 Confirm `BusinessConfigProvider` wrapper is preserved
- [x] 3.25 Confirm `BottomNav` is still rendered at the bottom

### Step 4 — Validation

- [x] 4.1 Run `npx tsc --noEmit --incremental false` — must pass clean
- [x] 4.2 Run `npx eslint src/features/home/ui/HomeActivityList.tsx` — must pass clean
- [x] 4.3 Run `npx eslint src/features/home/ui/HomeDashboardClient.tsx` — must pass clean
- [x] 4.4 Run `npx eslint src/features/home/ui/index.ts` — must pass clean

### Step 5 — Docs update

- [x] 5.1 Update `### Home dashboard financial layers` section in `docs/active/codebase-overview.md` to reflect new `HomeActivityList` architecture
- [x] 5.2 Update canonical paths list in `docs/active/codebase-overview.md` for `src/features/home/ui/*`
- [x] 5.3 Append new entry at top of `docs/active/codebase-changelog.md`
- [x] 5.4 Update `Status` field in this document to `COMPLETE`
