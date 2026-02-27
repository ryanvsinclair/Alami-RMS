# Income Integrations Onboarding Plan

Last updated: February 27, 2026 (Phase 6 reporting + connection health indicators complete)

## Latest Update

- **IN-06 complete: connection health indicators + stale sync warnings — syncStale badge, lastErrorMessage, richer card UI** (February 27, 2026):
  - Preflight scans confirmed: `lastSyncAt` already in contract and catalog; `last_error_message` already on `BusinessIncomeConnection`; Badge component already has `warning` variant — no new schema migration required.
  - IN-06 scoped additions (reuse-first):
    - Added `SYNC_STALE_THRESHOLD_MS = 24h` constant + `syncStale: boolean` field to `IncomeProviderConnectionCard` contract
    - Added `lastErrorMessage: string | null` field to `IncomeProviderConnectionCard` contract
    - `provider-catalog.ts`: populates `syncStale` (connected with no sync or >24h ago) and `lastErrorMessage` from `connection.last_error_message`
    - `IncomeProviderConnectCard.tsx`: shows `Sync Stale` warning badge when `syncStale=true`; shows "Connected but no sync has run yet" prompt; shows error message when `status="error"` and `lastErrorMessage` is present
    - `provider-catalog.test.mjs`: added assertions for `syncStale=false` and `lastErrorMessage=null` on unconnected cards
  - Validation:
    - `npx tsx --test ...provider-catalog.test.mjs ...oauth.service.test.mjs` -> PASS (6/6)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted eslint on all touched files -> PASS

- **IN-05 complete: scheduled sync + webhook hardening — cron runner, sync lock guard, webhook verification endpoints** (February 27, 2026):
  - Preflight scans confirmed: `INCOME_SYNC_SCHEDULER_STRATEGY = "internal_cron_route"` already defined; `last_webhook_at` already on `BusinessIncomeConnection`; `ExternalSyncLog.status` already supports reuse as soft lock — no new schema migration required.
  - IN-05 scoped additions (reuse-first):
    - Sync lock guard in `runProviderManualSync`: `ExternalSyncLog.findFirst` where `status="running"` and `started_at >= lockCutoff (now - 10 min)` — rejects duplicate concurrent syncs per business+source; stale locks (>10 min) are ignored automatically
    - `runAllProvidersCronSync` in `sync.service.ts`: iterates `CRON_PROVIDER_CONFIGS`, finds all `connected` connections per provider across all businesses, syncs each independently with full error isolation (lock conflicts → `skipped`, real errors → `failed`, no abort on partial failure)
    - `app/api/integrations/sync/cron/route.ts`: internal cron route secured by `INCOME_CRON_SECRET` Bearer token, returns `{ attempted, succeeded, skipped, failed, details[] }`
    - `src/features/integrations/server/webhook-crypto.ts`: `verifyHmacSha256Signature` (HMAC-SHA256 with `crypto.timingSafeEqual` for timing-safe comparison) + `readRawBody` helper
    - `app/api/integrations/webhooks/uber-eats/route.ts`: verifies `X-Uber-Signature: sha256=<hex>` via `INCOME_WEBHOOK_SECRET_UBER_EATS`, updates `last_webhook_at` on matching connection
    - `app/api/integrations/webhooks/doordash/route.ts`: verifies `X-DoorDash-Signature: <hex>` via `INCOME_WEBHOOK_SECRET_DOORDASH`, same pattern
    - `sync.service.test.mjs` extended to 11 tests: 3 new sync lock guard tests (non-stale blocks, null proceeds, stale passes through)
  - Validation:
    - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS (11/11)
    - `node --test src/features/integrations/providers/uber-eats.provider.test.mjs src/features/integrations/providers/doordash.provider.test.mjs` -> PASS (25/25)
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted eslint on all touched files -> PASS

- **IN-04 complete: restaurant rollout providers — Uber Eats + DoorDash adapters, generic sync runner, routes, catalog wiring** (February 27, 2026):
  - Preflight scans confirmed `uber_eats` and `doordash` already in `FinancialSource` enum + home dashboard income breakdown.
  - IN-04 scoped additions (reuse-first):
    - `uber-eats.provider.ts`: field-priority normalization (id/order_id/workflow_uuid, total_price/gross_earnings, service_fee/uber_fee/commission, payout_amount/net_earnings, currency_code)
    - `doordash.provider.ts`: field-priority normalization (id/delivery_id/order_id/external_delivery_id, subtotal/order_total, commission_amount/fee, payout_amount, delivery_status)
    - Generalized `sync.service.ts` to `runProviderManualSync` shared runner; added `runUberEatsManualSync` + `runDoorDashManualSync`
    - `app/api/integrations/sync/uber-eats/manual/route.ts` + `app/api/integrations/sync/doordash/manual/route.ts`
    - Provider catalog: `SYNC_ENABLED_PROVIDERS` set + `buildSyncHref` lookup — one place to add future providers
    - 25 provider normalization unit tests (12 DoorDash + 13 Uber Eats)
  - Validation:
    - All 39 targeted tests pass (25 provider + 8 sync service + 6 catalog/oauth)
    - `npx tsc --noEmit` -> PASS
    - targeted eslint -> PASS

