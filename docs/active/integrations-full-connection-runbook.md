# Integrations Full Connection Runbook

Status: Active (execution guide)
Created: 2026-03-02
Last Updated: 2026-03-02
Primary Purpose: Practical, provider-by-provider checklist to move all listed integrations from cataloged/planned to fully connectable and syncing in production.

Related code:
- `src/features/integrations/*`
- `src/features/schedule/*`
- `app/api/integrations/*`
- `lib/core/auth/tenant.ts`

---

## 0. Current Baseline (Read First)

- Fully wired in code (OAuth + sync pipeline + manual sync routes): GoDaddy POS, Uber Eats, DoorDash.
- OAuth scaffold only (no sync adapters/routes yet): Square, Stripe, Toast, SkipTheDishes.
- Catalog/UI and normalization scaffolding only (no end-to-end connection flow yet): Google Calendar, Outlook, Apple ICS, Square Appointments, Calendly, Mindbody, Fresha, Vagaro, OpenTable, Resy.
- In this workspace, none of the required OAuth/sync env vars are configured yet.

---

## 1. Global Prerequisites (Do Once)

### 1.1 Product and legal readiness

- [ ] Production HTTPS domain is live.
- [ ] Privacy Policy URL is published.
- [ ] Terms of Service URL is published.
- [ ] Support contact email and support URL are published.
- [ ] Data retention/deletion policy for third-party data is documented.

### 1.2 App and infrastructure

- [ ] Set `APP_BASE_URL` (if used in deployment) to production app URL.
- [ ] Set `INCOME_TOKEN_ENCRYPTION_KEY` (32-byte key, base64 or hex format supported by your implementation).
- [ ] Set `INCOME_CRON_SECRET`.
- [ ] Schedule cron caller for `GET /api/integrations/sync/cron` with `Authorization: Bearer <INCOME_CRON_SECRET>`.
- [ ] Ensure outbound network access from app server to provider APIs.
- [ ] Ensure webhook ingress path is reachable from internet for providers that push events.

### 1.3 Security controls

- [ ] Secrets are stored in your deployment secret manager, not committed to git.
- [ ] Rotate provider secrets at least every 90 days.
- [ ] Enable request logging for OAuth callback and webhook routes (without logging access tokens/secrets).

---

## 2. Redirect and Webhook URLs To Register

Use your production domain in all provider dashboards.

Income OAuth callback format:
- `https://<your-domain>/api/integrations/oauth/<provider_id>/callback`

Required callback URLs:
- `godaddy_pos`: `https://<your-domain>/api/integrations/oauth/godaddy_pos/callback`
- `uber_eats`: `https://<your-domain>/api/integrations/oauth/uber_eats/callback`
- `doordash`: `https://<your-domain>/api/integrations/oauth/doordash/callback`
- `square`: `https://<your-domain>/api/integrations/oauth/square/callback`
- `stripe`: `https://<your-domain>/api/integrations/oauth/stripe/callback`
- `toast`: `https://<your-domain>/api/integrations/oauth/toast/callback`
- `skip_the_dishes`: `https://<your-domain>/api/integrations/oauth/skip_the_dishes/callback`

Webhook URLs currently implemented:
- Uber Eats: `https://<your-domain>/api/integrations/webhooks/uber-eats`
- DoorDash: `https://<your-domain>/api/integrations/webhooks/doordash`

---

## 3. Environment Variable Master Checklist

### 3.1 Global required

- [ ] `INCOME_TOKEN_ENCRYPTION_KEY=...`
- [ ] `INCOME_CRON_SECRET=...`

### 3.2 Income OAuth credentials (all income providers)

For each provider, set:
- [ ] `INCOME_OAUTH_<PROVIDER>_CLIENT_ID`
- [ ] `INCOME_OAUTH_<PROVIDER>_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_<PROVIDER>_AUTH_URL`
- [ ] `INCOME_OAUTH_<PROVIDER>_TOKEN_URL`
- [ ] `INCOME_OAUTH_<PROVIDER>_SCOPES` (space or comma separated)

