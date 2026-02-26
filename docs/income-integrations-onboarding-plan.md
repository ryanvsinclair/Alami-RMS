# Income Integrations Onboarding Plan

Last updated: February 26, 2026 (draft / implementation-ready plan)

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
- no onboarding wizard / OAuth connection system exists yet

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

Status: `[ ]`

Deliverables:

- finalize provider rollout list for MVP (recommend 2-3 providers first)
- decide canonical model strategy:
  - `IncomeEvent + FinancialTransaction projection` (recommended)
- define enums and Prisma models
- define token encryption approach

Files (planned):

- `prisma/schema.prisma`
- `src/features/integrations/shared/*.ts`
- `docs/codebase-changelog.md`

Validation:

- `npx tsc --noEmit --incremental false`
- `npm run lint` (document baseline failures if unchanged)

## Phase 1 - Provider catalog + onboarding UI (no OAuth yet)

Status: `[ ]`

Goal:

- ship business-type-aware provider setup UI with mocked connect status

Deliverables:

- provider registry with industry filters
- upgraded signup business-type cards
- onboarding income-source setup screen
- skip for now flow
- connection status UI shell

Notes:

- no real OAuth yet; `Connect` can show "coming soon" per provider
- useful for validating onboarding UX and provider mapping first

## Phase 2 - OAuth core infrastructure (provider-agnostic)

Status: `[ ]`

Goal:

- build secure reusable OAuth start/callback framework once

Deliverables:

- `BusinessIncomeConnection` + `IncomeOAuthState` models
- token encryption utilities
- provider auth URL builders
- callback exchange orchestration
- generic connection status updates
- reconnect/error handling

Important:

- keep provider-specific logic behind adapters (`providers/*.provider.ts`)

## Phase 3 - First provider pilot end-to-end (recommended: GoDaddy POS or Stripe)

Status: `[ ]`

Goal:

- prove the full path: Connect -> tokens stored -> sync -> dashboard data visible

Deliverables:

- one provider OAuth adapter
- one provider sync fetch adapter
- normalization to `IncomeEvent`
- projection to `FinancialTransaction`
- manual sync action
- `ExternalSyncLog` writes

Why pilot first:

- validates architecture before multi-provider expansion
- de-risks token handling and sync semantics

## Phase 4 - Restaurant rollout providers (Uber Eats + DoorDash + POS)

Status: `[ ]`

Goal:

- support the restaurant onboarding example you described

Deliverables:

- provider adapters for target restaurant providers
- provider-specific mapping/fees handling
- webhook endpoints where supported
- dashboard source ordering updates for new sources

Resulting UX:

- Restaurant users see Toast/Square/GoDaddy POS/Uber Eats/DoorDash/Stripe
- connect any subset
- statuses persist and sync drives income layer

## Phase 5 - Scheduled sync + webhook hardening

Status: `[ ]`

Goal:

- make sync reliable without page-load fetching

Deliverables:

- cron-triggered incremental sync route
- retry/backoff strategy
- sync lock/duplication prevention per connection
- webhook signature verification
- periodic reconciliation sync
- observability/logging improvements

## Phase 6 - Reporting + home/dashboard integration improvements

Status: `[ ]`

Goal:

- leverage normalized income data beyond basic totals

Deliverables:

- richer home income-source cards (counts, statuses, stale-sync warning)
- provider connection health badges in integrations page
- reporting endpoints by provider/channel/date range

## Phase 7 - Production hardening and ops readiness

Status: `[ ]`

Deliverables:

- secret rotation plan for token encryption keys
- provider scope audits
- alerting for expired tokens / repeated sync failures
- rate-limit/backoff per provider
- runbooks for reconnect flows and webhook outages

## Security & Compliance Checklist

Status: `[ ]`

- [ ] Access/refresh tokens encrypted at rest
- [ ] No token values in logs/errors
- [ ] OAuth state is single-use and expires quickly
- [ ] PKCE used where supported
- [ ] Webhook signatures verified
- [ ] Least-privilege scopes documented per provider
- [ ] Reconnect flow for expired tokens
- [ ] Owner/manager auth enforced for connect/disconnect actions

## Validation Plan (By Slice)

For each implementation slice, record commands actually run in `docs/codebase-changelog.md`.

Recommended checks:

- `npx tsc --noEmit --incremental false`
- targeted `eslint` on touched files
- Prisma validation/generate (when schema changes)
- provider adapter unit tests with mocked HTTP responses
- OAuth callback tests (state validation, token exchange failure cases)
- Playwright onboarding happy path (optional later)

## Open Decisions (Need Product/Engineering Confirmation)

1. MVP provider order:
   - Start with `GoDaddy POS` (already in enum and home UI) for fastest integration path?
   - Or `Stripe`/`Square` for cleaner OAuth developer tooling?
2. Historical sync default:
   - 30 days vs 90 days
3. Scheduler platform:
   - deployment cron route (simple) vs dedicated worker queue (durable)
4. Canonical source of truth timeline:
   - keep `FinancialTransaction` as dashboard source for MVP (recommended)
   - migrate dashboard/reports directly to `IncomeEvent` later
5. Regional providers:
   - include `SkipTheDishes` in MVP or later phase

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
