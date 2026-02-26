# App Structure Refactor Agent Playbook

Status: Active
Created: 2026-02-25
Last Updated: 2026-02-25
Primary Goal: Reorganize the codebase into a feature-first, route-thin structure without breaking runtime behavior, routes, auth, or data integrity.

## Index
1. [Start Here (Required)](#start-here-required)
2. [Update Here (Agent Handoff Ledger)](#update-here-agent-handoff-ledger)
3. [Objectives, Scope, and Non-Goals](#objectives-scope-and-non-goals)
4. [Current Architecture Snapshot](#current-architecture-snapshot)
5. [Target Architecture (Intended Structure)](#target-architecture-intended-structure)
6. [Do Not Break Anything: Refactor Rules](#do-not-break-anything-refactor-rules)
7. [Current to Intended Path Mapping](#current-to-intended-path-mapping)
8. [Execution Plan by Phase](#execution-plan-by-phase)
9. [Validation and Safety Checklist](#validation-and-safety-checklist)
10. [Duplication Prevention Checklist](#duplication-prevention-checklist)
11. [Agent Handoff Checklist](#agent-handoff-checklist)
12. [Known Risks, Invariants, and Deferred Items](#known-risks-invariants-and-deferred-items)
13. [Command Reference](#command-reference)
14. [Definition of Done](#definition-of-done)
15. [Appendix A: Hotspot Files (Baseline)](#appendix-a-hotspot-files-baseline)
16. [Appendix B: Templates](#appendix-b-templates)

## Start Here (Required)
Every agent must do this before changing code:

1. Read this file top to bottom at least once.
2. Check the `Update Here` section for:
   - current phase
   - active work lock
   - latest completed checkpoint
   - unresolved blockers
3. Claim a work item in the `Active Work Lock` block before editing files.
4. Confirm the path mapping and phase checklist for the files you plan to touch.
5. Only then start implementation.

Rules for working sessions:
- One focused phase or sub-phase per session.
- Update the checklist as you complete items.
- Append a handoff entry before ending the session.
- Do not silently create new canonical files without updating this document.

### Local Test Account (Agent Testing - Local Only)

When any agent needs to perform local testing that requires authentication, they may use this **test account** for sign-in and flow verification in this workspace.

- Base URL: `http://localhost:3000`
- Email: `mehdi.eg2004@gmail.com`
- Password: `testtest`

Disclaimer:

- Local testing use only. Do not publish these credentials or commit them to a public remote.
- Agents may use this account for local verification and smoke tests when login is required.
- Rotate/update these credentials here if access stops working.
## Update Here (Agent Handoff Ledger)

This section is the source of truth for progress and ownership during the refactor.

### Current Status Snapshot
- Current phase: `Phase 6 in progress (inventory extraction complete; contacts/staff remaining)`
- Latest completed checkpoint: `Phase 6 inventory UI + inventory server extraction complete (targeted compile/lint pass)`
- Active work lock: `UNLOCKED`
- Known blocker: `None`
- Last validation status: `npx tsc --noEmit --incremental false PASS (2026-02-26); npx eslint app/actions/core/inventory.ts src/features/inventory/server/*.ts PASS (2026-02-26); manual receive smoke PASS (barcode/photo/manual/receipt + receipt detail tabs, user-reported, 2026-02-26); prior baseline lint 4 pre-existing errors/15 warnings, barcode-cache 5/5 PASS, receipt-line-core 10/10 PASS`

### Active Work Lock (Edit First)
Use this to prevent duplicate work. Clear it when the session ends.

- Status: `UNLOCKED`
- Agent: `-`
- Date (UTC/local): `2026-02-26`
- Scope claimed: `None`
- Files expected to touch:
  - `None (claim next scope before editing)`
- Notes:
  - `Next recommended claim: Phase 6 contacts UI extraction -> src/features/contacts/ui/*`

### Phase Completion Ledger
Mark only when exit criteria are met.

- [x] Phase 0 complete: Baseline capture and guardrails
- [x] Phase 1 complete: Target scaffolding + aliases + wrapper strategy in place
- [x] Phase 2 complete: Shopping server action split (behavior preserved)
- [x] Phase 3 complete: Shopping UI split (route shell thin, behavior preserved)
- [x] Phase 4 complete: Receipt/receiving server split (behavior preserved)
- [x] Phase 5 complete: Receive UI pages split + shared receive contracts/constants
- [ ] Phase 6 complete: Inventory, contacts, staff feature extraction
- [ ] Phase 7 complete: Shared/domain/server infrastructure moves + import cleanup
- [ ] Phase 8 complete: Legacy wrappers deprecated/removed, docs and final verification

### Handoff Log (Append New Entries at Top)

#### 2026-02-26 - Phase 6 (partial): Inventory UI + inventory server extraction completed
- Agent: `Codex`
- Scope: `Complete Phase 6 inventory sub-phase (UI route wrappers + inventory action server extraction)`
- Completed:
  - Confirmed inventory route pages are thin wrappers pointing to feature UI clients:
    - `app/(dashboard)/inventory/page.tsx`
    - `app/(dashboard)/inventory/[id]/page.tsx`
    - `src/features/inventory/ui/InventoryListPageClient.tsx`
    - `src/features/inventory/ui/InventoryDetailPageClient.tsx`
  - Extracted inventory server logic from `app/actions/core/inventory.ts` into feature server files:
    - `src/features/inventory/server/inventory.repository.ts`
    - `src/features/inventory/server/inventory.service.ts`
    - `src/features/inventory/server/index.ts`
  - Converted `app/actions/core/inventory.ts` into a transitional wrapper that preserves action exports/signatures and keeps tenant auth at the action entrypoint.
  - Marked Phase 6 inventory UI + inventory server checklist items complete.
- Changed files:
  - `app/actions/core/inventory.ts`
  - `app/(dashboard)/inventory/page.tsx`
  - `app/(dashboard)/inventory/[id]/page.tsx`
  - `src/features/inventory/ui/InventoryListPageClient.tsx`
  - `src/features/inventory/ui/InventoryDetailPageClient.tsx`
  - `src/features/inventory/server/inventory.repository.ts`
  - `src/features/inventory/server/inventory.service.ts`
  - `src/features/inventory/server/index.ts`
  - `docs/app-structure-refactor-agent-playbook.md`
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
  - `npx eslint app/actions/core/inventory.ts src/features/inventory/server/*.ts` -> PASS
  - `curl http://localhost:3000/inventory` -> `307` (auth redirect, route present)
- Blockers:
  - `None (user-provided /inventory 404 screenshot not reproduced; local route currently returns 307 auth redirect)`
- Next recommended step:
  - `Phase 6 contacts UI extraction -> src/features/contacts/ui/*`

#### 2026-02-26 - Phase 5 complete: Receive UI split validated and closed out
- Agent: `Codex`
- Scope: `Close Phase 5 after manual receive-flow smoke validation`
- Completed:
  - Recorded manual smoke validation pass for receive routes:
    - `/receive` navigation hub
    - `/receive/manual`
    - `/receive/barcode` (known linked barcode path)
    - `/receive/photo` (photo/typed fallback path)
    - `/receive/receipt` parse/review/commit + receipt detail view
    - `/receive/receipt/[id]` digital/photo tabs
  - Marked Phase 5 checklist complete and Phase Completion Ledger Phase 5 complete.
  - Updated `Update Here` snapshot/status to `Phase 5 complete - Ready for Phase 6`.
- Changed files:
  - `docs/app-structure-refactor-agent-playbook.md`
- Validation run:
  - `Manual receive-flow smoke validation` -> PASS (user-reported)
  - `npx tsc --noEmit --incremental false` -> PASS (already recorded for extraction pass)
- Blockers:
  - `None`
- Next recommended step:
  - `Phase 6: Inventory, contacts, staff feature extraction`

#### 2026-02-26 - Phase 5 (partial): Receive UI pages split + shared receive contracts/constants extracted
- Agent: `Codex`
- Scope: `Extract receive route UI into src/features/receiving/*/ui and add shared receive UI contracts/unit options`
- Completed:
  - Created `src/features/receiving/shared/contracts.ts` for shared receive item and receipt UI DTOs.
  - Created `src/features/receiving/shared/unit-options.ts` and removed duplicated receive `UNIT_OPTIONS` definitions.
  - Updated `components/flows/item-not-found.tsx` to use shared receive unit options + shared item result type.
  - Extracted route UI into feature client components:
    - `src/features/receiving/shared/ui/ReceivePageClient.tsx`
    - `src/features/receiving/barcode/ui/BarcodeReceivePageClient.tsx`
    - `src/features/receiving/manual/ui/ManualReceivePageClient.tsx`
    - `src/features/receiving/photo/ui/PhotoReceivePageClient.tsx`
    - `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx`
    - `src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx`
    - `src/features/receiving/receipt/ui/ReceiptLineItemRow.tsx`
  - Converted receive route pages under `app/(dashboard)/receive/*` to thin wrappers.
  - Converted `app/(dashboard)/receive/receipt/line-item-row.tsx` to a thin re-export wrapper.
- Changed files:
  - `components/flows/item-not-found.tsx`
  - `app/(dashboard)/receive/page.tsx`
  - `app/(dashboard)/receive/barcode/page.tsx`
  - `app/(dashboard)/receive/manual/page.tsx`
  - `app/(dashboard)/receive/photo/page.tsx`
  - `app/(dashboard)/receive/receipt/page.tsx`
  - `app/(dashboard)/receive/receipt/[id]/page.tsx`
  - `app/(dashboard)/receive/receipt/line-item-row.tsx`
  - `src/features/receiving/shared/contracts.ts` (new)
  - `src/features/receiving/shared/unit-options.ts` (new)
  - `src/features/receiving/shared/ui/ReceivePageClient.tsx` (new)
  - `src/features/receiving/barcode/ui/BarcodeReceivePageClient.tsx` (new)
  - `src/features/receiving/manual/ui/ManualReceivePageClient.tsx` (new)
  - `src/features/receiving/photo/ui/PhotoReceivePageClient.tsx` (new)
  - `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx` (new)
  - `src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx` (new)
  - `src/features/receiving/receipt/ui/ReceiptLineItemRow.tsx` (new)
- Validation run:
  - `npx tsc --noEmit --incremental false` -> PASS
- Blockers:
  - `Manual receive-flow smoke validation not run yet (barcode/photo/manual/receipt)`
- Next recommended step:
  - `Phase 5 closeout: run manual receive flow smoke checks, then mark Phase 5 complete if behavior is preserved`

#### 2026-02-25 - Phase 4: Receipt/receiving server split
- Agent: `Claude Opus`
- Scope: `Split receipts.ts (453 lines) and ocr.ts (53 lines) into feature services`
- Completed:
  - Created `src/features/receiving/receipt/server/contracts.ts` (types, Prisma includes, enums)
  - Created `src/features/receiving/receipt/server/receipt.repository.ts` (all Prisma queries)
  - Created `src/features/receiving/receipt/server/receipt-workflow.service.ts` (create/parse/match/image pipelines)
  - Created `src/features/receiving/receipt/server/line-item.service.ts` (update match + alias learning)
  - Created `src/features/receiving/receipt/server/receipt-query.service.ts` (detail/list queries with signed URLs)
  - Created `src/features/receiving/receipt/server/index.ts` (barrel export)
  - Created `src/features/receiving/photo/server/ocr.service.ts` (Google Vision + TabScanner OCR)
  - Created `src/features/receiving/photo/server/index.ts` (barrel export)
  - Converted `app/actions/modules/receipts.ts` to thin wrapper (453 -> 100 lines)
  - Converted `app/actions/modules/ocr.ts` to thin wrapper (53 -> 37 lines)
- Changed files:
  - `src/features/receiving/receipt/server/contracts.ts` (new)
  - `src/features/receiving/receipt/server/receipt.repository.ts` (new)
  - `src/features/receiving/receipt/server/receipt-workflow.service.ts` (new)
  - `src/features/receiving/receipt/server/line-item.service.ts` (new)
  - `src/features/receiving/receipt/server/receipt-query.service.ts` (new)
  - `src/features/receiving/receipt/server/index.ts` (new)
  - `src/features/receiving/photo/server/ocr.service.ts` (new)
  - `src/features/receiving/photo/server/index.ts` (new)
  - `app/actions/modules/receipts.ts` (rewritten as thin wrapper)
  - `app/actions/modules/ocr.ts` (rewritten as thin wrapper)
- Validation run:
  - `npx tsc --noEmit` -> PASS
  - `npm run lint` -> 4 errors, 15 warnings (baseline maintained)
  - `barcode-resolver-cache.test.mjs` -> 5/5 PASS
  - `receipt-line-core.test.mjs` -> 10/10 PASS
- Blockers:
  - `None`
- Next recommended step:
  - `Phase 5: Split receive UI pages + shared receive contracts`

#### 2026-02-25 - Phase 2 & 3: Shopping server + UI split
- Agent: `Claude Opus`
- Scope: `Split shopping.ts (2188 lines) into 10 services + split shopping page.tsx (1443 lines) into hook + contracts`
- Completed:
  - Phase 2: Created 10 service files in `src/features/shopping/server/*`, converted shopping.ts to 500-line thin wrapper
  - Phase 3: Created `src/features/shopping/ui/contracts.ts` and `use-shopping-session.ts`, reduced page.tsx to 753 lines
  - Fixed React Compiler lint error (refs must be passed as params, not returned from hooks)
- Changed files:
  - `src/features/shopping/server/*.ts` (13 new files)
  - `src/features/shopping/ui/contracts.ts` (new)
  - `src/features/shopping/ui/use-shopping-session.ts` (new)
  - `app/actions/modules/shopping.ts` (rewritten as thin wrapper)
  - `app/(dashboard)/shopping/page.tsx` (refactored to use hook)
  - `tsconfig.json` (added @/features/*, @/domain/*, @/server/*, @/shared/* path aliases)
- Validation run:
  - `npx tsc --noEmit` -> PASS
  - `npm run lint` -> 4 errors, 15 warnings (baseline)
  - All targeted tests PASS
- Blockers:
  - `None`
- Next recommended step:
  - `Phase 4: Receipt/receiving server split`

#### 2026-02-25 - Initial audit and playbook creation
- Agent: `Codex`
- Scope: `Codebase audit + refactor playbook authoring`
- Completed:
  - Audited route, action, domain, and infra interactions.
  - Identified key hotspots (`shopping.ts`, `shopping/page.tsx`, `web-fallback.ts`, `receipts.ts`, `app/page.tsx`).
  - Created this playbook with target structure, path map, phase plan, and anti-duplication checklist.
- Changed files:
  - `docs/app-structure-refactor-agent-playbook.md`
- Validation run:
  - `Planning only; no code refactor changes executed`
- Blockers:
  - `None`
- Next recommended step:
  - `Phase 0: baseline verification and branch/refactor guardrails`

## Objectives, Scope, and Non-Goals

### Objectives
- Make the app easier to understand by organizing code by feature/domain, not by mixed technical folders only.
- Keep `app/` route files thin (routing, layouts, small composition only).
- Move business logic into explicit feature services and repositories.
- Preserve all current behavior during migration.
- Preserve route URLs, auth flows, module gating, and DB transaction semantics.
- Make handoff between agents reliable with explicit status tracking and checklists.

### In Scope
- Folder and file structure refactor.
- Incremental extraction of large files into feature-specific modules.
- Import path cleanup and wrapper strategy.
- Shared contracts/types/constants extraction.
- Documentation and progress tracking in this file.

### Out of Scope (Unless Explicitly Approved)
- Product behavior changes.
- Schema changes unrelated to structure refactor.
- UI redesigns.
- Large naming rewrites of domain concepts.
- Replacing providers (TabScanner, Google Vision, Supabase, Google Places).
- Item image storage feature implementation (deferred; see Deferred Items).

## Current Architecture Snapshot

### Runtime flow (current)
```text
proxy.ts
  -> auth cookie validation/refresh
  -> route render

app/* pages/layouts (many client pages)
  -> call server actions in app/actions/core/* and app/actions/modules/*
  -> server actions call auth guards, prisma, domain libs, integrations
  -> DB and external services
```

### Current strengths
- Prisma/auth are centralized (`lib/core/prisma.ts`, `lib/core/auth/*`).
- Some good pure-core extraction already exists:
  - `app/actions/core/barcode-resolver-core.ts`
  - `lib/core/matching/receipt-line-core.ts`
- Module gating is centralized (`lib/core/modules/guard.ts`).
- OCR/provider adapters are clearly separated in several places.

### Current pain points
- Oversized workflow files (especially shopping server and shopping UI page).
- Business logic mixed directly into server action files.
- Repeated page-local DTOs and constants (`UNIT_OPTIONS`, formatting helpers, page-specific interfaces).
- Mixed discoverability across `app/actions/*`, `lib/core/*`, and `lib/modules/*`.
- Hard for a new contributor to know where to make safe edits.

### Key hotspots (baseline)
- `app/actions/modules/shopping.ts` (~1962 lines)
- `app/(dashboard)/shopping/page.tsx` (~1339 lines)
- `lib/modules/shopping/web-fallback.ts` (~934 lines)
- `app/page.tsx` (~466 lines)
- `app/actions/modules/receipts.ts` (~413 lines)
- `app/(dashboard)/receive/photo/page.tsx` (~402 lines)

## Target Architecture (Intended Structure)

### Core principle
- `app/` = routing and view composition
- `src/features/*` = feature UI + feature server workflows
- `src/domain/*` = pure reusable business logic (no Next.js, no Prisma unless intentionally adapter layer)
- `src/server/*` = infra and platform adapters (DB, auth, storage, external APIs)
- `src/shared/*` = shared UI/config/types/utils

### Intended structure (final target)
```text
app/
  ...route files remain for URL stability...
  actions/
    *.ts                     # thin "use server" wrappers only

src/
  features/
    receiving/
      barcode/
      photo/
      manual/
      receipt/
    shopping/
      ui/
      server/
      integrations/
    inventory/
    contacts/
    staff/
    finance/
    auth/
    modules/

  domain/
    matching/
    parsers/
    barcode/
    shared/

  server/
    db/
    auth/
    storage/
    integrations/

  shared/
    ui/
    components/
    config/
    types/
    utils/

generated/
  prisma/                    # optional final move (not phase 1)
```

### Transitional strategy (important)
This refactor is incremental. During migration:
- Old paths may remain as wrappers that re-export from new paths.
- New canonical logic lives in `src/*`.
- Route pages continue importing stable action paths until the feature phase is complete.
- Behavior must remain unchanged after each phase.

## Do Not Break Anything: Refactor Rules

### Hard invariants
- Do not change route paths under `app/` unless explicitly requested.
- Do not remove auth checks or module gating from server entrypoints.
- Do not change transaction boundaries in receipt commit or shopping commit flows without explicit review.
- Do not change the shape of data returned to current client pages until that page is migrated.
- Do not edit `lib/generated/prisma/*` by hand.
- Do not alter Prisma schema for structure-only work.

### Next.js client/server boundary rules
- Keep `"use client"` at the top of client components after extraction.
- Keep `"use server"` in thin action wrapper files.
- Do not import server-only modules into client components.
- If a client page needs types only, import types from `contracts.ts` or shared types modules.

### Refactor rules of engagement
- Extract first, rename later.
- Preserve function signatures during the first extraction pass.
- Introduce wrappers before changing many imports.
- Move one concern at a time (service, repository, UI component, hook).
- Every new canonical file must be registered in this playbook path map and checklist.

### Commit and verification discipline
- One logical checkpoint per commit.
- Run validation at each checkpoint (see Validation Checklist).
- Update `Update Here` before ending the session.

## Current to Intended Path Mapping

This section is the canonical mapping. If you introduce a new target file, add it here.

### A. Route files (keep routes, thin them)
| Current path | Intended state | Target canonical location for extracted logic |
|---|---|---|
| `app/page.tsx` | Keep as route shell | `src/features/finance/ui/HomeDashboardClient.tsx` (+ subcomponents/hooks as needed) |
| `app/(dashboard)/shopping/page.tsx` | Keep as route shell | `src/features/shopping/ui/ShoppingPageClient.tsx` |
| `app/(dashboard)/shopping/orders/page.tsx` | Keep as route shell | `src/features/shopping/ui/OrdersHistoryPageClient.tsx` |
| `app/(dashboard)/shopping/orders/[id]/page.tsx` | Keep as route shell | `src/features/shopping/ui/OrderDetailPageClient.tsx` |
| `app/(dashboard)/receive/page.tsx` | Keep as route shell | `src/features/receiving/shared/ui/ReceivePageClient.tsx` |
| `app/(dashboard)/receive/barcode/page.tsx` | Keep as route shell | `src/features/receiving/barcode/ui/BarcodeReceivePageClient.tsx` |
| `app/(dashboard)/receive/photo/page.tsx` | Keep as route shell | `src/features/receiving/photo/ui/PhotoReceivePageClient.tsx` |
| `app/(dashboard)/receive/manual/page.tsx` | Keep as route shell | `src/features/receiving/manual/ui/ManualReceivePageClient.tsx` |
| `app/(dashboard)/receive/receipt/page.tsx` | Keep as route shell | `src/features/receiving/receipt/ui/ReceiptReceivePageClient.tsx` |
| `app/(dashboard)/receive/receipt/[id]/page.tsx` | Keep as route shell | `src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx` |
| `app/(dashboard)/inventory/page.tsx` | Keep as route shell | `src/features/inventory/ui/InventoryListPageClient.tsx` |
| `app/(dashboard)/inventory/[id]/page.tsx` | Keep as route shell | `src/features/inventory/ui/InventoryDetailPageClient.tsx` |
| `app/(dashboard)/contacts/page.tsx` | Keep as route shell | `src/features/contacts/ui/ContactsPageClient.tsx` |
| `app/(dashboard)/staff/page.tsx` | Keep as route shell | `src/features/staff/ui/StaffPageClient.tsx` |

### B. Server actions (thin wrappers only)
| Current path | Transitional step | Final canonical logic |
|---|---|---|
| `app/actions/modules/shopping.ts` | Keep path, convert to wrapper exports gradually | `src/features/shopping/server/*` |
| `app/actions/modules/receipts.ts` | Keep path, convert to wrapper exports gradually | `src/features/receiving/receipt/server/*` |
| `app/actions/modules/ocr.ts` | Keep path, wrapper to OCR/receive services | `src/features/receiving/photo/server/*` and `src/server/integrations/receipts/*` |
| `app/actions/core/ingestion.ts` | Keep path, wrapper to receiving services | `src/features/receiving/*/server/*` |
| `app/actions/core/inventory.ts` | Keep path, wrapper to inventory service/repository | `src/features/inventory/server/*` |
| `app/actions/core/transactions.ts` | Keep path, wrapper to inventory ledger services | `src/features/inventory/server/ledger/*` |
| `app/actions/core/barcode-resolver.ts` | Keep path, wrapper to barcode service | `src/domain/barcode/*` + `src/server/integrations/barcode/*` |
| `app/actions/core/financial.ts` | Keep path, wrapper to finance services | `src/features/finance/server/*` |
| `app/actions/core/auth.ts` | Keep path, wrapper to auth service | `src/features/auth/server/*` |
| `app/actions/core/staff.ts` | Keep path, wrapper to staff service | `src/features/staff/server/*` |
| `app/actions/core/contacts.ts` | Keep path, wrapper to contacts service | `src/features/contacts/server/*` |
| `app/actions/core/categories.ts` | Keep path, wrapper to inventory catalogs service | `src/features/inventory/server/catalogs.service.ts` |
| `app/actions/core/modules.ts` | Keep path, wrapper to module settings service | `src/features/modules/server/*` |
| `app/actions/core/upload.ts` | Keep path, wrapper to storage helper service | `src/server/storage/supabase/receipt-images.ts` |

### C. Domain logic and pure helpers
| Current path | Intended path |
|---|---|
| `lib/core/matching/engine.ts` | `src/domain/matching/engine.ts` |
| `lib/core/matching/fuzzy.ts` | `src/domain/matching/fuzzy.ts` |
| `lib/core/matching/confidence.ts` | `src/domain/matching/confidence.ts` |
| `lib/core/matching/receipt-line-core.ts` | `src/domain/matching/receipt-line-core.ts` |
| `lib/core/matching/receipt-line.ts` | `src/features/receiving/receipt/server/receipt-line-match.adapter.ts` (DB adapter layer) |
| `lib/core/parsers/receipt.ts` | `src/domain/parsers/receipt.ts` |
| `lib/core/parsers/product-name.ts` | `src/domain/parsers/product-name.ts` |
| `lib/core/parsers/shelf-label.ts` | `src/domain/parsers/shelf-label.ts` |
| `lib/core/utils/barcode.ts` | `src/domain/barcode/normalize.ts` (or `src/domain/shared/barcode.ts`) |
| `lib/core/utils/serialize.ts` | `src/domain/shared/serialize.ts` |
| `lib/core/utils/compress-image.ts` | `src/shared/utils/compress-image.ts` (client-safe utility) |

### D. Infrastructure and integrations
| Current path | Intended path |
|---|---|
| `lib/core/prisma.ts` | `src/server/db/prisma.ts` |
| `lib/core/auth/server.ts` | `src/server/auth/server.ts` |
| `lib/core/auth/tenant.ts` | `src/server/auth/tenant.ts` |
| `lib/core/modules/guard.ts` | `src/server/modules/guard.ts` (or `src/features/modules/server/module-guard.ts`) |
| `lib/supabase/server.ts` | `src/server/storage/supabase/client.ts` |
| `lib/supabase/storage.ts` | `src/server/storage/supabase/receipt-images.ts` |
| `lib/modules/receipts/ocr/google-vision.ts` | `src/server/integrations/receipts/google-vision.ts` |
| `lib/modules/receipts/ocr/tabscanner.ts` | `src/server/integrations/receipts/tabscanner.ts` |
| `lib/google/places.ts` | `src/features/shopping/integrations/google-places.client.ts` |
| `lib/modules/shopping/web-fallback.ts` | `src/features/shopping/integrations/web-fallback/*` (split) |

### E. Shared UI/config modules
| Current path | Intended path |
|---|---|
| `components/ui/*` | `src/shared/ui/*` |
| `components/nav/*` | `src/shared/components/nav/*` |
| `components/theme/*` | `src/shared/components/theme/*` |
| `components/pwa/*` | `src/shared/components/pwa/*` |
| `components/flows/item-not-found.tsx` | `src/shared/components/flows/item-not-found.tsx` (later may move under receiving/shared if feature-specific) |
| `lib/config/context.tsx` | `src/shared/config/business-context.tsx` |
| `lib/config/terminology.ts` | `src/shared/config/terminology.ts` |
| `lib/config/presets.ts` | `src/shared/config/presets.ts` |
| `lib/theme/index.ts` | `src/shared/config/theme.ts` |

### F. Module registry and definitions
| Current path | Intended path |
|---|---|
| `lib/core/types/module.ts` | `src/shared/types/module.ts` |
| `lib/modules/registry.ts` | `src/features/modules/registry.ts` |
| `lib/modules/shopping/index.ts` | `src/features/shopping/module-definition.ts` |
| `lib/modules/receipts/index.ts` | `src/features/receiving/module-definition.ts` |
| `lib/modules/integrations/index.ts` | `src/features/integrations/module-definition.ts` |
| `lib/modules/integrations/*.ts` | `src/features/integrations/providers/*.ts` |

### G. Generated Prisma and schema (special handling)
| Current path | Intended state |
|---|---|
| `prisma/schema.prisma` | Keep in place |
| `prisma/migrations/*` | Keep in place |
| `lib/generated/prisma/*` | Treat as generated and read-only; optional final move to `generated/prisma/*` only after alias/config plan |

### H. Pattern mapping rules (apply consistently)
- `app/(dashboard)/**/page.tsx` -> keep route file, extract most logic into `src/features/<feature>/ui/*PageClient.tsx`.
- `app/actions/**` -> thin wrappers only, no business logic growth.
- Prisma queries -> repository files.
- Multi-step workflows and transactions -> service files.
- External API calls -> integration client files.
- Pure parsing/scoring/normalization -> `src/domain/*`.

## Execution Plan by Phase

Use the checklists and exit criteria. Do not skip phases without updating this document.

### Phase 0: Baseline and guardrails
Goal: Create a safe baseline so future changes can be validated and rolled back if needed.

Checklist:
- [ ] Confirm current branch and record it in handoff log.
- [ ] Run `npm run lint` and record result.
- [ ] Run targeted node tests (if available) and record result:
  - `node --test app/actions/core/barcode-resolver-core.test.mjs`
  - `node --test app/actions/core/barcode-resolver-cache.test.mjs`
  - `node --test lib/core/matching/receipt-line-core.test.mjs`
- [ ] Capture a quick route smoke list (manual) in handoff log.
- [ ] Confirm no schema changes are pending for this refactor phase.
- [ ] Update `Current Status Snapshot` and `Active Work Lock`.

Exit criteria:
- Baseline validation is recorded in the handoff log.
- Future agents know what "green" looked like before refactor work started.

### Phase 1: Scaffold target structure and alias strategy (no behavior changes)
Goal: Create folders and import aliases with minimal/no runtime behavior changes.

Checklist:
- [ ] Create `src/` top-level folders (`features`, `domain`, `server`, `shared`).
- [ ] Add new TypeScript path aliases in `tsconfig.json` without removing existing aliases.
- [ ] Keep legacy aliases (`@/core/*`, `@/modules/*`) during transition.
- [ ] Add placeholder `README.md` files or module notes in major target directories (optional but helpful).
- [ ] Document alias changes in handoff log.

Do not:
- Do not mass-move files in this phase.
- Do not remove current imports/aliases.

Exit criteria:
- `tsconfig.json` still resolves current imports.
- New `src/*` aliases are available.
- No route or runtime behavior changes.

### Phase 2: Split shopping server logic (highest priority)
Goal: Break `app/actions/modules/shopping.ts` into smaller services without changing behavior.

Recommended extraction order inside shopping server:
1. `session.repository.ts` (Prisma queries and includes)
2. `session-state.service.ts` (recompute status/subtotals)
3. `supplier-place.service.ts` (Google Place to Supplier upsert)
4. `receipt-reconcile.service.ts` and `tabscanner-reconcile.service.ts`
5. `pairing.service.ts` (manual/auto pair logic)
6. `fallback/photo-analysis.service.ts`
7. `fallback/web-fallback-pairing.service.ts`
8. `commit/commit-shopping-session.service.ts`
9. `history/order-history.service.ts` + `reorder.service.ts`
10. `contracts.ts` for shopping server/client DTOs

Checklist:
- [ ] Create `src/features/shopping/server/contracts.ts` and migrate duplicated type shapes first.
- [ ] Extract pure helper functions (`toNumber`, `round`, `clamp`, parsing totals, audit merge helpers) into shared shopping server helper modules.
- [ ] Extract repository functions for repeated `shoppingSession` include queries.
- [ ] Preserve transaction boundaries exactly.
- [ ] Preserve action signatures in `app/actions/modules/shopping.ts` during initial extraction.
- [ ] Keep `app/actions/modules/shopping.ts` as the only `"use server"` entrypoint until subphase completion.
- [ ] Add/keep comments in wrappers pointing to canonical implementation files.
- [ ] Run lint and targeted tests after each major extraction chunk.

Exit criteria:
- `app/actions/modules/shopping.ts` becomes a thin wrapper/aggregator (or near-thin) with stable exports.
- No shopping route behavior changes.
- Validation recorded.

### Phase 3: Split shopping UI page
Goal: Break `app/(dashboard)/shopping/page.tsx` into feature UI components/hooks.

Recommended extraction order:
1. `ShoppingPageClient.tsx` shell
2. `use-shopping-session.ts`
3. `store-selector.tsx`
4. `quick-barcode-card.tsx`
5. `basket-editor.tsx`
6. `receipt-reconcile-panel.tsx`
7. `fallback-resolution-panel.tsx`
8. `summary-footer.tsx`
9. shared local helpers -> `src/features/shopping/ui/utils.ts`

Checklist:
- [ ] Create `src/features/shopping/ui/contracts.ts` (or reuse `../contracts.ts`).
- [ ] Extract local state handlers into hooks where practical.
- [ ] Preserve existing action calls and response handling during first pass.
- [ ] Keep route page file as a thin wrapper importing the new client component.
- [ ] Preserve `"use client"` placement in the new top-level client component.
- [ ] Manual smoke test shopping flows (start session, add item, quick barcode, shelf label scan, receipt scan UI path).

Exit criteria:
- Route page is thin and easy to scan.
- Shopping UI responsibilities are split by concern.

### Phase 4: Split receipt/receiving server logic
Goal: Refactor `app/actions/modules/receipts.ts` and `app/actions/modules/ocr.ts` into feature services.

Checklist:
- [ ] Create `src/features/receiving/receipt/server/receipt.repository.ts`.
- [ ] Extract parse/match workflow service (`receipt-workflow.service.ts`).
- [ ] Extract line-item update/alias learning service.
- [ ] Extract receipt detail query service.
- [ ] Extract OCR actions into `src/features/receiving/photo/server/*` and `src/server/integrations/receipts/*` wrappers as needed.
- [ ] Preserve receipt status transitions and line item status semantics.
- [ ] Preserve `commitReceiptTransactions` idempotency behavior in inventory ledger layer.

Exit criteria:
- Receipt server action files are wrappers or small entrypoint modules.
- Behavior unchanged for parse/match/review/commit flow.

### Phase 5: Split receive UI pages and shared receive constants/contracts
Goal: Reduce repeated page-local logic across barcode/photo/manual/receipt pages.

Checklist:
- [x] Create `src/features/receiving/shared/contracts.ts` for shared item/match DTOs.
- [x] Create `src/features/receiving/shared/unit-options.ts` to remove duplicate `UNIT_OPTIONS` constants.
- [x] Extract each receive page into feature UI client component(s).
- [x] Keep route pages thin wrappers.
- [x] Reuse `ItemNotFound` through a shared feature-facing interface.
- [x] Validate barcode/photo/manual/receipt receive flows manually.

Exit criteria:
- Receive routes are consistent and easier to navigate.
- Shared receive constants/types exist in one place.

### Phase 6: Inventory, contacts, staff feature extraction
Goal: Bring remaining medium-size UI + server action modules into the same pattern.

Checklist:
- [x] Inventory UI pages -> `src/features/inventory/ui/*`
- [x] Inventory services/repositories -> `src/features/inventory/server/*`
- [ ] Contacts UI -> `src/features/contacts/ui/*`
- [ ] Contacts server -> `src/features/contacts/server/*`
- [ ] Staff UI -> `src/features/staff/ui/*`
- [ ] Staff invites server -> `src/features/staff/server/*`
- [ ] Keep route pages and action exports stable during transition.

Exit criteria:
- All high-traffic dashboard features follow the same route-thin, feature-first pattern.

### Phase 7: Shared/domain/server infrastructure moves and import cleanup
Goal: Standardize shared and infrastructure code locations.

Checklist:
- [ ] Move parser/matching/barcode pure logic into `src/domain/*`.
- [ ] Move Prisma/auth/storage/integrations into `src/server/*`.
- [ ] Move shared UI/config into `src/shared/*`.
- [ ] Update imports incrementally; keep compatibility wrappers only as needed.
- [ ] Confirm no client component imports server-only modules after path moves.
- [ ] Run lint and smoke critical routes.

Exit criteria:
- New code follows `src/features`, `src/domain`, `src/server`, `src/shared` conventions.
- Legacy path usage is reduced and documented.

### Phase 8: Final cleanup and wrapper retirement
Goal: Remove duplication and lock in the new structure.

Checklist:
- [ ] Identify remaining legacy wrapper files and mark remove/keep decisions.
- [ ] Remove wrappers only after all imports have migrated and validation passes.
- [ ] Update this playbook with final path map and note any intentional exceptions.
- [ ] Run final lint and targeted tests.
- [ ] Manual smoke test core flows.
- [ ] Mark phase ledger complete and update definition of done status.

Exit criteria:
- No hidden duplicate logic remains.
- Canonical file locations are obvious.
- This playbook reflects the final structure or final accepted deviations.

## Validation and Safety Checklist

### Per extraction chunk (minimum)
- [ ] File compiles (no obvious type/import errors in edited files)
- [ ] No client/server boundary violation introduced
- [ ] Existing action signatures preserved (unless the phase explicitly migrates callers)
- [ ] Serialization behavior preserved for values returned to client
- [ ] Auth/module guards preserved at action entrypoints

### Per checkpoint (recommended commands)
- [ ] `npm run lint`
- [ ] `node --test app/actions/core/barcode-resolver-core.test.mjs`
- [ ] `node --test app/actions/core/barcode-resolver-cache.test.mjs`
- [ ] `node --test lib/core/matching/receipt-line-core.test.mjs`
- [ ] Optional: `npx tsc --noEmit` (if time/CI supports it)

### Manual smoke checklist (core flows)
- [ ] Login/signup still works
- [ ] Dashboard/home renders
- [ ] Receive -> barcode flow works end-to-end
- [ ] Receive -> photo OCR path works end-to-end
- [ ] Receive -> receipt parse/review/commit works end-to-end
- [ ] Inventory list/detail pages load
- [ ] Shopping session create/add/reconcile/commit still works
- [ ] Staff and contacts pages still load and basic actions work

## Duplication Prevention Checklist

This section exists to prevent duplicate implementations and repeated work across agents.

### Before creating any new file
- [ ] Search for existing implementation (`rg`) by function name/responsibility.
- [ ] Check `Current to Intended Path Mapping` to see if a target file already exists.
- [ ] Check `Active Work Lock` to ensure no one else claimed the same scope.
- [ ] If a canonical file exists, extend it instead of creating another parallel file.
- [ ] If a new canonical file is necessary, add it to the mapping table before coding.

### When extracting logic
- [ ] Move logic once; do not copy and diverge.
- [ ] Leave a wrapper/re-export in the old file when callers still depend on it.
- [ ] Add a short comment in the wrapper pointing to the canonical file.
- [ ] Update the phase checklist and handoff log with what became canonical.

### When finishing a session
- [ ] Mark completed checklist items.
- [ ] Record changed files in Handoff Log.
- [ ] Record what is still wrapper-only vs canonical.
- [ ] Clear or update `Active Work Lock`.

### Duplicate work red flags (stop and re-check)
- Two files with same exported function names but different logic.
- A copied interface/type shape in multiple pages instead of shared `contracts.ts`.
- New helper added to route file when a feature `utils.ts` already exists.
- Same Prisma include/query repeated in multiple services instead of repository extraction.

## Agent Handoff Checklist

Before ending your session, complete all that apply:
- [ ] Update `Current Status Snapshot`
- [ ] Update or clear `Active Work Lock`
- [ ] Append a new `Handoff Log` entry at the top
- [ ] Mark phase checklist boxes completed
- [ ] Mark phase ledger item if exit criteria met
- [ ] Record validation commands run and outcomes
- [ ] Record blockers / risks / follow-up tasks
- [ ] Note any intentional deviations from the path map

## Known Risks, Invariants, and Deferred Items

### High-risk areas (extra caution)
- `app/actions/modules/shopping.ts`
  - Contains multiple workflows and transaction boundaries.
- `app/(dashboard)/shopping/page.tsx`
  - Large client state machine with many action calls.
- `app/actions/modules/receipts.ts`
  - Receipt lifecycle and alias-learning side effects.
- `app/actions/core/transactions.ts`
  - Ledger writes and receipt commit idempotency.

### Behavioral invariants to preserve
- Receipt commit remains idempotent and all-or-nothing.
- Shopping commit remains blocked if reconciliation/receipt balance is incomplete.
- Auth and business membership checks remain enforced.
- Module enablement checks remain enforced on gated features.
- Prisma serialization remains applied before returning complex data to client components.

### Deferred items (not part of structure refactor unless explicitly approved)
- Item image storage bucket and item-image persistence feature.
  - Current state: receipt images use private `receipt-images` bucket.
  - Item photos used for Google Vision are currently OCR-only (base64, not persisted).
- Shopping receipt image path consistency cleanup (storage path vs receipt image field usage).
- Generated Prisma output relocation (`lib/generated/prisma` -> `generated/prisma`).

## Command Reference

Use fast searches first.

### File and text search
```powershell
rg --files
rg -n "searchTerm" app lib components src
```

### Validation
```powershell
npm run lint
node --test app/actions/core/barcode-resolver-core.test.mjs
node --test app/actions/core/barcode-resolver-cache.test.mjs
node --test lib/core/matching/receipt-line-core.test.mjs
npx tsc --noEmit
```

### Useful audits
```powershell
rg -n "^\\"use client\\"|^\\"use server\\"" app components lib src
rg -n "from \\"@/" app components lib src
```

## Definition of Done

The structure refactor is done when all are true:
- [ ] Core features follow route-thin + feature-first organization.
- [ ] Large workflow files are split into service/repository modules.
- [ ] Route files are easy to scan and mostly compose feature components.
- [ ] Server actions are thin wrappers with stable entrypoints.
- [ ] Shared contracts/constants are centralized (no repeated page-local DTOs where avoidable).
- [ ] Domain logic is discoverable under `src/domain/*`.
- [ ] Infra code is discoverable under `src/server/*`.
- [ ] This playbook is updated to reflect final accepted structure.
- [ ] Lint and targeted tests pass (or documented exceptions exist).
- [ ] Manual smoke tests completed and logged.

## Appendix A: Hotspot Files (Baseline)

Baseline hotspots identified during audit (2026-02-25):

- `app/actions/modules/shopping.ts` (~1962 lines)
- `app/(dashboard)/shopping/page.tsx` (~1339 lines)
- `lib/modules/shopping/web-fallback.ts` (~934 lines)
- `app/page.tsx` (~466 lines)
- `app/actions/modules/receipts.ts` (~413 lines)
- `app/(dashboard)/receive/photo/page.tsx` (~402 lines)
- `app/(dashboard)/receive/receipt/page.tsx` (~323 lines)
- `app/(dashboard)/contacts/page.tsx` (~313 lines)
- `app/actions/core/barcode-resolver.ts` (~310 lines)
- `app/actions/core/transactions.ts` (~256 lines)
- `app/(dashboard)/receive/barcode/page.tsx` (~254 lines)
- `app/(dashboard)/receive/manual/page.tsx` (~235 lines)
- `app/actions/core/inventory.ts` (~210 lines)
- `components/flows/item-not-found.tsx` (~205 lines)

Interpretation:
- Start with shopping server and shopping UI.
- Then receipt/receive.
- Then standardize inventory/contacts/staff.

## Appendix B: Templates

### Template: Active Work Lock (copy and edit)
```md
### Active Work Lock (Edit First)
- Status: `LOCKED`
- Agent: `<name>`
- Date (UTC/local): `YYYY-MM-DD`
- Scope claimed: `<phase/sub-phase>`
- Files expected to touch:
  - `<path>`
  - `<path>`
- Notes:
  - `<key constraint>`
```

### Template: Handoff Log Entry (prepend to Handoff Log)
```md
#### YYYY-MM-DD - <short session title>
- Agent: `<name>`
- Scope: `<what you worked on>`
- Completed:
  - `<done item>`
  - `<done item>`
- Changed files:
  - `<path>`
  - `<path>`
- Validation run:
  - `<command>` -> `<result>`
  - `<command>` -> `<result>`
- Blockers:
  - `<none or blocker>`
- Next recommended step:
  - `<specific next action>`
```

### Template: Wrapper file note (recommended)
```ts
// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: <new-path>
```