Concrete keys to set:
- [ ] `INCOME_OAUTH_GODADDY_POS_CLIENT_ID`
- [ ] `INCOME_OAUTH_GODADDY_POS_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_GODADDY_POS_AUTH_URL`
- [ ] `INCOME_OAUTH_GODADDY_POS_TOKEN_URL`
- [ ] `INCOME_OAUTH_GODADDY_POS_SCOPES`
- [ ] `INCOME_OAUTH_UBER_EATS_CLIENT_ID`
- [ ] `INCOME_OAUTH_UBER_EATS_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_UBER_EATS_AUTH_URL`
- [ ] `INCOME_OAUTH_UBER_EATS_TOKEN_URL`
- [ ] `INCOME_OAUTH_UBER_EATS_SCOPES`
- [ ] `INCOME_OAUTH_DOORDASH_CLIENT_ID`
- [ ] `INCOME_OAUTH_DOORDASH_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_DOORDASH_AUTH_URL`
- [ ] `INCOME_OAUTH_DOORDASH_TOKEN_URL`
- [ ] `INCOME_OAUTH_DOORDASH_SCOPES`
- [ ] `INCOME_OAUTH_SQUARE_CLIENT_ID`
- [ ] `INCOME_OAUTH_SQUARE_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_SQUARE_AUTH_URL`
- [ ] `INCOME_OAUTH_SQUARE_TOKEN_URL`
- [ ] `INCOME_OAUTH_SQUARE_SCOPES`
- [ ] `INCOME_OAUTH_STRIPE_CLIENT_ID`
- [ ] `INCOME_OAUTH_STRIPE_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_STRIPE_AUTH_URL`
- [ ] `INCOME_OAUTH_STRIPE_TOKEN_URL`
- [ ] `INCOME_OAUTH_STRIPE_SCOPES`
- [ ] `INCOME_OAUTH_TOAST_CLIENT_ID`
- [ ] `INCOME_OAUTH_TOAST_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_TOAST_AUTH_URL`
- [ ] `INCOME_OAUTH_TOAST_TOKEN_URL`
- [ ] `INCOME_OAUTH_TOAST_SCOPES`
- [ ] `INCOME_OAUTH_SKIP_THE_DISHES_CLIENT_ID`
- [ ] `INCOME_OAUTH_SKIP_THE_DISHES_CLIENT_SECRET`
- [ ] `INCOME_OAUTH_SKIP_THE_DISHES_AUTH_URL`
- [ ] `INCOME_OAUTH_SKIP_THE_DISHES_TOKEN_URL`
- [ ] `INCOME_OAUTH_SKIP_THE_DISHES_SCOPES`

### 3.3 Income fetch endpoints and webhook secrets

- [ ] `INCOME_GODADDY_POS_EVENTS_URL`
- [ ] `INCOME_UBER_EATS_EVENTS_URL`
- [ ] `INCOME_DOORDASH_EVENTS_URL`
- [ ] `INCOME_WEBHOOK_SECRET_UBER_EATS`
- [ ] `INCOME_WEBHOOK_SECRET_DOORDASH`

### 3.4 Scheduling connector fetch endpoints

- [ ] `SCHEDULE_SYNC_SQUARE_APPOINTMENTS_EVENTS_URL`
- [ ] `SCHEDULE_SYNC_CALENDLY_EVENTS_URL`
- [ ] `SCHEDULE_SYNC_MINDBODY_EVENTS_URL`
- [ ] `SCHEDULE_SYNC_FRESHA_EVENTS_URL`
- [ ] `SCHEDULE_SYNC_VAGARO_EVENTS_URL`
- [ ] `SCHEDULE_SYNC_OPENTABLE_EVENTS_URL`
- [ ] `SCHEDULE_SYNC_RESY_EVENTS_URL`

---

## 4. Provider Portals and What To Collect

Use this section while creating each provider app.

### 4.1 Income providers

#### GoDaddy POS (Poynt)
- Portals/docs:
  - https://developer.godaddy.com/
  - https://docs.poynt.com/api-reference/index.html
- Collect:
  - Client ID
  - Client Secret
  - Authorization URL
  - Token URL
  - Required read scopes
  - Events/reporting endpoint URL