- **IN-03 complete: GoDaddy POS pilot end-to-end (sync service tests + last_sync_at dashboard projection visibility)** (February 27, 2026):
  - Preflight scans confirmed the full pilot path was architecturally present in prior slices:
    - `sync.service.ts` already implements `runGoDaddyPosManualSync` with `IncomeEvent` upsert + `FinancialTransaction` projection
    - `godaddy-pos.provider.ts` already implements event fetch + normalization adapter
    - `app/api/integrations/sync/godaddy-pos/manual/route.ts` already exposes manual sync endpoint
    - `connections.repository.ts` already handles sync success/error marking
    - home dashboard already queries `FinancialTransaction.source = "godaddy_pos"` for income layer
  - IN-03 scoped additions (reuse-first, no duplicate services created):
    - Added `sync.service.test.mjs` (8 tests): full pilot unit test coverage for sync business rules:
      - missing connection throws
      - missing access token throws
      - full sync uses 90-day historical window
      - incremental sync uses `last_sync_at` as since date
      - event upserted as `IncomeEvent` and projected to `FinancialTransaction` with correct shape
      - multiple events isolated correctly
      - provider fetch error marks connection as error + writes failed sync log
      - zero events completes successfully
    - Extended `IncomeProviderConnectionCard` contract with `lastSyncAt: string | null`
    - Extended provider catalog service to populate `lastSyncAt` from `connection.last_sync_at`
    - Updated `IncomeProviderConnectCard` UI to display "Last synced: ..." when `lastSyncAt` is present
    - Fixed `sync.service.ts` JSON field type assertions (`Prisma.InputJsonValue` cast) for typecheck compliance
    - Updated `IncomeSourceSetupStep` copy to reflect IN-03 pilot live state (GoDaddy POS live)
  - Validation:
    - `node --test src/features/integrations/server/sync.service.test.mjs` -> PASS (8/8)
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched integration files -> PASS

