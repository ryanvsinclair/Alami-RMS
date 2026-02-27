# Operational Calendar (Schedule Tab) Plan

Last updated: February 27, 2026
Status: **GATE OPEN — OC-00 complete, implementation begins at OC-01**

## Execution Gate (Start Order Is Mandatory)

**OC-00 gate confirmed 2026-02-27. All prerequisites met.**

1. [x] `docs/unified-inventory-intake-refactor-plan.md` — COMPLETE (all phases UI-00 through UI-06).
2. [x] `docs/receipt-post-ocr-correction-plan.md` — COMPLETE (all phases 0 through 6, RC-19 closeout done).
3. [x] `docs/income-integrations-onboarding-plan.md` — COMPLETE (all phases IN-00 through IN-08).
4. [x] `docs/app-structure-refactor-agent-playbook.md` — COMPLETE (Phase 8 closeout done; integrated smoke passed QA-00).
5. [x] Product/engineering confirms this plan is the next active initiative — confirmed by user 2026-02-27.

Implementation is now unblocked. Next task: **OC-01** (Phase 0 activation/baseline).

## Pick Up Here

- Current task: **OC-07** - Plan closure and archive transition
- Status: READY

## Latest Update

### 2026-02-27 - OC-06 complete: Phase 5 hardening and operational metrics - reliability, load guard, permission/audit hardening

- Preflight:
  - Confirmed no existing schedule ops-hardening layer was present:
    - `rg -n "sync reliability|duplicate suppression|accuracy|performance|permission|audit|ops|metrics|stale|lock" src/features/schedule src/features/integrations src/server docs`
    - `rg --files src/features/schedule | rg "metrics|ops|audit|permission|policy|perf|performance"`
  - Reused existing sync status and schedule contracts (`schedule-sync.contracts.ts`, `schedule.contracts.ts`) and integration lock/health patterns as references.
  - DB preflight re-verified against canonical sources (no schema change required):
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260228013000_income_event_pilot/migration.sql`
- Deliverables:
  - `src/features/schedule/shared/schedule-ops.contracts.ts` (NEW): ops health summary contracts, view-mode render caps, permission/audit vocabulary, and audit entry DTO.
  - `src/features/schedule/server/schedule-ops.service.ts` (NEW): operations hardening service with:
    - sync/duplicate/overlap metrics derivation (`deriveScheduleOpsHealthSummary`)
    - deterministic view-mode load guard (`applyCalendarLoadGuard`)
    - role/source-aware permission evaluation (`evaluateCalendarPermission`)
    - audit entry builder (`buildCalendarAuditEntry`)
  - `src/features/schedule/server/schedule-ops.service.test.ts` (NEW): targeted hardening/metrics tests (5 tests).
  - `src/features/schedule/shared/index.ts` (UPDATED): exports ops contracts.
  - `src/features/schedule/server/index.ts` (UPDATED): exports ops hardening APIs.
  - `src/features/schedule/ui/ScheduleClient.tsx` (UPDATED): adds `OpsDiagnosticsBar` shell with empty-state-safe messaging.
- Validation:
  - `npx tsx --test src/features/schedule/server/scheduling-sync.service.test.ts src/features/schedule/server/schedule-suggestion.service.test.ts src/features/schedule/server/schedule-ops.service.test.ts` -> PASS (15/15)
  - `npx tsc --noEmit --incremental false` -> PASS
  - targeted `eslint` on touched schedule ops/shared/server/ui files -> PASS
- Next: OC-07 (plan closure and archive transition)

### 2026-02-27 - OC-05 complete: Phase 4 cross-feature suggestion engine - delivery/intake, booking/inventory, and job/material-gap signals

- Preflight:
  - Confirmed no existing schedule suggestion engine was present:
    - `rg -n "delivery.?intake|booking.?inventory|material.?gap|suggestion engine|cross-feature suggestion|schedule suggestion|operational suggestion" src app test docs`
    - `rg --files src app test | rg "suggest|hint|gap|schedule"`
  - Reused existing event contracts from `src/features/schedule/shared/schedule.contracts.ts` and OC-04 normalization infrastructure; no duplicate event models introduced.
  - DB preflight re-verified against canonical sources (no schema change required):
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260228013000_income_event_pilot/migration.sql`
- Deliverables:
  - `src/features/schedule/shared/schedule-suggestions.contracts.ts` (NEW): suggestion vocabulary and typed signal contracts (`delivery_to_intake`, `booking_inventory_hint`, `job_material_gap`).
  - `src/features/schedule/server/schedule-suggestion.service.ts` (NEW): deterministic suggestion derivation engine with rule paths for:
    - delivery windows lacking intake-session overlap
    - appointment/reservation inventory deficit hints
    - job-assignment material gap warnings
  - `src/features/schedule/server/schedule-suggestion.service.test.ts` (NEW): targeted rule-engine coverage (5 tests).
  - `src/features/schedule/shared/index.ts` (UPDATED): exports suggestion contracts.
  - `src/features/schedule/server/index.ts` (UPDATED): exports suggestion derivation API.
  - `src/features/schedule/ui/ScheduleClient.tsx` (UPDATED): adds `OperationalSuggestionsRail` shell so cross-feature suggestions have a visible schedule surface (empty-state safe by default).