#### Uber Eats
- Portals/docs:
  - https://developer.uber.com/docs/eats/guides/authentication
  - https://developer.uber.com/docs/eats/guides/order-integration
- Collect:
  - Client ID
  - Client Secret
  - Authorization URL (`https://auth.uber.com/oauth/v2/authorize`)
  - Token URL (`https://auth.uber.com/oauth/v2/token`)
  - Approved scopes
  - Reporting/events API URL
  - Webhook signing secret

#### DoorDash
- Portals/docs:
  - https://developer.doordash.com/docs/marketplace/overview/getting_started/integration_requirements_new/
  - https://developer.doordash.com/es-US/docs/marketplace/overview/onboarding/ssio/
- Collect:
  - Partner app credentials
  - Authorization URL
  - Token URL
  - Approved scopes
  - Events/reporting API URL
  - Webhook signing secret

#### Square
- Portals/docs:
  - https://developer.squareup.com/docs/oauth-api/overview
  - https://developer.squareup.com/reference/square/oauth-api
- Collect:
  - Application ID (client ID)
  - Application Secret
  - OAuth authorize/token endpoints
  - Required read scopes

#### Stripe
- Portals/docs:
  - https://docs.stripe.com/connect/oauth-reference
- Collect:
  - Connect client ID
  - Secret key/client secret material
  - Authorize endpoint (`https://connect.stripe.com/oauth/authorize`)
  - Token endpoint (`https://connect.stripe.com/oauth/token`)
  - Scope (`read_only` or `read_write`)

#### Toast
- Portals/docs:
  - https://pos.toasttab.com/partners/integration-partner-application
  - https://doc.toasttab.com/doc/devguide/apiDeveloperPortalCustomIntegrations.html
- Collect:
  - Partner-approved developer portal account
  - OAuth credentials and scopes
  - API base URLs for required data

#### SkipTheDishes
- Notes:
  - No clear public self-serve developer portal was confirmed.
  - Treat this as partner-managed onboarding.
- Collect:
  - Official partner onboarding contact
  - Credential model (OAuth/API key)
  - Data endpoint contract

### 4.2 Calendar/booking/reservations

#### Google Calendar
- Docs:
  - https://developers.google.com/identity/protocols/oauth2/web-server
  - https://developers.google.com/workspace/calendar/api/guides/push
- Collect:
  - OAuth client ID/secret
  - Authorized redirect URI(s)
  - Calendar scopes
  - Watch/webhook setup details

#### Outlook (Microsoft 365)
- Docs:
  - https://learn.microsoft.com/en-us/graph/auth-v2-user
  - https://learn.microsoft.com/en-us/graph/auth-register-app-v2
- Collect:
  - App registration client ID/secret
  - Tenant/issuer decision (`common` vs tenant-specific)
  - OAuth authorize/token endpoints
  - Graph calendar permissions

#### Calendly
- Docs:
  - https://developer.calendly.com/getting-started/
  - https://developer.calendly.com/create-a-developer-account
- Collect:
  - OAuth client ID
  - OAuth client secret
  - Webhook signing key
  - API base + event endpoints used for sync

#### Mindbody
- Docs:
  - https://developers.mindbodyonline.com/ConsumerDocumentation
- Collect:
  - Developer account + OAuth client enablement
  - OAuth client credentials
  - API endpoints for booking/schedule data

#### Vagaro
- Docs:
  - https://docs.vagaro.com/
  - https://support.vagaro.com/hc/en-us/articles/29521637950875-Set-Up-Webhooks-From-Vagaro
- Collect:
  - API and webhook feature enablement
  - Endpoint URLs
  - Verification/signing details

#### OpenTable
- Docs:
  - https://www.opentable.com/restaurant-solutions/api-partners/become-a-partner/
- Collect:
  - Partner approval
  - API credentials
  - Data contract and webhook model

#### Resy and Fresha
- Notes:
  - Public self-serve docs were not confirmed in this audit.
  - Treat as partner-led integrations.
- Collect:
  - Official partner onboarding path
  - Credential model
  - Endpoint contracts

