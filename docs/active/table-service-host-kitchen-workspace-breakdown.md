# Table Service Host and Kitchen Workspace Breakdown

Status: active reference  
Created: 2026-03-03  
Last Updated: 2026-03-03  
Primary Purpose: document how Host and Kitchen mode preview works in Table Service V1, which files are involved, and how to safely change features, UX, and device-specific layout behavior.

## Scope and Terminology

- "Host mode preview" in this codebase is the launch workspace mode selection and Host workflow surface.
- "Kitchen mode preview" is the launch workspace mode selection and Kitchen queue surface.
- Mode preview is implemented as a temporary launch bridge via `localStorage`, not role-based auth.

Canonical mode constants and key:

- `src/features/table-service/shared/table-service.contracts.ts`
  - `TABLE_SERVICE_WORKSPACE_MODES`
  - `TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY`

## End-to-End Runtime Flow

### 1. Profile mode toggle (launch preview switch)

- File: `app/(dashboard)/profile/page.tsx`
- File: `src/features/table-service/ui/TableServiceModeToggleCard.tsx`

Behavior:

1. Profile checks if `table_service` module is enabled for a restaurant business.
2. If enabled, it renders `TableServiceModeToggleCard`.
3. Toggle writes `host` or `kitchen` into `localStorage` at key `table_service_workspace_mode`.

### 2. Home auto-redirect when Kitchen mode is active

- File: `src/features/home/ui/HomeDashboardClient.tsx`

Behavior:

1. Home verifies business is restaurant and `table_service` module is enabled.
2. Home reads `TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY` from `localStorage`.
3. If mode is `kitchen`, it routes to `/service/kitchen`.

### 3. Service route access control

- File: `app/(dashboard)/service/layout.tsx`
- File: `src/features/table-service/server/guard.ts`

Behavior:

1. Every `/service/*` route is guarded by `requireTableServiceAccess()`.
2. Guard requires:
   - business membership
   - `business.industry_type === "restaurant"`
   - enabled module `table_service`

### 4. Entry points into Host and Kitchen

- `/service` redirects to `/service/tables`:
  - `app/(dashboard)/service/page.tsx`
- Host page:
  - `app/(dashboard)/service/host/page.tsx`
- Kitchen page:
  - `app/(dashboard)/service/kitchen/page.tsx`

### 5. QR behavior (public diner path vs in-app host scanner)

Public diner path (URL navigation):

- File: `app/scan/t/[token]/page.tsx`
- File: `src/features/table-service/server/table.service.ts` (`resolveDiningTableByQrToken`, `getOrCreateActiveTableSession`)

Behavior:

1. `/scan/t/[token]` resolves token -> table/business.
2. If signed-in scanner is a member of that business, it redirects to host.
3. Otherwise it redirects to public diner page `/r/<businessId>`.

In-app host scanner path (no QR URL navigation):

- File: `src/features/table-service/ui/TableSetupPageClient.tsx`

Behavior:

1. Built-in scanner reads QR payload text only.
2. Host flow extracts a table number from payload (`table=...`, `tableNumber=...`, `t=...`, `table:...`, or raw text).
3. Client matches table number against already-loaded tables in the current business.
4. App routes directly to `/service/host?table=<tableId>`.
5. Host page creates/reuses active session server-side as normal.

Current generated QR payload from tables setup:

- `/r/<businessId>?table=<tableNumber>`

Public page:

- `app/r/[publicSlug]/page.tsx` (business-keyed menu + optional review CTA).

### 6. Host workflow lifecycle

- Route: `app/(dashboard)/service/host/page.tsx`
- UI: `src/features/table-service/ui/HostOrderComposerPageClient.tsx`
- Server actions wrapper: `app/actions/modules/table-service.ts`
- Service logic: `src/features/table-service/server/order.service.ts`

Behavior:

1. Route resolves:
   - table (`getDiningTableById`)
   - active session (`getOrCreateActiveTableSession`)
   - existing kitchen order for session (`getKitchenOrderForSession`)
   - menu setup (`getMenuSetupData`)