- **IN-02 complete: provider-agnostic OAuth core infrastructure shipped** (February 27, 2026):
  - Added schema-backed OAuth core persistence:
    - `IncomeProvider` enum
    - `IncomeConnectionStatus` enum
    - `BusinessIncomeConnection` model
    - `IncomeOAuthState` model
    - migration: `prisma/migrations/20260228010000_income_oauth_core_infrastructure/migration.sql`
  - Added OAuth core repositories/services:
    - `src/features/integrations/server/connections.repository.ts`
    - `src/features/integrations/server/oauth-state.repository.ts`
    - `src/features/integrations/server/oauth-crypto.ts`
    - `src/features/integrations/server/oauth.service.ts`
  - Added provider-agnostic OAuth adapter registry:
    - `src/features/integrations/providers/registry.ts`
    - uses env-driven OAuth endpoint/client config per provider (`INCOME_OAUTH_<PROVIDER>_*`)
  - Added API routes for OAuth start/callback orchestration:
    - `app/api/integrations/oauth/[provider]/start/route.ts`
    - `app/api/integrations/oauth/[provider]/callback/route.ts`
    - owner/manager role enforcement is active for connect/callback handling
  - Updated provider cards to expose live OAuth start links when provider env config is present:
    - `connectEnabled/connectHref` are now dynamic in provider-card view models
    - cards remain disabled with setup guidance when env config is missing
  - Validation:
    - `npx prisma generate` -> PASS
    - `npx prisma validate` -> PASS
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs src/features/integrations/server/oauth.service.test.mjs` -> PASS (6/6)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched OAuth/integration files -> PASS

- **IN-01 complete: provider catalog + onboarding UI shell shipped (no OAuth)** (February 27, 2026):
  - Implemented provider-catalog filtering/sorting service and shared connection contracts:
    - `src/features/integrations/server/provider-catalog.ts`
    - `src/features/integrations/server/index.ts`
    - `src/features/integrations/shared/income-connections.contracts.ts`
    - expanded `src/features/integrations/shared/provider-catalog.contracts.ts`
  - Added onboarding + integrations UI shell:
    - `src/features/integrations/ui/IncomeOnboardingWizardClient.tsx`
    - `src/features/integrations/ui/IncomeSourceSetupStep.tsx`
    - `src/features/integrations/ui/IncomeProviderConnectCard.tsx`
    - `src/features/integrations/ui/ConnectionStatusBadge.tsx`
    - `src/features/integrations/ui/IncomeConnectionsPageClient.tsx`
    - `src/features/integrations/ui/index.ts`
  - Added route wrappers:
    - `app/onboarding/page.tsx` -> step entry redirect
    - `app/onboarding/income-sources/page.tsx` -> onboarding income-source setup route
    - `app/(dashboard)/integrations/layout.tsx` -> integrations module gate
    - `app/(dashboard)/integrations/page.tsx` -> integrations connection shell route
  - Upgraded signup industry selection UI:
    - `app/auth/signup/page.tsx` now uses card/radio selection while preserving submitted `industry_type`
    - default post-signup continuation now routes to `/onboarding/income-sources`
  - Navigation exposure:
    - `components/nav/bottom-nav.tsx` now includes an `Integrations` nav item gated by `integrations` module enablement
  - Validation:
    - `npx tsx --test src/features/integrations/server/provider-catalog.test.mjs` -> PASS (2/2)
    - `npx tsc --noEmit --incremental false` -> PASS
    - targeted `eslint` on touched integrations/signup/onboarding/nav files -> PASS

- **IN-00 complete: Phase 0 design/schema contracts and security model decisions finalized** (February 27, 2026):
  - Resolved Phase 0 decision set and removed IN-00 blockers:
    - Open Decision 1 -> **1a selected**: GoDaddy POS first in MVP provider rollout sequence.
    - Open Decision 2 -> **2b selected**: default historical sync window set to 90 days.
    - Open Decision 3 -> selected deployment cron route (`app/api/internal/cron/income-sync/route.ts`) for initial scheduler strategy.
    - Open Decision 4 -> selected `IncomeEvent` canonical model with MVP projection to `FinancialTransaction` for dashboard compatibility.
    - Open Decision 5 -> selected `SkipTheDishes` deferred to post-MVP rollout.
  - Added Phase 0 feature-contract scaffolding (types/constants only, no OAuth/provider runtime behavior):
    - `src/features/integrations/shared/provider-catalog.contracts.ts`
    - `src/features/integrations/shared/income-events.contracts.ts`
    - `src/features/integrations/shared/oauth.contracts.ts`
    - `src/features/integrations/shared/index.ts`
  - DB/Prisma contract preflight completed for schema planning alignment:
    - reviewed `prisma/schema.prisma`
    - reviewed latest migration `prisma/migrations/20260227230000_receipt_parse_profile_memory/migration.sql`
    - no schema migration executed in this IN-00 slice (contracts finalized first; schema implementation remains scoped to later phases).
  - Validation:
    - `npx tsc --noEmit --incremental false` -> PASS
    - `npx eslint src/features/integrations/shared/provider-catalog.contracts.ts src/features/integrations/shared/income-events.contracts.ts src/features/integrations/shared/oauth.contracts.ts src/features/integrations/shared/index.ts --quiet` -> PASS

## Pick Up Here (Next Continuation)

- Next task ID: `IN-07`
- Source section: `Phase 7 - Production hardening + security/compliance checklist completion`
- Scope reminder:
  - secret rotation plan for token encryption keys
  - provider scope audits
  - alerting for expired tokens / repeated sync failures
  - rate-limit/backoff per provider
  - reconnect flow for expired tokens

## Goal

Implement a business-type-aware onboarding and income integrations system that:

1. asks users what type of business they run,
2. shows relevant income providers (POS, delivery, payments, etc.),
3. connects providers using OAuth (no manual credentials),
4. syncs and normalizes revenue data into a canonical model,
5. powers the home dashboard income layers and future reporting.

## Why This Plan Exists (Codebase-Overview Alignment)

This plan is written to follow `docs/codebase-overview.md`:

- feature-first architecture (`src/features/*`)
- thin route/action wrappers in `app/*`
- modular integrations
- documented validation and changelog updates
- incremental rollout with explicit caveats

This plan also fits the current state of the repo:

- `Business.industry_type` already exists
- `INDUSTRY_PRESETS` already drives defaults (`lib/config/presets.ts`)
- `FinancialTransaction` and `ExternalSyncLog` already exist in Prisma
- basic provider stubs exist in `lib/modules/integrations/*`
- onboarding/integrations UI shell and provider-agnostic OAuth core now exist (provider pilot sync still pending)

## Product Requirements (Target UX)

### 1. Business Type Selection (Signup)

At signup, ask:

- Retail Store
- Restaurant
- Salon / Barbershop
- Contractor

Notes:

- This already exists as `industry_type` in signup, but currently as a `<select>`.
- Upgrade to card selection UI while preserving the same submitted field (`industry_type`).
- This choice drives provider recommendations and default onboarding content.

### 2. Income Sources Setup Screen (Post-Signup)

Add a skippable onboarding step:

- "Connect Your Income Sources"
- Provider cards show:
  - provider name
  - provider type (POS / delivery / payment)
  - connect button
  - optional badge (recommended / optional)
  - status (not connected / connected / error)
- Include:
  - clear "optional" messaging
  - "you can add more later" copy
  - "Skip for now"

### 3. OAuth Connection Flow

When the user taps `Connect`:

1. backend generates provider OAuth URL (with state + PKCE where supported)
2. user is redirected to provider auth page
3. provider redirects back to app callback URL with code/state
4. backend exchanges code for tokens
5. tokens are encrypted and stored
6. provider is marked connected
7. initial sync is scheduled

Rule:

- Never collect provider credentials manually in our UI.

## Current-State Inventory (What We Can Reuse)

### Existing business-type plumbing

- `Business.industry_type` enum exists in Prisma (`restaurant`, `salon`, `retail`, `contractor`, `general`)
- signup already captures `industry_type` in `app/auth/signup/page.tsx`
- `ensureBusinessForUser()` already uses industry presets in `lib/core/auth/tenant.ts`
- `INDUSTRY_PRESETS` already includes `relevantSources` and default modules in `lib/config/presets.ts`

### Existing financial data plumbing

- `FinancialTransaction` table already stores income/expense records
- `ExternalSyncLog` table already exists for sync status tracking
- `app/actions/core/financial.ts#ingestFinancialTransactions(...)` already supports idempotent upsert of normalized transactions
- home dashboard now consumes `incomeBreakdown` via `src/features/home/server/*`

### Existing integration scaffolding

- legacy provider stubs in `lib/modules/integrations/{godaddy-pos,uber-eats,doordash}.ts`
- `lib/modules/integrations/types.ts` includes `NormalizedTransaction`
- `src/features/integrations` exists but is essentially empty (good target for canonical implementation)

## Recommended Architecture (Playbook-Compliant)

### Canonical feature placement

Use `src/features/integrations/*` as the primary feature module for:

- provider catalog + business-type recommendations
- connection management
- OAuth orchestration
- sync orchestration
- normalization into canonical income event records
- integration settings UI + onboarding income-source setup UI

### Proposed structure

```text
src/features/integrations/
  shared/
    provider-catalog.contracts.ts        # IncomeProvider interface + enums/types (client-safe)
    income-connections.contracts.ts      # connection DTOs/status types for UI
    oauth.contracts.ts                   # callback/start request/response contracts
    income-events.contracts.ts           # normalized IncomeEvent DTOs
  server/
    index.ts                            # canonical feature barrel
    provider-catalog.ts                 # code registry + business-type filtering
    connections.repository.ts           # Prisma access for BusinessIncomeConnection
    connections.service.ts              # connect/disconnect/list/status workflows
    oauth-state.repository.ts           # OAuth state nonce/PKCE persistence
    oauth.service.ts                    # start/callback/token exchange orchestration
    sync.repository.ts                  # sync run reads/writes + logs/cursors
    sync.service.ts                     # initial/incremental sync orchestration
    normalization.service.ts            # provider payload -> IncomeEvent mapping
    projection.service.ts               # IncomeEvent -> FinancialTransaction projection/upsert
    webhook.service.ts                  # webhook verification + event dispatch
  providers/
    registry.ts                         # provider definitions + capability flags
    toast.provider.ts
    square.provider.ts
    uber-eats.provider.ts
    doordash.provider.ts
    stripe.provider.ts
    godaddy-pos.provider.ts
  ui/
    IncomeOnboardingWizardClient.tsx
    IncomeSourceSetupStep.tsx
    IncomeProviderConnectCard.tsx
    IncomeConnectionsPageClient.tsx
    ConnectionStatusBadge.tsx
    index.ts
```

### Thin wrapper entrypoints (app/)

Follow codebase-overview playbook: wrappers are thin, feature logic stays in `src/features`.

```text
app/
  onboarding/
    page.tsx                            # route wrapper (redirects to current step)
    income-sources/page.tsx             # wrapper to feature UI
  (dashboard)/
    integrations/page.tsx               # wrapper to manage connections later
  actions/core/
    integrations.ts                     # thin server-action wrappers
  api/
    integrations/oauth/[provider]/start/route.ts
    integrations/oauth/[provider]/callback/route.ts
    integrations/webhooks/[provider]/route.ts
    internal/cron/income-sync/route.ts  # scheduled sync trigger (if using app route cron)
```

### External integration client placement

Recommended split:

- `src/features/integrations/providers/*` for provider definitions + feature-facing adapters
- `src/server/integrations/revenue/*` only if shared external HTTP clients emerge across multiple features

For MVP, feature-local provider adapters are sufficient and simpler.

## Data Model Plan (Prisma)

### Guiding principle

Do not break the current home dashboard or existing `FinancialTransaction` consumers.

Recommended approach:

1. Add a canonical `IncomeEvent` table for normalized provider revenue data.
2. Project `IncomeEvent` records into existing `FinancialTransaction` rows (type=`income`) for compatibility.
3. Continue using `FinancialTransaction` for expenses and current finance/home views until a broader finance refactor is warranted.

This gives us richer provider-specific data without forcing a risky dashboard rewrite immediately.

### 1. Provider catalog (`IncomeProvider`)

Recommended as a code registry (not a DB table) for MVP:

- providers are mostly static
- easier to version and test in code
- no admin CRUD needed initially

Client-safe interface (matches your requested shape plus rollout metadata):

```ts
interface IncomeProvider {
  id: "toast" | "square" | "godaddy_pos" | "uber_eats" | "doordash" | "stripe" | "skip_the_dishes";
  name: string;
  type: "pos" | "delivery" | "ecommerce" | "accounting" | "bank" | "payment";
  supportsOAuth: boolean;
  supportedIndustries: ("restaurant" | "retail" | "salon" | "contractor" | "general")[];
  optional: boolean;
  canSyncHistorical: boolean;
  canWebhook: boolean;
  status: "planned" | "pilot" | "active";
}
```

If admin-managed catalogs become necessary later, add a DB table then.

### 2. `BusinessIncomeConnection` (new Prisma model)

Store one connection per business+provider(+external account/location when applicable).

Recommended fields:

- `id`
- `business_id`
- `provider_id` (enum/string)
- `provider_type` (optional denormalized type)
- `display_name` (e.g., "Toast - Main Location")
- `external_account_id` (merchant/account/store identifier from provider)
- `external_location_id` (nullable)
- `status` (`pending` | `connected` | `expired` | `error` | `disconnected`)
- `access_token_encrypted`
- `refresh_token_encrypted` (nullable)
- `token_expires_at`
- `scopes` (JSON/string array)
- `sync_cursor` (JSON, provider-specific incremental checkpoint)
- `last_sync_at`
- `last_full_sync_at`
- `last_webhook_at`
- `last_error_code`
- `last_error_message`
- `metadata` (JSON for provider-specific config)
- `created_at`
- `updated_at`

Indexes/uniques:

- unique `(business_id, provider_id, external_account_id, external_location_id)` with a nullable-safe strategy
- index `(business_id, status)`
- index `(provider_id, status)`

### 3. `IncomeOAuthState` (new Prisma model)

Used for secure OAuth start/callback flow.

Fields:

- `id`
- `business_id`
- `user_id`
- `provider_id`
- `state_hash` (never store raw state)
- `pkce_verifier_encrypted` (if PKCE used)
- `redirect_uri`
- `expires_at`
- `used_at`
- `created_at`
- `metadata`

Purpose:

- CSRF/replay protection
- provider callback correlation
- auditability for connection attempts

### 4. `IncomeEvent` (new Prisma model; canonical normalized income record)

This maps to your requested normalized schema and supports richer reporting.

Recommended fields (includes your core fields plus operational fields):

- `id`
- `business_id`
- `connection_id` (`BusinessIncomeConnection`)
- `provider_id`
- `source_name` (display source, e.g., "Uber Eats")
- `external_id`
- `external_parent_id` (nullable, e.g., payout/order batch)
- `event_type` (sale, payout, refund, adjustment, fee, tip, tax, transfer) — optional but useful
- `gross_amount`
- `fees`
- `net_amount`
- `currency`
- `occurred_at` (provider event timestamp)
- `payout_status` (`pending` | `paid` | `failed` | `unknown`)
- `raw_payload` (JSON, minimally retained)
- `normalized_payload` (JSON, optional)
- `ingested_at`
- `updated_at_provider` (nullable)
- `created_at`

Indexes/uniques:

- unique `(business_id, provider_id, external_id)` or `(connection_id, external_id)` (recommended)
- index `(business_id, occurred_at desc)`
- index `(provider_id, occurred_at desc)`
- index `(payout_status)`

### 5. Existing tables to extend/reuse

#### `FinancialTransaction` (existing)

Keep as the dashboard-compatible ledger view for now.

Recommended additions (optional but helpful):

- `income_event_id` nullable FK to `IncomeEvent` (for traceability)
- `connection_id` nullable FK to `BusinessIncomeConnection`

If we avoid schema churn in MVP, we can store traceability in `metadata` first and add FKs later.

#### `ExternalSyncLog` (existing)

Reuse and extend rather than creating another sync-log table immediately.

Recommended additions:

- `connection_id` nullable FK
- `trigger` (`initial` | `scheduled` | `manual` | `webhook`)
- `records_created`
- `records_updated`
- `cursor_before` / `cursor_after` (JSON)

### 6. Enum updates required

Current `FinancialSource` only includes:

- `godaddy_pos`
- `uber_eats`
- `doordash`
- `shopping`
- `manual`

If we project new providers to `FinancialTransaction`, Prisma enum expansion is required (e.g. `toast`, `square`, `stripe`, `skip_the_dishes`).

Operational note (from codebase overview):

- after Prisma schema changes and `prisma generate`, restart the dev server

## OAuth Flow Pattern (Detailed)

### Start route (`/api/integrations/oauth/[provider]/start`)

1. Authn/Authz:
   - require signed-in user + business membership
   - require owner/manager role (recommended)
2. Validate provider exists and is enabled for rollout
3. Generate:
   - `state` (random)
   - PKCE verifier/challenge (if provider supports/requires)
4. Persist `IncomeOAuthState`:
   - store hashed state
   - encrypted PKCE verifier
   - TTL (e.g. 10 min)
5. Build provider-specific auth URL with:
   - client_id
   - redirect_uri
   - scopes
   - state
   - code_challenge (PKCE)
6. Redirect user to provider auth page

### Callback route (`/api/integrations/oauth/[provider]/callback`)

1. Validate `state` and provider
2. Load and consume `IncomeOAuthState` (single use)
3. Exchange auth `code` for tokens
4. Encrypt/store tokens in `BusinessIncomeConnection`
5. Fetch provider account/location metadata (merchant/store id, display name)
6. Mark connection `connected`
7. Enqueue initial sync (or schedule immediate background sync)
8. Redirect back to onboarding/integrations screen with success state

### Security requirements

- Never store raw tokens unencrypted
- Never log access/refresh tokens
- State nonce must be hashed at rest and single-use
- Verify webhook signatures per provider
- Use least-privilege scopes
- Support token refresh and expiry tracking

## Sync Model (Initial + Incremental)

### Core rule

Do not fetch provider data live on every page load.

Use persisted sync + normalized storage.

### Initial sync

On first successful connection:

- fetch historical window (configurable by provider, default 30 days)
- allow extension to 90 days for POS providers where supported
- normalize records into `IncomeEvent`
- project income events into `FinancialTransaction`
- write `ExternalSyncLog` record
- store cursor/checkpoint in `BusinessIncomeConnection.sync_cursor`

### Incremental sync

Run on a schedule or webhook trigger:

- read eligible connected connections
- per connection:
  - refresh token if needed
  - fetch changes since cursor / timestamp
  - normalize + upsert
  - project to `FinancialTransaction`
  - update cursor, `last_sync_at`, and sync log

### Webhooks (when provider supports)

Webhook route receives provider events:

- verify signature
- identify `BusinessIncomeConnection`
- record lightweight webhook receipt log (optional future table)
- trigger targeted incremental sync (preferred) or direct normalization if safe

Recommendation:

- use webhooks as a trigger, not the only data source
- periodic reconciliation sync still runs to recover missed webhook events

### Scheduling (pragmatic rollout)

Because there is no generalized job infrastructure yet in this repo:

Phase 1 scheduler recommendation:

- `app/api/internal/cron/income-sync/route.ts` protected by internal secret
- invoke via deployment platform cron (e.g., Vercel Cron or equivalent)

Future upgrade:

- move to a durable job queue/worker system when sync volume grows

## Normalization Strategy (Provider -> Canonical -> Dashboard)

### Canonical normalization target

Normalize all provider payloads into `IncomeEvent` rows.

This supports:

- provider-specific raw payload retention
- consistent reporting
- future reconciliation/auditing
- richer income analytics than current `FinancialTransaction`

### Compatibility projection (important for current UI)

Project normalized income into existing `FinancialTransaction` rows so current consumers continue working:

- home dashboard (`src/features/home/server/*`)
- any current financial summaries using `FinancialTransaction`

Projection rules (initial):

- only project events that represent actual money-in entries (not every webhook/event type)
- map provider to `FinancialSource` enum value (expand enum where needed)
- use deterministic `external_id` scheme to keep upserts idempotent
- preserve references in metadata (or FK fields if added)

### Source display names for home layer

The home income layer currently orders known sources by industry.

Plan:

- extend source ordering logic in `src/features/home/ui/home-financial-layer.shared.tsx` and home server contracts after new providers are added
- keep unknown providers safely displayable (already supported by fallback label formatting)

## Business-Type Provider Mapping (Initial Recommendations)

Use a code registry + filter by `Business.industry_type`.

### Restaurant

- Toast POS (optional / recommended)
- Square for Restaurants (optional / recommended)
- GoDaddy POS (optional / recommended, already represented in schema)
- Uber Eats (optional / recommended)
- DoorDash (optional / recommended)
- SkipTheDishes (optional / optional; rollout region-dependent)
- Stripe (optional / optional)

### Retail Store

- Square
- Stripe
- GoDaddy POS
- Shopify (future)

### Salon / Barbershop

- Square
- Stripe
- GoDaddy POS

### Contractor

- Stripe
- Square
- QuickBooks/Xero (future accounting sync)

## UI Flow Plan (Detailed)

### A. Signup business type selection (upgrade existing screen)

Current:

- `app/auth/signup/page.tsx` uses `<select name="industry_type">`

Planned:

- replace with card/radio button group while keeping the submitted field unchanged
- preserve accessibility and no-JS form submission
- no backend contract change required (`signUpAction` already validates industry type)

### B. Post-signup onboarding route

Add `app/onboarding/*` flow:

- `app/onboarding/page.tsx` -> step router
- `app/onboarding/income-sources/page.tsx` -> connection setup step

On first login/signup:

- if onboarding incomplete, redirect to onboarding instead of dashboard
- allow skip
- persist progress state (see below)

### C. Connection management page (later entry)

Add `app/(dashboard)/integrations/page.tsx`:

- list connected/not-connected providers
- reconnect / disconnect
- run manual sync
- view last sync status/time
- add more providers later (important UX requirement)

### D. Onboarding state persistence (new)

Recommended minimal model/fields:

- `Business.onboarding_completed_at` (simple gating)
- `Business.onboarding_state` JSON (optional, stores step progress)

If schema-light MVP is preferred:

- use `Business.metadata` JSON if such field exists (it currently does not), so likely add explicit fields instead.

## Phased Implementation Plan (Detailed)

## Phase 0 - Design + schema contracts (MVP boundary)

Status: `[x]`

Deliverables:

- [x] Finalized MVP provider rollout strategy:
  - pilot-first sequence locked to `godaddy_pos`, then restaurant expansion with `uber_eats` and `doordash`
  - post-MVP queue locked to `square`, `stripe`, `toast`, `skip_the_dishes`
- [x] Locked canonical model strategy:
  - `IncomeEvent` as canonical normalized store + projection into `FinancialTransaction` for MVP dashboard compatibility
- [x] Defined Phase 0 shared contracts and constants in `src/features/integrations/shared/*`
- [x] Defined token-security model contract and scheduler baseline:
  - AES-256-GCM token encryption contract (`INCOME_TOKEN_ENCRYPTION_KEY`)
  - OAuth state TTL set to 10 minutes
  - initial scheduler strategy set to internal cron route

Files (planned):

- `prisma/schema.prisma` (reviewed for alignment; no IN-00 schema mutation)
- `src/features/integrations/shared/*.ts`
- `docs/codebase-changelog.md`

Validation:

- `npx tsc --noEmit --incremental false`
- targeted `eslint` on touched integrations shared contract files

## Phase 1 - Provider catalog + onboarding UI (no OAuth yet)

Status: `[x]`

Goal:

- ship business-type-aware provider setup UI with mocked connect status

Deliverables:

- [x] provider registry with industry filters
- [x] upgraded signup business-type cards
- [x] onboarding income-source setup screen
- [x] skip for now flow
- [x] connection status UI shell

Notes:

- no real OAuth yet; `Connect` is intentionally disabled with "coming soon" labels for this phase
- onboarding and dashboard integrations shells are in place to validate provider mapping before OAuth rollout

## Phase 2 - OAuth core infrastructure (provider-agnostic)

Status: `[x]`

Goal:

- build secure reusable OAuth start/callback framework once

Deliverables:

- [x] `BusinessIncomeConnection` + `IncomeOAuthState` models
- [x] token encryption utilities
- [x] provider auth URL builders
- [x] callback exchange orchestration
- [x] generic connection status updates
- [x] reconnect/error handling

Important:

- keep provider-specific logic behind adapters (`providers/*.provider.ts`)

## Phase 3 - First provider pilot end-to-end (recommended: GoDaddy POS)

Status: `[x]`

Goal:

- prove the full path: Connect -> tokens stored -> sync -> dashboard data visible

Deliverables:

- [x] one provider OAuth adapter (`godaddy-pos.provider.ts` - fetch + normalization)
- [x] one provider sync fetch adapter (`sync.service.ts` - `runGoDaddyPosManualSync`)
- [x] normalization to `IncomeEvent` (upsert with idempotent `connection_id + external_id` key)
- [x] projection to `FinancialTransaction` (upsert with `business_id + source + external_id` key)
- [x] manual sync action (`app/api/integrations/sync/godaddy-pos/manual/route.ts`)
- [x] `ExternalSyncLog` writes (running -> success/failed with records_fetched)
- [x] pilot end-to-end test coverage (`sync.service.test.mjs`, 8 tests)
- [x] `lastSyncAt` surfaced in connection card contract + UI

Why pilot first:

- validates architecture before multi-provider expansion
- de-risks token handling and sync semantics

## Phase 4 - Restaurant rollout providers (Uber Eats + DoorDash + POS)

Status: `[x]`

Goal:

- support the restaurant onboarding example you described

Deliverables:

- [x] provider adapters for target restaurant providers:
  - `uber-eats.provider.ts` (fetch + multi-field normalization with gross/fees/net resolution)
  - `doordash.provider.ts` (fetch + multi-field normalization with delivery_id/order_id/subtotal/commission)
- [x] provider-specific payload mapping/fees handling (field priority chains for each provider's API shape)
- [x] sync service generalized to `runProviderManualSync` (shared across godaddy_pos, uber_eats, doordash)
- [x] `runUberEatsManualSync` and `runDoorDashManualSync` public entry points
- [x] manual sync API routes:
  - `app/api/integrations/sync/uber-eats/manual/route.ts`
  - `app/api/integrations/sync/doordash/manual/route.ts`
- [x] provider catalog updated: `SYNC_ENABLED_PROVIDERS` set + `buildSyncHref` for all three providers
- [x] dashboard source ordering: `uber_eats` and `doordash` already in `FinancialSource` enum and dashboard home income breakdown
- [ ] webhook endpoints (deferred to Phase 5 - scheduled sync + webhook hardening)

Resulting UX:

- Restaurant users see Toast/Square/GoDaddy POS/Uber Eats/DoorDash/Stripe
- connect any subset
- statuses persist and sync drives income layer

## Phase 5 - Scheduled sync + webhook hardening

Status: `[x]`

Goal:

- make sync reliable without page-load fetching

Deliverables:

- [x] cron-triggered incremental sync route (`app/api/integrations/sync/cron/route.ts`, secured by `INCOME_CRON_SECRET`)
- [x] sync lock/duplication prevention per connection (DB soft lock via `ExternalSyncLog.status="running"` with 10-min staleness window)
- [x] cron runner with full error isolation per provider+business (`runAllProvidersCronSync`)
- [x] webhook signature verification utilities (`webhook-crypto.ts` HMAC-SHA256 with `timingSafeEqual`)
- [x] webhook endpoints for Uber Eats + DoorDash (signature-verified, `last_webhook_at` update)
- [ ] retry/backoff per connection (deferred to Phase 7 production hardening)
- [ ] periodic reconciliation sync (deferred to Phase 7)

## Phase 6 - Reporting + home/dashboard integration improvements

Status: `[x]`

Goal:

- leverage normalized income data beyond basic totals

Deliverables:

- [x] provider connection health badges in integrations page (`syncStale` badge, `lastErrorMessage` surface)
- [x] stale-sync warning on connection cards (connected but no sync or >24h ago)
- [x] error message display on error-status cards
- [ ] reporting endpoints by provider/channel/date range (deferred to Phase 7/post-MVP analytics)

## Phase 7 - Production hardening and ops readiness

Status: `[ ]`

Deliverables:

- secret rotation plan for token encryption keys
- provider scope audits
- alerting for expired tokens / repeated sync failures
- rate-limit/backoff per provider
- runbooks for reconnect flows and webhook outages

## Security & Compliance Checklist

Status: `[~]`

- [x] Access/refresh tokens encrypted at rest
- [x] No token values in logs/errors
- [x] OAuth state is single-use and expires quickly
- [x] PKCE used where supported
- [x] Webhook signatures verified (Uber Eats + DoorDash HMAC-SHA256 with timingSafeEqual)
- [ ] Least-privilege scopes documented per provider
- [ ] Reconnect flow for expired tokens
- [x] Owner/manager auth enforced for connect/disconnect actions

## Validation Plan (By Slice)

For each implementation slice, record commands actually run in `docs/codebase-changelog.md`.

Recommended checks:

- `npx tsc --noEmit --incremental false`
- targeted `eslint` on touched files
- Prisma validation/generate (when schema changes)
- provider adapter unit tests with mocked HTTP responses
- OAuth callback tests (state validation, token exchange failure cases)
- Playwright onboarding happy path (optional later)

## Open Decisions (Resolved In IN-00)

1. MVP provider order:
   - **Resolved**: `1a` -> start with `GoDaddy POS` for the first end-to-end pilot.
2. Historical sync default:
   - **Resolved**: `2b` -> default to a 90-day historical sync window.
3. Scheduler platform:
   - **Resolved**: use deployment cron route first (`app/api/internal/cron/income-sync/route.ts`), then evaluate queue migration in Phase 5/7 hardening.
4. Canonical source of truth timeline:
   - **Resolved**: keep `FinancialTransaction` as MVP dashboard source via projection from canonical `IncomeEvent`; direct dashboard migration can be evaluated post-MVP.
5. Regional providers:
   - **Resolved**: defer `SkipTheDishes` to post-MVP rollout.

## Example Restaurant Onboarding (Target End State)

1. User signs up and selects `Restaurant`
2. Onboarding shows:
   - Toast
   - Square for Restaurants
   - GoDaddy POS
   - Uber Eats
   - DoorDash
   - Stripe
3. User connects:
   - Toast
   - Uber Eats
   - DoorDash
4. App stores encrypted tokens and marks connections:
   - Toast POS - Connected
   - Uber Eats - Connected
   - DoorDash - Connected
   - Stripe - Not Connected
5. Initial sync runs and writes normalized `IncomeEvent` rows
6. Projected `FinancialTransaction` income rows update home dashboard
7. Home income layer shows source breakdown by provider/channel

## Implementation Notes for Future Agent/Engineer

- Follow the `New Feature Implementation Playbook` in `docs/codebase-overview.md`
- Keep `app/*` wrappers thin; put logic in `src/features/integrations/*`
- Prefer shared contracts in `src/features/integrations/shared/*` for client/server-safe types
- Update `docs/codebase-changelog.md` after each meaningful slice
- If schema changes are made: run `prisma generate` and restart dev server (documented operational note)