---

## 5. Execution Plan By Readiness

## Phase A: Go live on currently wired providers

Goal: make GoDaddy POS, Uber Eats, DoorDash connectable and syncing in production.

- [ ] Configure all GoDaddy env vars in Section 3.
- [ ] Configure all Uber Eats env vars in Section 3.
- [ ] Configure all DoorDash env vars in Section 3.
- [ ] Register OAuth callback URLs in provider dashboards.
- [ ] Register webhook URLs for Uber Eats and DoorDash.
- [ ] Run connect flow from `/integrations` for each provider.
- [ ] Trigger manual sync once for each provider.
- [ ] Confirm data appears in `income_events` and `financial_transactions`.
- [ ] Confirm `businesses.integrations_onboarding_completed = true` after first successful connection.

## Phase B: Complete income providers that are OAuth scaffold only

Applies to: Square, Stripe, Toast, SkipTheDishes.

For each provider:
- [ ] Confirm official API access and approved scopes.
- [ ] Add provider fetch/normalize adapter in `src/features/integrations/providers/`.
- [ ] Add provider sync runner in `src/features/integrations/server/sync.service.ts`.
- [ ] Add provider to cron configs in `sync.service.ts`.
- [ ] Add manual sync route under `app/api/integrations/sync/<provider>/manual/route.ts`.
- [ ] Add provider to `SYNC_ENABLED_PROVIDERS` and `SYNC_ROUTE_BY_PROVIDER` in `src/features/integrations/server/provider-catalog.ts`.
- [ ] Add webhook route if provider supports webhooks and you will consume them.
- [ ] Add tests for adapter normalization and sync path.
- [ ] Deploy and validate with real or sandbox account.

## Phase C: Complete schedule/booking/reservations providers

Applies to: Google Calendar, Outlook, Apple ICS, Square Appointments, Calendly, Mindbody, Fresha, Vagaro, OpenTable, Resy.

For each provider:
- [ ] Define auth model (OAuth/API key/feed URL).
- [ ] Implement connection storage model (new table or extend existing strategy).
- [ ] Build connect/disconnect routes and callback handling.
- [ ] Store encrypted credentials/tokens.
- [ ] Implement fetch adapter and normalization mapping.
- [ ] Configure `SCHEDULE_SYNC_<PROVIDER>_EVENTS_URL` or provider-specific direct adapter calls.
- [ ] Add sync scheduler path and conflict resolution integration.
- [ ] Add webhook receiver where supported.
- [ ] Add UI connect state in onboarding and `/integrations`.
- [ ] Add tests and run production dry-run.

---

## 6. Validation Checklist (Run Per Provider)

- [ ] OAuth connect starts from `/integrations` and returns to app without error.
- [ ] Row exists in `business_income_connections` (income providers) with `status='connected'`.
- [ ] Manual sync route returns success and fetched count.
- [ ] `income_events` rows created or updated.
- [ ] `financial_transactions` rows created.
- [ ] `external_sync_logs` has `status='success'`.
- [ ] If webhooks enabled, webhook timestamp updates on receipt.

Suggested SQL checks:

```sql
-- Connection state
select provider_id, status, last_sync_at, last_webhook_at
from business_income_connections
where business_id = '<BUSINESS_ID>'
order by provider_id;

-- Event ingestion
select provider_id, count(*) as events
from income_events
where business_id = '<BUSINESS_ID>'
group by provider_id
order by provider_id;

-- Onboarding completion flag
select integrations_onboarding_completed
from businesses
where id = '<BUSINESS_ID>';
```

---

## 7. Definition of Done

You are complete when all are true:

- [ ] Every provider listed in `INCOME_PROVIDER_CATALOG` is connectable in app and has working sync ingestion.
- [ ] Every provider listed in `CALENDAR_PROVIDER_CATALOG` has implemented connect path and data sync path.
- [ ] All required env vars in Section 3 are set in production.
- [ ] Onboarding re-prompt behavior is correct: users with zero connections are re-prompted; users with at least one connection are not.
- [ ] Monitoring and alerting exist for OAuth failures, sync failures, and webhook signature failures.

