# Operational Calendar (Schedule Tab) Plan

Last updated: February 27, 2026 (draft / sequencing-locked, planning-only)

## Execution Gate (Start Order Is Mandatory)

This plan is **strictly blocked** until all prior plans are complete.

Start this plan only after:

1. `docs/unified-inventory-intake-refactor-plan.md` is implemented (Shopping + Receive unified into Inventory Intake workflows).
2. `docs/receipt-post-ocr-correction-plan.md` implementation phases are complete/stable for production use.
3. `docs/income-integrations-onboarding-plan.md` core onboarding/integration path is complete enough for production rollout.
4. `docs/app-structure-refactor-agent-playbook.md` closeout tasks are complete (including final integrated smoke expectations).
5. Product/engineering explicitly confirms this plan is the next active initiative.

Until those are done, this document remains planning-only and **must not enter implementation**.

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