- Validation:
  - `npx tsx --test src/features/schedule/server/scheduling-sync.service.test.ts src/features/schedule/server/schedule-suggestion.service.test.ts` -> PASS (10/10)
  - `npx tsc --noEmit --incremental false` -> PASS
  - targeted `eslint` on touched schedule shared/server/ui files -> PASS
- Next: OC-06 (Phase 5 - hardening and operational metrics)

### 2026-02-27 - OC-04 complete: Phase 3 scheduling-platform expansion - connector stubs, normalization contracts, conflict handling

- Preflight:
  - Confirmed no existing schedule server/provider connector implementation existed to extend:
    - `rg -n "connector|normalize|overlap|duplicate|dedupe|reservation|appointment" src app test docs`
    - `rg -n "schedule|calendar|provider|sync|conflict|dedupe|duplicate|overlap" test src/features/schedule`
  - Reused normalization + registry patterns from `src/features/integrations/providers/*` and `src/features/integrations/server/sync.service.ts` instead of introducing parallel orchestration.
  - DB preflight re-verified against canonical sources (no schema change required):
    - `prisma/schema.prisma`
    - latest migration `prisma/migrations/20260228013000_income_event_pilot/migration.sql`
- Deliverables:
  - `src/features/schedule/shared/schedule-normalization.contracts.ts` (NEW): scheduling-platform provider subset (`square_appointments`, `calendly`, `mindbody`, `fresha`, `vagaro`, `opentable`, `resy`); normalized event contract; duplicate/overlap reason vocabulary; conflict-resolution result contracts.
  - `src/features/schedule/server/scheduling-connectors.ts` (NEW): connector registry + env-driven fetch stubs for scheduling-platform providers; hardened field-priority mapping to canonical provider events; status normalization; fallback duration/timezone handling; deterministic event fingerprints.
  - `src/features/schedule/server/schedule-conflict.service.ts` (NEW): duplicate suppression order (`provider_external_id` -> `linked_entity` -> `fingerprint`) and overlap conflict detection (`staff_overlap`, `resource_overlap`, `time_overlap`).
  - `src/features/schedule/server/scheduling-sync.service.ts` (NEW): preview sync runner (`runSchedulingProviderSyncPreview`) that fetches/normalizes events and returns duplicate/overlap diagnostics.
  - `src/features/schedule/server/index.ts` (NEW): schedule server API surface exports.
  - `src/features/schedule/shared/index.ts` (UPDATED): exports normalization/conflict contracts for OC-04 consumers.
  - `src/features/schedule/server/scheduling-sync.service.test.ts` (NEW): targeted tests for normalization, duplicate suppression, overlap detection, and sync-preview accounting.
- Validation:
  - `npx tsx --test src/features/schedule/server/scheduling-sync.service.test.ts` -> PASS (5/5)
  - `npx tsc --noEmit --incremental false` -> PASS
  - targeted `eslint` on touched schedule server/shared files -> PASS
- Next: OC-05 (Phase 4 - cross-feature suggestion engine)

### 2026-02-27 — OC-03 complete: Phase 2 provider-sync foundation — catalog, health contracts, SourceHealthBar