2. Host composes local draft lines in client state.
3. Submit path:
   - no existing order: `confirmKitchenOrder(...)`
   - existing order: `appendKitchenOrderItems(...)`
4. Done/Paid path:
   - `closeKitchenOrderAndSession(...)`
   - closes both `KitchenOrder.closed_at` and `TableSession.closed_at`.

### 7. Kitchen workflow lifecycle

- Route: `app/(dashboard)/service/kitchen/page.tsx`
- UI: `src/features/table-service/ui/KitchenQueuePageClient.tsx`
- Service logic: `src/features/table-service/server/order.service.ts` (`getKitchenQueue`, `updateKitchenOrderItemStatus`)

Behavior:

1. Route fetches initial queue from server.
2. Queue query rules:
   - `closed_at: null`
   - `confirmed_at` present
   - ordered FIFO by `confirmed_at ASC`, then `created_at ASC`
3. Queue visibility rule:
   - orders collapse when all items are terminal (`served` or `cancelled`)
4. Kitchen can update each line item status.
5. Overdue label is visual urgency only and does not reorder queue.

### 8. Exit preview mode

- File: `src/features/table-service/ui/ExitServiceModeButton.tsx`

Behavior:

1. Clears `TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY` from `localStorage`.
2. Redirects user to `/`.

## Data Model and Contracts

### Prisma persistence

- File: `prisma/schema.prisma`
  - `enum KitchenOrderItemStatus`
  - `model DiningTable`
  - `model MenuCategory`
  - `model MenuItem`
  - `model TableSession`
  - `model KitchenOrder`
  - `model KitchenOrderItem`

Key invariants in schema:

- one `KitchenOrder` per `TableSession` (`table_session_id` unique)
- `KitchenOrderItem.status` uses enum lifecycle values

### Shared contracts and invariants

- File: `src/features/table-service/shared/table-service.contracts.ts`

Important contract constants:

- `KITCHEN_ORDER_ITEM_STATUSES`
- `KITCHEN_TERMINAL_ITEM_STATUSES`
- `KITCHEN_CONFIRMATION_WINDOW_MINUTES`
- `TABLE_SERVICE_ORDER_FLOW_CONTRACT`

Important helpers:

- `shouldShowKitchenOrderInQueue(...)`
- `getKitchenOrderDueAt(...)`

## Files Involved (By Layer)

### Route layer

- `app/(dashboard)/service/layout.tsx`
- `app/(dashboard)/service/page.tsx`
- `app/(dashboard)/service/host/page.tsx`
- `app/(dashboard)/service/kitchen/page.tsx`
- `app/(dashboard)/service/tables/page.tsx`
- `app/(dashboard)/service/menu/page.tsx`
- `app/scan/t/[token]/page.tsx`
- `app/r/[publicSlug]/page.tsx`
- `app/(dashboard)/profile/page.tsx`
- `app/page.tsx`

### UI layer