- Deliverables:
  - `src/features/schedule/shared/schedule-provider.contracts.ts`: 10-provider catalog (Google Calendar, Outlook/M365, Apple ICS, Square Appointments, Calendly, Mindbody, Fresha, Vagaro, OpenTable, Resy); provider types (`general_calendar`, `booking_platform`, `reservation_platform`); auth methods; per-provider event-type capabilities and industry support map; `listCalendarProvidersForIndustry`, `getCalendarProviderById`, `isCalendarProviderRecommendedForIndustry` helpers
  - `src/features/schedule/shared/schedule-sync.contracts.ts`: 6-value `CalendarSyncStatus` vocabulary; `CalendarProviderSyncCard` normalized presentation contract; `CalendarSourceHealthSummary` aggregated health shape with `healthy | degraded | error` indicator; `deriveCalendarSourceHealth` client-side utility; `CALENDAR_PROVIDER_ACCENT_COLORS` accent map (unique Tailwind color per provider); `getProviderAccentColor` helper
  - `src/features/schedule/shared/index.ts`: updated to re-export all new provider catalog and sync health types
  - `src/features/schedule/ui/ScheduleClient.tsx`: `SourceHealthBar` component added — shows quiet "no sources" callout when empty; shows health dot + connected count + error count + per-provider accent dots when sync cards are present
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint` on all 4 touched files → PASS
- Next: OC-04 (Phase 3 — appointment/reservation connector stubs, event normalization layer, overlap detection)

### 2026-02-27 — OC-02 complete: Phase 1 master calendar shell — ScheduleClient

- Deliverables:
  - `src/features/schedule/ui/ScheduleClient.tsx`: master calendar shell with Day/Week/Month toggle (week default), source visibility filters (Manual / Internal / Connected), industry-aware subtitle, "New Event" CTA stub, and three grid shells (WeekGridShell, DayColumnShell, MonthGridShell)
  - `app/(dashboard)/schedule/page.tsx`: updated from Phase 0 placeholder to wrap `ScheduleClient`
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint` → PASS
- Next: OC-03 (Phase 2 — provider sync foundation: adapters, source health indicators, dedupe)

### 2026-02-27 — OC-01 complete: Phase 0 activation and baseline

- Preflight: no existing schedule/event/calendar code — greenfield confirmed.
- Deliverables:
  - `src/features/schedule/shared/schedule.contracts.ts`: canonical event vocabulary (CalendarEventType × 8, CalendarEventSource, CalendarEventEditability, CalendarEventStatus, CalendarViewMode, CalendarEventSummary, DEFAULT_EDITABILITY_BY_SOURCE, CALENDAR_EVENT_EMPHASIS_BY_INDUSTRY)
  - `src/features/schedule/shared/index.ts`: public API surface for schedule feature
  - `app/(dashboard)/schedule/page.tsx`: route shell (Phase 0 placeholder; full UI in OC-02)
  - `app/(dashboard)/schedule/layout.tsx`: route layout (no module gate — Schedule is a core feature)
  - `components/nav/bottom-nav.tsx`: nav updated to final target order (Home | Staff | Intake | Inventory | Schedule); Integrations removed from primary nav slots
- Validation: `npx tsc --noEmit --incremental false` → PASS; `npx eslint` on all 5 touched files → PASS
- Next: OC-02 (Phase 1 — master calendar shell with Day/Week/Month toggle)

### 2026-02-27 — OC-00 complete: execution gate confirmed, plan unblocked

- All 5 gate prerequisites verified against live plan docs and codebase state.
- No existing `/schedule` route, no nav entry — clean start confirmed.
- No prior implementation to reuse/refactor/remove for Phase 0 — greenfield.
- Next: OC-01 (Phase 0 — define canonical event contracts, align nav/route ownership, confirm activation baseline).

## What This Tab Is

This is not a simple "Schedule" page.

It is the **Operational Calendar**:

- a unified time-based layer for the business
- one calendar that aggregates internal and external operational events
- a cross-feature coordination surface, not a single-industry booking tool

## Core Product Definition

Everything shown in the calendar is an **Event**.

The calendar aggregates:

- appointments
- reservations
- staff bookings/shifts
- supplier delivery windows
- inventory intake sessions
- manual blocks
- third-party synced events

Design principle:

- build for event-based resource allocation across industries, not salon-only scheduling.

## Cross-Industry Applicability

### Salons

- client bookings
- staff calendars
- service duration blocks
- walk-in blocks

### Restaurants

- table reservations
- catering bookings
- supplier delivery windows
- private events

### Contractors

- job site bookings
- staff assignments
- material delivery windows
- equipment rental slots

### Retail

- vendor appointments
- staff shifts
- delivery windows
- customer pickup reservations

## Navigation Target

Bottom navigation target after Intake unification:

1. Home
2. Staff
3. Add (Inventory Intake)
4. Inventory
5. Schedule

Important:

- this nav state is a dependency of this plan; do not partially introduce schedule nav before Intake regrouping is complete.

## Schedule Landing UX

Default landing:

- **Master Calendar** with Day/Week/Month toggle
- default view: **Week**

Recommended first-surface controls:

- source visibility toggles
- staff/resource filters
- quick event creation (manual event, manual block)
- sync status summary

## Unified Event Model (Conceptual)