- `src/features/table-service/ui/HostOrderComposerPageClient.tsx`
- `src/features/table-service/ui/KitchenQueuePageClient.tsx`
- `src/features/table-service/ui/TableServiceModeToggleCard.tsx`
- `src/features/table-service/ui/ExitServiceModeButton.tsx`
- `src/features/table-service/ui/TableSetupPageClient.tsx`
- `src/features/table-service/ui/MenuSetupPageClient.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `app/globals.css`

### Server/actions layer

- `app/actions/modules/table-service.ts`
- `src/features/table-service/server/guard.ts`
- `src/features/table-service/server/order.service.ts`
- `src/features/table-service/server/table.service.ts`
- `src/features/table-service/server/menu.service.ts`

### Contracts/tests layer

- `src/features/table-service/shared/table-service.contracts.ts`
- `src/features/table-service/shared/table-service.contracts.test.ts`
- `src/features/table-service/shared/table-service.launch-smoke.test.ts`

## Change Guide: Features

### A) Add or change host or kitchen business behavior

1. Update shared types and invariants in `table-service.contracts.ts`.
2. Update service logic in `order.service.ts` (or table/menu service where relevant).
3. Update server action wrapper in `app/actions/modules/table-service.ts` if function signature changed.
4. Update route loader usage (`host/page.tsx` or `kitchen/page.tsx`) if data shape changed.
5. Update client UI behavior in Host and/or Kitchen page clients.
6. Update smoke and contract tests.

### B) Add a new kitchen status

1. Update Prisma enum `KitchenOrderItemStatus` in `prisma/schema.prisma`.
2. Create/apply migration and regenerate Prisma client.
3. Update `KITCHEN_ORDER_ITEM_STATUSES` in contracts.
4. Decide whether the new status is terminal; update `KITCHEN_TERMINAL_ITEM_STATUSES` if needed.
5. Ensure `updateKitchenOrderItemStatus` accepts and validates the new status.
6. Update Kitchen UI status select labels/options.
7. Update tests (`table-service.contracts.test.ts` and `table-service.launch-smoke.test.ts`).

### C) Change queue ordering or visibility logic

1. Update query `orderBy` and/or filter logic in `getKitchenQueue(...)`.
2. Keep queue semantics documented in Kitchen UI copy to avoid operator confusion.
3. Update launch smoke assertions that check FIFO and visibility behavior.

### D) Add host workflow capabilities (for example split bill, partial close, fire/coursing)

1. Add contract types in `table-service.contracts.ts`.
2. Add server operations in `order.service.ts` with tenant and active-session guards.
3. Expose server actions in `app/actions/modules/table-service.ts`.
4. Add UI controls in `HostOrderComposerPageClient.tsx`.
5. Add tests for lifecycle transitions and guardrails.

## Change Guide: UX

### Host UX edits

- Primary file: `src/features/table-service/ui/HostOrderComposerPageClient.tsx`
- Change:
  - section order
  - labels/copy
  - density and card grouping
  - success/error feedback

### Kitchen UX edits

- Primary file: `src/features/table-service/ui/KitchenQueuePageClient.tsx`
- Change:
  - card hierarchy
  - status controls
  - urgency treatment
  - refresh affordances

### Shared control behavior and styling

- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/card.tsx`
- global tokens in `app/globals.css`

## Change Guide: Device-Specific Layout

Current layout anchors:

- Host wrapper: `app/(dashboard)/service/host/page.tsx` (`max-w-3xl`)
- Kitchen wrapper: `src/features/table-service/ui/KitchenQueuePageClient.tsx` (`max-w-4xl`)
- Existing responsive pattern example:
  - Host line-item row uses `grid-cols-1` with `sm:grid-cols-[110px_1fr_auto]`

Recommended approach for device-targeted layout changes:

1. Keep behavior in existing Host/Kitchen components.
2. Use Tailwind responsive classes (`sm`, `md`, `lg`, `xl`) for progressive layout changes.
3. For major divergences, create extracted presentational subcomponents by viewport intent (mobile-first defaults).
4. Keep touch targets at least 44px.
5. Validate both portrait phone and wide tablet/desktop queue scans.

## Validation Checklist

Minimum after behavior changes:

- `npx eslint <touched-files>`
- `node --test --experimental-transform-types src/features/table-service/shared/table-service.contracts.test.ts src/features/table-service/shared/table-service.launch-smoke.test.ts`

If Prisma schema changed:

- run Prisma migration flow
- regenerate client
- rerun lint and tests above

## Known Current Constraints and Notes

- Host route uses `table` query parameter to resolve table and create/reuse session server-side.
- Workspace mode toggle is intentionally temporary and expected to be replaced by role-based access in a later refactor.
- Public diner route parameter is named `publicSlug` but currently resolved against business id.
- `DiningTable.qr_token` still exists for backward compatibility and public scan route support, but table setup UI now favors table-number QR payload for host in-app scanning.