Event types:

- Appointment
- Reservation
- Delivery
- Intake Session
- Manual Block
- Staff Shift
- Job Assignment

Shared event shape (conceptual, no schema specifics):

- time window (start/end + timezone)
- event type
- title/summary
- source (`manual`, `internal`, `external provider`)
- editability (`read_only` by policy)
- associated staff (optional)
- associated resource (optional)
- linked entity (customer/supplier/job/session/etc., optional)
- source metadata (provider/source id, sync state)

## Integration Layer

Potential providers/systems:

- Google Calendar
- Outlook / Microsoft 365
- Apple Calendar (ICS feed)
- Square Appointments
- Mindbody
- Fresha
- Calendly
- OpenTable
- Resy
- Shopify bookings
- Vagaro
- other reservation/booking widgets where API/ICS is available

Integration behavior:

- pull provider events into normalized internal event format
- preserve source identity for dedupe/sync
- apply source-level visibility and color coding

## Aggregation and Conflict Rules

Defaults:

- external events are read-only
- manual events are editable
- internal-system events follow internal ownership policy

Duplicate detection order:

1. provider external ID + provider/source key (primary)
2. internal linked entity ID (for internal-system events)
3. fallback fingerprint (start time + normalized title + resource/staff context)

Collision handling:

- keep canonical source event
- suppress or merge duplicate rendering
- mark ambiguous collisions for review, not destructive auto-merge

## Sync Model (High-Level)

Sync behavior:

- interval sync by provider
- webhook-triggered sync where providers support it
- incremental window reconciliation
- per-provider health status (last success, errors, stale warnings)

User controls:

- enable/disable source
- source color
- read-only override policy (if business allows)

## Capability-Driven UI (Not Hardcoded by Industry)

Calendar actions/sections should be driven by capabilities:

- Restaurants: show reservation + delivery emphasis.
- Contractors: show job assignment + delivery windows emphasis.
- Salons: show appointment + staff schedule emphasis.
- Retail: show vendor + shift + pickup emphasis.

Rule:

- same event platform, different capability surfaces.
- no one-off vertical-specific calendar architecture.

## Simple Mode (No Integrations Required)

If no integrations are connected, schedule still works with:

- manual appointments
- staff assignment
- manual time blocks
- repeating schedules

No external provider dependency should be required for core use.

## Cross-Feature Coordination Potential (Future-Ready)

Examples to support with non-blocking suggestions:

- Delivery event -> suggest creating/prep an Intake Session
- Service booking -> surface projected inventory usage hint
- Job booking -> flag likely material gaps against inventory

Guardrail:

- suggestions/alerts only by default
- no automatic inventory commits from calendar events

## Architecture Layers (High-Level)

1. Event Core
2. Event Source Layer (`manual`, `internal`, `provider`)
3. Normalization Layer
4. Sync Orchestrator
5. Resource Linking Layer (staff/supplier/inventory/job/customer references)
6. Policy Layer (editability, permissions, visibility)
7. Display Layer (day/week/month + filters)

No table/column design is specified in this plan.

## Rollout Strategy (After Gate Opens)

### Phase 0 - Activation and baseline

- confirm all gating plans are complete
- define canonical event contracts and source policy
- align nav and route ownership

### Phase 1 - Manual + internal operational calendar

- master calendar shell (day/week/month; week default)
- manual events and blocks
- internal event ingestion (intake sessions, staff data, supplier windows where available)

### Phase 2 - Provider sync foundation

- calendar-provider sync adapters
- source toggles/color coding/read-only controls
- dedupe and source health indicators

### Phase 3 - Scheduling-platform expansion

- appointment/reservation platform connectors
- normalized mapping hardening
- overlap/duplicate conflict handling

### Phase 4 - Cross-feature suggestion engine

- delivery->intake suggestions
- booking->inventory hints
- job->material-gap warnings

### Phase 5 - Hardening and operational metrics

- sync reliability metrics
- duplicate suppression accuracy
- calendar load/performance tuning
- permission and audit hardening

## Success Criteria

1. One calendar view supports all target industries without vertical lock-in.
2. Users operate from intent and operational context, not technical input tools.
3. External and internal events coexist with predictable dedupe/editability behavior.
4. Simple mode remains fully usable without integrations.
5. Calendar safely coordinates staffing, deliveries, reservations, and intake timing.

## Explicit Non-Goals

- No provider-specific DB schema in this document.
- No commitment to every listed integration in initial release.
- No replacement of intake/matching/correction engines.
- No forced migration that breaks existing workflows during rollout.




