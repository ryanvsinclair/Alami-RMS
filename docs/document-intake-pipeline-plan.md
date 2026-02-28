# Document Intake Pipeline Plan

Last updated: February 28, 2026
Status: PARKED POST-LAUNCH - DI-00 through DI-06 pending
Constitution source: `docs/execution-constitution.md`

---

## Latest Update

- **2026-02-28 - Mandatory execution restatement gate added (resume-ready).**
  - Added explicit "Mandatory Restatement Before Phase Work" section for DI resume.
  - Requires constitution restatement before starting any `DI-*` task when unparked.

- **2026-02-28 - Parking decision applied from master plan v2.**
  - This initiative is intentionally parked until restaurant launch-critical work is complete.
  - Resume trigger: launch gate completion in docs/master-plan-v2.md (LG-00 complete).
  - Resume point remains **DI-00** with all checklist items preserved.

- **2026-02-28 — Postmark infrastructure configured.** Pre-code setup complete:
  - Postmark inbound stream active; inbound email address confirmed (`f0564e12b8a47d723184b66f2d35e84e@inbound.postmarkapp.com`)
  - Inbound webhook URL set in Postmark pointing to `https://alami-rms.vercel.app/api/documents/inbound` with HTTP Basic Auth embedded
  - `POSTMARK_SERVER_INBOUND_HASH`, `POSTMARK_INBOUND_WEBHOOK_USER`, `POSTMARK_INBOUND_WEBHOOK_PASS`, `SUPABASE_STORAGE_BUCKET_DOCUMENTS` all added to `.env`
  - Ready to execute DI-00 (schema + contracts)

- **2026-02-28 — Plan revised (v2).** All six pre-execution corrections applied:
  - Email capture transport locked to **Postmark Inbound** with real API integration spec
  - `document_intake` added to `FinancialSource` enum in DI-00 migration (not deferred)
  - `raw_content_hash` added to `document_drafts` with unique index `[business_id, raw_content_hash]` for strict SHA-256 idempotency
  - `trust_threshold_override` added to `vendor_profiles` (nullable int, overrides `VENDOR_TRUST_THRESHOLD` per vendor)
  - Inbox badge count included in DI-04 nav load (action + nav component)
  - Supabase `documents` bucket confirmed created (private)

- **2026-02-28 — Plan created (v1).** DI-00 (design/contracts) is the first executable phase.

---

## Pick Up Here

This plan is currently parked.

When unparked, start at **DI-00**: schema design and contract vocabulary.

---

## Mandatory Restatement Before Phase Work (On Resume)

Before starting any checklist item in this plan after unpark:

- [ ] Paste `Constitution Restatement` template from `docs/execution-constitution.md` into session/job summary.
- [ ] Confirm scope sentence references exact `DI-*` task ID.
- [ ] If task touches UI, include UI/UX confirmations from constitution restatement.

---

## Commit Checkpoint (Required On Resume)

After each completed checklist step in this plan:

- [ ] Create one scoped git commit to this repository before moving to the next step.
- [ ] Include the `DI-*` task ID in the commit message.
- [ ] Record commit hash + title in job summary/changelog evidence.

---

## Purpose

Define and implement an automated document intake pipeline that ingests digital business documents (invoices, supplier receipts, purchase orders, delivery confirmations), converts them into structured financial draft records, and safely posts them into the system with full tenant isolation and user review controls.

This plan introduces a new intake channel alongside existing intake paths (barcode, photo, manual, receipt OCR). It does not replace or modify any existing flow.

---

## Core Principles (Non-Negotiable)

These are architectural laws, not preferences. Every phase must be consistent with them.

1. **Capture is always safe.** Ingesting a document never creates a financial record. Period.
2. **Tenant isolation is enforced at every layer.** The inbound address, the stored document, the draft record, the vendor mapping, and the posted expense are all `business_id`-scoped.
3. **Raw source is always preserved.** The original document (email body, PDF, image, JSON payload) is stored before any parsing begins. Parsing is downstream of storage.
4. **Never auto-post initially.** Every document enters a review inbox. Automation is earned incrementally through measured trust.
5. **Automation is earned, not default.** Auto-post is gated behind a vendor trust threshold that the system builds over time from user-confirmed postings.
6. **Email is a capture transport, not a domain concern.** Postmark Inbound bridges email → HTTP POST. Once the payload arrives at our route handler, the pipeline treats it as structured data regardless of origin channel.

---

## Scope Boundaries

**In scope:**

- New `document_drafts`, `vendor_profiles`, `document_vendor_item_mappings`, `inbound_addresses` tables
- Postmark Inbound integration — MailboxHash-based tenant routing, signed webhook delivery
- Secure route handler for Postmark inbound webhook POST
- Document parsing into structured financial draft fields
- Vendor mapping + trust state management (per-vendor trust threshold override)
- Draft review inbox UI with nav badge count
- User-triggered post (creates `FinancialTransaction` with `source: "document_intake"` + optional `InventoryTransaction`)
- Controlled auto-post gate (trust threshold + anomaly checks)
- Vendor spend / price trend analytics layer

**Out of scope for this plan:**

- Modifying any existing receiving, shopping, barcode, or income integration flows
- Schema changes to any existing tables (additive-only, except `FinancialSource` enum value addition)
- Replacing the existing `receipts` / `receipt_line_items` pipeline
- PDF text extraction library selection (handled as a one-line integration add once the parser exists)
- Multi-attachment email support (each Postmark inbound POST = one document)

---

## Infrastructure: Postmark Inbound

### How Postmark Inbound Works

Postmark provides an **inbound email server** that accepts emails and POSTs each one as a structured JSON payload to a webhook URL you configure. Key facts:

- **Inbound address format:** Each Postmark server has a unique inbound hash address — `{serverInboundHash}@inbound.postmarkapp.com`. Example: `482d8814b3864b2c8ba7f7679fc116bf@inbound.postmarkapp.com`.
- **MailboxHash (plus addressing):** Emails sent to `{serverInboundHash}+{token}@inbound.postmarkapp.com` include the `token` value in the `MailboxHash` field of the JSON payload. This is how we route to specific tenants without provisioning a new email address per business.
- **Custom domain option:** You can configure a custom subdomain (e.g., `docs.yourdomain.com`) with an MX record pointing to `inbound.postmarkapp.com` (priority 10), enabling addresses like `{token}@docs.yourdomain.com`. Postmark still delivers the MailboxHash via plus addressing on that domain.
- **Webhook delivery:** Postmark POSTs `application/json` to your `InboundHookUrl`. Configured in the Postmark server settings or via Postmark API (`InboundHookUrl` field).
- **Authentication:** Postmark does **not** provide HMAC signatures on inbound webhooks. Security is via **HTTP Basic Auth** embedded in the webhook URL: `https://username:password@yourdomain.com/api/documents/inbound`. The username/password is configured in Postmark server settings and stored in env as `POSTMARK_INBOUND_WEBHOOK_USER` / `POSTMARK_INBOUND_WEBHOOK_PASS`.
- **Payload delivery:** Postmark retries delivery on non-2xx responses. Respond `200` immediately; do all async work after the response is sent.

### Tenant Routing Strategy

We use **MailboxHash** to carry the `address_token` per business:

```
Business sends invoices to:
  {serverInboundHash}+{address_token}@inbound.postmarkapp.com

Postmark delivers JSON to our webhook with:
  payload.MailboxHash = address_token

Our route handler:
  1. Verifies HTTP Basic Auth (POSTMARK_INBOUND_WEBHOOK_USER / PASS)
  2. Reads payload.MailboxHash → findBusinessByAddressToken(mailboxHash)
  3. Continues with identified tenant
```

The `inbound_addresses.address_token` is the MailboxHash value. Each business gets exactly one `address_token`. This is the only tenant disambiguation signal we use from the Postmark payload.

### Postmark Inbound JSON Payload Structure

```typescript
// Full shape of what Postmark POSTs to our InboundHookUrl
interface PostmarkInboundPayload {
  FromName: string;
  From: string;                      // "Vendor Name <vendor@example.com>"
  FromFull: {
    Email: string;
    Name: string;
    MailboxHash: string;             // Plus-address hash (our address_token)
  };
  To: string;                        // Full To address string
  ToFull: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;             // Our address_token (same as FromFull.MailboxHash here)
  }>;
  Cc: string;
  CcFull: Array<{ Email: string; Name: string; MailboxHash: string }>;
  Bcc: string;
  BccFull: Array<{ Email: string; Name: string; MailboxHash: string }>;
  OriginalRecipient: string;         // e.g. "abc123+token@inbound.postmarkapp.com"
  ReplyTo: string;
  Subject: string;
  MessageID: string;                 // Postmark's unique ID for deduplication
  Date: string;                      // RFC 2822 date string
  MailboxHash: string;               // Top-level — same as ToFull[0].MailboxHash
  TextBody: string;                  // Plain-text email body (primary parse target)
  HtmlBody: string;                  // HTML body (fallback / secondary)
  StrippedTextReply: string;         // Reply text only, thread stripped
  Tag: string;
  Headers: Array<{ Name: string; Value: string }>;
  Attachments: Array<{
    Name: string;                    // Filename e.g. "invoice.pdf"
    Content: string;                 // BASE64-encoded file content
    ContentType: string;             // e.g. "application/pdf", "image/png"
    ContentLength: number;           // Bytes
    ContentID: string;               // For inline images
  }>;
  MessageStream: string;             // "inbound"
}
```

### What We Extract and Store

From each Postmark payload, we construct and store:

| Source field | What we use it for |
|---|---|
| `MailboxHash` | Tenant identification (→ `address_token` lookup) |
| `MessageID` | Raw content hash seed for deduplication |
| `From` / `FromFull.Email` / `FromFull.Name` | Vendor name seed for parsing |
| `Subject` | Secondary vendor/document-type signal |
| `TextBody` | Primary parse target for unstructured invoice text |
| `HtmlBody` | Fallback if `TextBody` is empty |
| `Attachments[]` | PDFs/images stored individually as additional raw documents |
| `Date` | Seed for `parsed_date` |
| Full JSON payload | Stored as `raw_storage_path` (serialised to storage) |

### Environment Variables Required (DI-01)

```
POSTMARK_INBOUND_WEBHOOK_USER=<basic_auth_username>
POSTMARK_INBOUND_WEBHOOK_PASS=<basic_auth_password>
POSTMARK_SERVER_INBOUND_HASH=<the_server_hash>@inbound.postmarkapp.com
# Or custom domain variant:
POSTMARK_INBOUND_DOMAIN=docs.yourdomain.com
SUPABASE_STORAGE_BUCKET_DOCUMENTS=documents   ✅ bucket confirmed created (private)
```

---

## Architecture Placement

Following the canonical layer rules from `docs/codebase-overview.md`:

| Layer | Location |
|---|---|
| DB schema + migrations | `prisma/schema.prisma` + `prisma/migrations/` |
| Domain contracts / vocabulary | `src/features/documents/shared/` |
| Server repositories | `src/features/documents/server/` |
| Server services | `src/features/documents/server/` |
| Postmark payload adapter | `src/features/documents/server/postmark-inbound.adapter.ts` |
| Vendor mapping service | `src/features/documents/server/vendor-mapping.service.ts` |
| Draft review service | `src/features/documents/server/draft-review.service.ts` |
| Post service | `src/features/documents/server/document-post.service.ts` |
| Trust/automation service | `src/features/documents/server/trust.service.ts` |
| Analytics service | `src/features/documents/server/document-analytics.service.ts` |
| Inbound webhook route | `app/api/documents/inbound/route.ts` |
| Action wrappers | `app/actions/modules/documents.ts` |
| UI components | `src/features/documents/ui/` |
| Route pages | `app/(dashboard)/documents/` |
| Domain parsers | `src/domain/parsers/document-draft.ts` |

The `documents` feature module is a new peer of `src/features/receiving`, `src/features/integrations`, etc.

---

## New Module: `documents`

This plan introduces the `documents` business module. It must be enabled per-business via `business_modules` (module_id: `"documents"`) before any document intake features are accessible.

All server actions must guard with:
```
await requireModule(businessId, "documents")
```

---

## Data Model Overview

### New Tables

**`document_drafts`**
The central staging record for every ingested document. Holds parse output, status, confidence, deduplication hash, and links to the originating raw storage path.

Key columns:
- `id`, `business_id`, `vendor_profile_id?`
- `inbound_channel` (enum: `email`, `webhook`, `manual_upload`)
- `raw_storage_path` — private Supabase Storage path of the original document (`documents/{businessId}/{draftId}/raw.json` for Postmark payloads)
- `raw_content_type` — MIME type of stored document
- `raw_content_hash` — SHA-256 hex hash of the raw content for strict idempotency; unique index on `[business_id, raw_content_hash]`
- `postmark_message_id?` — Postmark's `MessageID` for email-channel deduplication (secondary key)
- `status` (enum: `received`, `parsing`, `draft`, `pending_review`, `posted`, `rejected`)
- `parsed_vendor_name?`, `parsed_date?`, `parsed_total?`, `parsed_tax?`
- `parsed_line_items` (jsonb) — structured line items array
- `confidence_score` (numeric 4,3) — overall parse confidence 0.000–1.000
- `confidence_band` (MatchConfidence enum — reuse existing)
- `parse_flags` (jsonb) — diagnostic flags from parser
- `anomaly_flags` (jsonb) — populated during trust evaluation
- `financial_transaction_id?` — set after posting
- `posted_at?`, `posted_by_user_id?`
- `auto_posted` (bool, default false)
- `created_at`, `updated_at`

**`vendor_profiles`**
Tenant-scoped vendor trust and mapping record. One per unique vendor per business.

Key columns:
- `id`, `business_id`
- `vendor_name` — canonical name for all future matching
- `vendor_aliases` (jsonb) — array of known name variants
- `supplier_id?` — FK to `suppliers`
- `default_category_id?` — FK to `categories`
- `trust_state` (enum: `unverified`, `learning`, `trusted`, `blocked`)
- `total_posted` (int, default 0) — count of confirmed postings
- `trust_threshold_override` (int, nullable) — if set, overrides global `VENDOR_TRUST_THRESHOLD` for this vendor; allows per-vendor trust calibration
- `auto_post_enabled` (bool, default false)
- `trust_threshold_met_at?`
- `last_document_at?`
- `created_at`, `updated_at`

Effective threshold for a vendor: `vendor.trust_threshold_override ?? VENDOR_TRUST_THRESHOLD`

**`document_vendor_item_mappings`**
Maps vendor line item names to internal `inventory_items`.

Key columns:
- `id`, `business_id`, `vendor_profile_id`
- `raw_line_item_name`
- `inventory_item_id` — FK to `inventory_items`
- `confirmed_count` (int, default 0)
- `created_at`, `updated_at`

**`inbound_addresses`**
One per business. The `address_token` IS the Postmark MailboxHash value.

Key columns:
- `id`, `business_id`
- `address_token` — the plus-address hash sent to suppliers (e.g. business sends docs to `{serverHash}+{token}@inbound.postmarkapp.com`)
- `is_active` (bool, default true)
- `created_at`

### New Enums

```
DocumentInboundChannel: email, webhook, manual_upload
DocumentDraftStatus: received, parsing, draft, pending_review, posted, rejected
VendorTrustState: unverified, learning, trusted, blocked
```

### Enum Addition (Existing)

`FinancialSource` — add value `document_intake` in DI-00 migration:
```sql
ALTER TYPE "FinancialSource" ADD VALUE 'document_intake';
```

This is done in DI-00, not deferred. Posted document drafts use `source: "document_intake"` from day one, making them distinguishable from hand-entered `"manual"` expenses in the dashboard.

### Reused Existing Enums/Models

- `MatchConfidence` — reused as `confidence_band` on `document_drafts`
- `FinancialTransaction` — posted documents create a record here (`source: "document_intake"`)
- `InventoryTransaction` — optional, if line items map to inventory items
- `Business`, `Supplier`, `Category`, `InventoryItem` — referenced by FKs in new tables

---

## Phases

---

### DI-00 — Schema Design and Contract Vocabulary

**Goal:** Define all new database models, enums, and TypeScript contracts. No services, no UI, no API routes yet. Only the vocabulary layer.

**Status:** `[ ]` pending

#### Checklist

Schema additions to `prisma/schema.prisma`:

- [ ] Add `DocumentInboundChannel` enum (`email`, `webhook`, `manual_upload`)
- [ ] Add `DocumentDraftStatus` enum (`received`, `parsing`, `draft`, `pending_review`, `posted`, `rejected`)
- [ ] Add `VendorTrustState` enum (`unverified`, `learning`, `trusted`, `blocked`)
- [ ] Add `InboundAddress` model:
  - `id String @id @default(cuid())`
  - `business_id String` (FK → `businesses`, CASCADE)
  - `address_token String @unique`
  - `is_active Boolean @default(true)`
  - `created_at DateTime @default(now())`
  - Index: `@@unique([business_id])` (one address per business)
- [ ] Add `VendorProfile` model:
  - All fields as specified in Data Model Overview
  - `trust_threshold_override Int?` — nullable, overrides global threshold
  - Indexes: `@@index([business_id])`, `@@unique([business_id, vendor_name])`
- [ ] Add `DocumentDraft` model:
  - All fields as specified in Data Model Overview
  - `raw_content_hash String` — SHA-256 hex of raw stored content
  - `postmark_message_id String?` — from Postmark `MessageID` field
  - Indexes: `@@index([business_id])`, `@@index([status])`, `@@index([vendor_profile_id])`, `@@index([business_id, created_at(sort: Desc)])`
  - Unique: `@@unique([business_id, raw_content_hash])` — strict deduplication
- [ ] Add `DocumentVendorItemMapping` model:
  - `@@unique([business_id, vendor_profile_id, raw_line_item_name])`
- [ ] Add reverse relations on `Business`, `Supplier`, `Category`, `InventoryItem` as needed

Migration:
- [ ] Run `npx prisma migrate dev --name document_intake_core_schema`
- [ ] Confirm migration SQL includes:
  - `ALTER TYPE "FinancialSource" ADD VALUE 'document_intake';`
  - `CREATE UNIQUE INDEX "document_drafts_business_id_raw_content_hash_key" ON "document_drafts"("business_id", "raw_content_hash");`
- [ ] Run `npx prisma generate`

TypeScript contracts at `src/features/documents/shared/documents.contracts.ts`:
- [ ] `DOCUMENT_INBOUND_CHANNELS` tuple + `DocumentInboundChannel` type
- [ ] `DOCUMENT_DRAFT_STATUSES` tuple + `DocumentDraftStatus` type
- [ ] `DOCUMENT_TERMINAL_STATUSES` set (`posted`, `rejected`)
- [ ] `VENDOR_TRUST_STATES` tuple + `VendorTrustState` type
- [ ] `VENDOR_TRUST_THRESHOLD` constant (default: `5`) — global fallback
- [ ] `DOCUMENT_AUTO_POST_CONFIDENCE_MIN` constant (default: `0.85`)
- [ ] `DocumentDraftSummary` DTO — lightweight projection for inbox UI (id, status, confidence_band, parsed_vendor_name, parsed_total, parsed_date, auto_posted, created_at, vendor_profile name if linked)
- [ ] `ParsedDocumentFields` type — `{ vendor_name: string | null, date: string | null, total: number | null, tax: number | null, line_items: ParsedLineItem[] }`
- [ ] `ParsedLineItem` type — `{ description: string, quantity: number | null, unit_cost: number | null, line_total: number | null }`
- [ ] `VendorProfileSummary` DTO — projection for vendor card UI
- [ ] `DocumentAnomalyFlag` union type — `'large_total' | 'new_format' | 'vendor_name_mismatch' | 'unusual_line_count' | 'duplicate_suspected'`
- [ ] `PostmarkInboundPayload` type — full typed shape of Postmark inbound JSON (as documented in Infrastructure section above)
- [ ] `POSTMARK_INBOUND_CHANNEL = 'email' as const`

Create `src/features/documents/shared/index.ts` — re-exports all contracts.

Validation:
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint src/features/documents/shared/` → PASS
- [ ] `npx prisma validate` → PASS
- [ ] `npx prisma migrate status` → all applied, 0 pending

---

### DI-01 — Capture and Isolation (Safe Ingest Pipeline)

**Goal:** Generate a unique inbound address per business (Postmark MailboxHash token). Accept Postmark inbound webhook POSTs. Immediately verify HTTP Basic Auth, identify the tenant via MailboxHash, compute the content hash, deduplicate if seen before, store the raw Postmark payload privately in Supabase Storage, and create a `document_draft` record in `received` status. No parsing. No financial records.

**Status:** `[ ]` pending

**Prerequisite:** DI-00 complete.

#### Core invariants

- The route must return `200` to Postmark within the request. Postmark retries on non-2xx — a slow or failing response causes duplicate delivery.
- Deduplication is strict: compute SHA-256 of the Postmark JSON body; if `(business_id, raw_content_hash)` already exists in `document_drafts`, return `200` with existing `draftId` immediately without re-storing.
- No `FinancialTransaction` is ever created in this phase under any condition.
- All async work (parse enqueue) happens after `200` is returned via `setTimeout(fn, 0)`.

#### Postmark Inbound Adapter

Create `src/features/documents/server/postmark-inbound.adapter.ts`:

This is the single file responsible for mapping a raw Postmark JSON payload to our internal `IngestableDocument` shape. It has no DB dependencies — pure data transformation.

```typescript
// Canonical adapter interface
interface IngestableDocument {
  inboundChannel: DocumentInboundChannel;   // always 'email' for Postmark
  rawContent: Buffer;                        // Postmark payload serialised to Buffer
  rawContentType: string;                    // 'application/json'
  rawContentHash: string;                    // SHA-256 hex of rawContent
  postmarkMessageId: string;                 // payload.MessageID
  mailboxHash: string;                       // payload.MailboxHash — the address_token
  senderEmail: string;                       // payload.FromFull.Email
  senderName: string;                        // payload.FromFull.Name
  subject: string;                           // payload.Subject
  textBody: string;                          // payload.TextBody
  htmlBody: string;                          // payload.HtmlBody
  emailDate: string;                         // payload.Date
  attachments: IngestableAttachment[];       // from payload.Attachments[]
}

interface IngestableAttachment {
  name: string;                              // payload.Attachments[n].Name
  content: Buffer;                           // base64-decoded payload.Attachments[n].Content
  contentType: string;                       // payload.Attachments[n].ContentType
  contentLength: number;
}

// Functions exported:
// parsePostmarkPayload(rawBody: Buffer): IngestableDocument
//   - Parses JSON, validates required fields, decodes attachment base64
//   - Throws PostmarkPayloadError with reason if payload is malformed
// computeContentHash(content: Buffer): string
//   - crypto.createHash('sha256').update(content).digest('hex')
```

#### Checklist

Inbound address management:
- [ ] Create `src/features/documents/server/inbound-address.repository.ts`:
  - `findOrCreateInboundAddress(businessId)` → `{ addressToken: string, isActive: boolean }`:
    - Upsert on `[business_id]`
    - On create: generate `address_token` via `crypto.randomBytes(16).toString('hex')`
    - Returns existing token if already exists (idempotent)
  - `findBusinessByAddressToken(token)` → `{ businessId: string } | null`:
    - Checks `is_active = true`; returns null if inactive or not found
  - `deactivateInboundAddress(businessId)` — sets `is_active = false`
  - `getAddressDisplayString(addressToken)` → full email address string:
    - Returns `` `${process.env.POSTMARK_SERVER_INBOUND_HASH}+${addressToken}` `` or custom domain variant

Postmark inbound adapter:
- [ ] Create `src/features/documents/server/postmark-inbound.adapter.ts` with full `IngestableDocument` shape and `parsePostmarkPayload` + `computeContentHash` functions as specified above

Raw document storage:
- [ ] Create `src/features/documents/server/document-storage.service.ts`:
  - Bucket: `documents` (confirmed private in Supabase — `SUPABASE_STORAGE_BUCKET_DOCUMENTS=documents`)
  - Storage path convention: `{businessId}/{draftId}/raw.json` for Postmark payloads; `{businessId}/{draftId}/attachment-{n}.{ext}` for attachments
  - `storeRawDocument({ businessId, draftId, content: Buffer, contentType, filename })` → `{ storagePath: string }`
    - Uploads to `documents` bucket using Supabase Storage client
    - Throws `DocumentStorageError` on failure
  - `getRawDocumentSignedUrl(storagePath, expiresInSeconds = 300)` → `string`
    - Returns signed URL valid for `expiresInSeconds` (default 5 min for document preview)
    - Uses Supabase Storage `createSignedUrl`

Draft repository:
- [ ] Create `src/features/documents/server/document-draft.repository.ts`:
  - `createDraft({ businessId, inboundChannel, rawStoragePath, rawContentType, rawContentHash, postmarkMessageId? })` → `DocumentDraft`
    - status: `received`
    - If `[business_id, raw_content_hash]` unique constraint fails: catch and return existing draft (deduplication path)
  - `findDraftById(businessId, draftId)` → always includes `WHERE business_id = ?` guard
  - `findDraftsByStatus(businessId, statuses, { limit, cursor })` — paginated
  - `countDraftsByStatus(businessId, statuses)` → `number` — used for inbox badge
  - `updateDraftStatus(businessId, draftId, status)`
  - `updateDraftParsedFields(businessId, draftId, fields)` — sets parse output + status transition
  - `updateDraftVendorProfile(businessId, draftId, vendorProfileId)`
  - `updateDraftPostedState(businessId, draftId, { financialTransactionId, postedByUserId, autoPosted })`

Inbound webhook route:
- [ ] Create `app/api/documents/inbound/route.ts`:

  ```
  POST /api/documents/inbound

  Security: HTTP Basic Auth
    - username: POSTMARK_INBOUND_WEBHOOK_USER
    - password: POSTMARK_INBOUND_WEBHOOK_PASS
    - Validated by reading Authorization header and comparing with timingSafeEqual
    - Return 401 immediately if auth fails (before reading body)

  Processing order:
    1. Verify Basic Auth → 401 if invalid
    2. Read raw body as Buffer (needed for hash computation)
    3. Parse as PostmarkInboundPayload via parsePostmarkPayload()
       → 400 if payload is malformed
    4. Extract MailboxHash → findBusinessByAddressToken(mailboxHash)
       → 200 (not 401) if token not found — prevents enumeration;
         log the miss and return { received: false, reason: "unknown_address" }
    5. Compute rawContentHash from raw body Buffer
    6. Attempt createDraft() with rawContentHash
       → If unique constraint violation (duplicate): return 200 with { received: true, draftId: existingId, duplicate: true }
    7. Store full Postmark JSON payload to Supabase Storage
       → documents/{businessId}/{draftId}/raw.json
    8. Update draft rawStoragePath
    9. For each attachment in payload.Attachments[]:
       → Decode base64 content
       → Store at documents/{businessId}/{draftId}/attachment-{n}.{ext}
       → Log attachment paths on the draft (via parse_flags or a separate attachment jsonb column — see note)
    10. Return 200 { received: true, draftId } immediately
    11. After response: setTimeout(() => parseAndSaveDraft(businessId, draftId), 0)
  ```

  Note on attachments: Store attachment paths in `parse_flags` jsonb as `{ attachments: [{ name, storagePath, contentType }] }` until a dedicated attachments table is warranted.

  Rate limiting: In-memory counter per `address_token` — reject with 429 if > 20 requests per 60 seconds.

Action wrapper:
- [ ] Create `app/actions/modules/documents.ts`:
  - `getInboundAddress(businessId)` — calls `findOrCreateInboundAddress` + `getAddressDisplayString`; returns full email address string to show in settings UI
  - All actions: `await requireModule(businessId, "documents")` first

Unit tests:
- [ ] Create `src/features/documents/server/postmark-inbound.adapter.test.mjs`:
  - Test: valid Postmark payload → `IngestableDocument` with correct field mapping
  - Test: `MailboxHash` correctly extracted from top-level field
  - Test: attachment base64 decoded to Buffer correctly
  - Test: malformed JSON → throws `PostmarkPayloadError`
  - Test: missing `MailboxHash` → throws `PostmarkPayloadError`
  - Test: `computeContentHash` → deterministic SHA-256 for same input
  - Minimum 6 test cases
- [ ] Create `src/features/documents/server/inbound-address.repository.test.mjs`:
  - Test: `findOrCreateInboundAddress` idempotency — second call returns same token

Validation:
- [ ] `node --test src/features/documents/server/postmark-inbound.adapter.test.mjs` → PASS (6+/6+)
- [ ] `node --test src/features/documents/server/inbound-address.repository.test.mjs` → PASS
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint app/api/documents/ src/features/documents/server/` → PASS
- [ ] Manual: POST a real Postmark inbound payload to `/api/documents/inbound` with correct Basic Auth → `{ received: true, draftId }`, raw JSON stored in Supabase `documents` bucket, no `FinancialTransaction` created
- [ ] Manual: POST same payload twice → second response is `{ received: true, draftId: <same>, duplicate: true }`

---

### DI-02 — Structured Draft Layer (Parse and Score)

**Goal:** Parse each ingested document into structured draft fields. Assign a confidence score. Save all output back onto the `document_draft` record. Move draft status to `pending_review`. Never post.

**Status:** `[ ]` pending

**Prerequisite:** DI-01 complete.

#### Parsing strategy

For Postmark-sourced documents the parse hierarchy is:

1. **`TextBody`** — primary target; structured invoice text extraction
2. **`HtmlBody`** — fallback if `TextBody` is empty or very short (< 20 chars)
3. **`Subject`** — secondary signal for vendor name if body extraction fails
4. **`FromFull.Name` / `FromFull.Email`** — vendor name seed of last resort
5. **Attachments** — initially stored but not parsed (PDF text extraction is deferred)

The parser receives the stored Postmark JSON (loaded from storage), re-parses it as `PostmarkInboundPayload`, and feeds the text content through the domain parser.

#### Checklist

Domain parser:
- [ ] Create `src/domain/parsers/document-draft.ts`:
  - `parseDocumentFromPostmark(payload: PostmarkInboundPayload)` → `ParsedDocumentFields`:
    - Resolve text: `payload.TextBody || stripHtml(payload.HtmlBody) || ''`
    - Vendor name seed: first from text extraction, then `payload.FromFull.Name`, then email domain
    - Date seed: `payload.Date` as fallback if no date found in body
    - Calls `parseDocumentFromText(resolvedText, { vendorNameSeed, dateSeed })`
  - `parseDocumentFromText(rawText: string, hints?: { vendorNameSeed?: string, dateSeed?: string })` → `ParsedDocumentFields`:
    - Vendor name: `hints.vendorNameSeed` if provided + no better candidate found in text; else first header-ish non-numeric line or `From:` / `Vendor:` / `Bill From:` label match
    - Date: ISO date, `Month DD YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`; fallback to `hints.dateSeed`
    - Total: line containing `total`, `amount due`, `balance due`, `grand total`, `invoice total` (case-insensitive) with trailing currency amount
    - Tax: line containing `tax`, `HST`, `GST`, `PST`, `TVQ`, `TPS`, `VAT` with trailing amount
    - Line items: lines matching `{description} ... {qty?} ... {unit_price?} ... {line_total}` pattern; reuse structural patterns from `src/domain/parsers/`
  - `parseDocumentFromJson(payload: unknown)` → `ParsedDocumentFields` — for structured JSON webhook payloads (non-email channel)
  - `scoreDocumentConfidence(fields: ParsedDocumentFields)` → `{ score: number, band: MatchConfidence, flags: string[] }`:
    - `1.0`: all three required fields + total ≈ Σ(line items) + tax within 1%
    - `0.7–0.9`: all three required fields present, line items partial or inconsistent
    - `0.4–0.69`: two of three required fields present
    - `< 0.4`: fewer than two required fields
  - Export `REQUIRED_DOCUMENT_FIELDS = ['vendor_name', 'date', 'total'] as const`
  - Internal `stripHtml(html: string)` — basic tag removal for HtmlBody fallback

Parse service:
- [ ] Create `src/features/documents/server/document-parse.service.ts`:
  - `parseAndSaveDraft(businessId, draftId)`:
    1. Load draft from DB
    2. Load raw JSON from Supabase Storage (`raw_storage_path`)
    3. Deserialise as `PostmarkInboundPayload` (email channel) or raw JSON (webhook channel)
    4. Call appropriate parser: `parseDocumentFromPostmark` for email, `parseDocumentFromJson` for webhook
    5. Score confidence
    6. `updateDraftParsedFields({ ...fields, confidence_score, confidence_band, parse_flags, status: 'pending_review' })`
    7. Attempt vendor auto-resolution via `resolveVendorForDraft` (from DI-03, called here if available)
    8. On any unhandled error: set status `draft`, log structured error in `parse_flags`; never throw

Unit tests:
- [ ] Create `src/domain/parsers/document-draft.test.mjs`:
  - Test: `parseDocumentFromPostmark` with realistic invoice TextBody → vendor, date, total all extracted
  - Test: `parseDocumentFromPostmark` with empty TextBody → falls back to HtmlBody
  - Test: vendor name fallback chain: no body match → uses `FromFull.Name`
  - Test: date fallback: no date in body → uses `payload.Date`
  - Test: total extraction: `Grand Total: $1,234.56` → `total: 1234.56`
  - Test: tax extraction: `HST 13%: $160.49` → `tax: 160.49`
  - Test: confidence scoring — all fields → `high`, missing total → `low`
  - Test: consistency check: total ≠ Σ items + tax → `totals_inconsistent` flag
  - Test: `parseDocumentFromJson` happy path + missing fields
  - Test: `stripHtml` strips tags and decodes common entities
  - Minimum 12 test cases

Validation:
- [ ] `node --test src/domain/parsers/document-draft.test.mjs` → PASS (12+/12+)
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint src/domain/parsers/document-draft.ts src/features/documents/server/document-parse.service.ts` → PASS
- [ ] Manual: send real email to `{serverHash}+{token}@inbound.postmarkapp.com` → after async parse, draft has `status: pending_review`, `parsed_vendor_name` populated, `confidence_score > 0`

---

### DI-03 — Vendor Mapping and Trust Setup

**Goal:** Let the user confirm or correct the parsed vendor name. Map the vendor to an existing supplier (if applicable). Set default category rules. Map vendor line item names to inventory items (if applicable). Persist vendor trust state so the system learns over time. Support per-vendor trust threshold override.

**Status:** `[ ]` pending

**Prerequisite:** DI-02 complete.

#### Vendor resolution strategy

When a `document_draft` enters `pending_review`, the system attempts to auto-link a vendor profile:

1. Exact match on `vendor_profiles.vendor_name` for the business → link immediately
2. Alias match on `vendor_profiles.vendor_aliases` jsonb array → link immediately
3. Fuzzy match (trigram similarity ≥ 0.75) against known vendor names via `pg_trgm` → suggest
4. No match → draft enters inbox unlinked; user creates or maps a vendor on review

For Postmark-sourced documents, the sender email domain (e.g., `sysco.com` from `invoices@sysco.com`) is an additional matching signal added to vendor aliases on first confirmation.

#### Checklist

Vendor profile repository:
- [ ] Create `src/features/documents/server/vendor-profile.repository.ts`:
  - `findVendorByExactName(businessId, vendorName)` → `VendorProfile | null`
  - `findVendorByAlias(businessId, aliasText)` → `VendorProfile | null`
    - Checks `vendor_aliases` jsonb array: `WHERE business_id = ? AND vendor_aliases @> ?::jsonb`
  - `findVendorByFuzzyName(businessId, vendorName)` → `{ profile: VendorProfile, similarity: number } | null`
    - Prisma `$queryRaw`: `SELECT *, similarity(vendor_name, $1) AS sim FROM vendor_profiles WHERE business_id = $2 AND similarity(vendor_name, $1) >= 0.75 ORDER BY sim DESC LIMIT 1`
    - Requires `pg_trgm` extension (already installed per audit)
  - `findAllVendors(businessId)` → `VendorProfileSummary[]`
  - `createVendorProfile(businessId, { vendorName, supplierId?, defaultCategoryId?, trustThresholdOverride? })` → `VendorProfile`
  - `updateVendorProfile(businessId, vendorProfileId, updates)` — partial update including `trust_threshold_override`
  - `addVendorAlias(businessId, vendorProfileId, aliasText)` — idempotent append to `vendor_aliases` array
    - `UPDATE vendor_profiles SET vendor_aliases = vendor_aliases || ?::jsonb WHERE id = ? AND business_id = ? AND NOT (vendor_aliases @> ?::jsonb)`
  - `incrementVendorPostedCount(businessId, vendorProfileId)` — `total_posted += 1`
  - `getEffectiveTrustThreshold(vendor: VendorProfile)` → `number`
    - Returns `vendor.trust_threshold_override ?? VENDOR_TRUST_THRESHOLD`
  - `evaluateAndUpdateTrustState(businessId, vendorProfileId)`:
    - Load vendor, compute effective threshold
    - If `total_posted >= threshold` and `trust_state !== 'trusted'` and `trust_state !== 'blocked'`:
      - Set `trust_state = 'trusted'`, `auto_post_enabled = true`, `trust_threshold_met_at = now()`
    - Else if `total_posted > 0` and `trust_state === 'unverified'`:
      - Set `trust_state = 'learning'`
    - Never demotes below current state automatically

Vendor item mapping repository:
- [ ] Create `src/features/documents/server/vendor-item-mapping.repository.ts`:
  - `findMappingByLineItemName(businessId, vendorProfileId, rawName)` → `DocumentVendorItemMapping | null`
  - `upsertItemMapping(businessId, vendorProfileId, rawName, inventoryItemId)` — create or `confirmed_count += 1`
  - `findAllMappingsForVendor(businessId, vendorProfileId)` → mapping list

Vendor mapping service:
- [ ] Create `src/features/documents/server/vendor-mapping.service.ts`:
  - `resolveVendorForDraft(businessId, { parsedVendorName, senderEmail? })`:
    - Run exact → alias → fuzzy in order
    - If `senderEmail` provided: also try matching sender domain against aliases
    - Returns `{ vendorProfileId: string | null, confidence: number, suggestion: VendorProfileSummary | null }`
  - `confirmVendorMapping(businessId, draftId, vendorProfileId, { senderEmail? })`:
    1. `updateDraftVendorProfile(draftId, vendorProfileId)`
    2. `addVendorAlias(vendorProfileId, parsedVendorName)` if different from canonical
    3. If `senderEmail` provided: `addVendorAlias(vendorProfileId, senderEmailDomain)` (e.g., `sysco.com`)
    4. `evaluateAndUpdateTrustState` (count not incremented — happens at post time)
  - `resolveLineItemMappings(businessId, vendorProfileId, parsedLineItems)` → per-item suggestions

Server action additions to `app/actions/modules/documents.ts`:
- [ ] `getVendorProfiles(businessId)`
- [ ] `createVendorProfile(businessId, payload)` — supports `trustThresholdOverride` in payload
- [ ] `updateVendorTrustThreshold(businessId, vendorProfileId, threshold: number | null)` — owner/manager only
- [ ] `confirmVendorForDraft(businessId, draftId, vendorProfileId)`
- [ ] `updateVendorDefaults(businessId, vendorProfileId, { defaultCategoryId, supplierId })`
- [ ] `confirmLineItemMapping(businessId, vendorProfileId, rawName, inventoryItemId)`

Vendor mapping UI:
- [ ] Create `src/features/documents/ui/VendorMappingPanel.tsx`:
  - Shows parsed vendor name + sender email (for Postmark sourced drafts)
  - Shows matched/suggested vendor profile (confidence badge if fuzzy match)
  - "Confirm" / "Create Vendor" / "Map to Existing" controls
  - After confirmation: default category + supplier dropdowns
  - Trust threshold override field (owner/manager only): numeric input, placeholder = global threshold, clear to reset to global
  - Line item mapping table: raw name → inventory item dropdown

Unit tests:
- [ ] Create `src/features/documents/server/vendor-profile.repository.test.mjs`:
  - Test: exact match by name
  - Test: alias match via jsonb array
  - Test: no match → returns null
  - Test: `evaluateAndUpdateTrustState` — global threshold: 0→learning→trusted at `VENDOR_TRUST_THRESHOLD`
  - Test: `evaluateAndUpdateTrustState` — override threshold: vendor with `trust_threshold_override = 3` becomes trusted at 3, not 5
  - Test: `addVendorAlias` idempotency — adding same alias twice doesn't duplicate
  - Test: `getEffectiveTrustThreshold` — override present → uses override; null → uses global
  - Test: `evaluateAndUpdateTrustState` — blocked vendor stays blocked despite threshold crossed
  - Minimum 8 test cases

Validation:
- [ ] `node --test src/features/documents/server/vendor-profile.repository.test.mjs` → PASS (8+/8+)
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint src/features/documents/server/vendor-mapping.service.ts src/features/documents/server/vendor-profile.repository.ts` → PASS

---

### DI-04 — Review Inbox and User-Triggered Post Flow

**Goal:** Surface a document inbox screen with a nav badge count. User reviews a draft. User clicks "Post". System atomically creates the `FinancialTransaction` (source: `document_intake`), optional `InventoryTransaction` entries for mapped line items, increments vendor trust, and marks the draft as `posted`. User can also reject a draft.

**Status:** `[ ]` pending

**Prerequisite:** DI-03 complete.

#### Post invariants (enforced in `document-post.service.ts`)

1. A draft can only be posted if `status === "pending_review"`
2. Post is atomic — all writes inside a single `prisma.$transaction`
3. Post is idempotent — if `financial_transaction_id` is already set, return it without re-posting
4. `FinancialTransaction.source` must be `"document_intake"` (not `"manual"`)
5. Post must record `posted_by_user_id` and `posted_at`
6. Auto-post is gated in DI-05; this phase only handles user-triggered post

#### Checklist

Post service:
- [ ] Create `src/features/documents/server/document-post.service.ts`:
  - `postDraft(businessId, draftId, userId, options?: { autoPosted?: boolean })`:
    1. Load draft; guard `business_id` + `status === "pending_review"`
    2. Idempotency: if `financial_transaction_id` already set → return `{ financialTransactionId, inventoryTransactionsCreated: 0 }`
    3. Begin `prisma.$transaction`:
       a. Create `FinancialTransaction`:
          ```
          {
            business_id,
            type: "expense",
            source: "document_intake",   ← NOT "manual"
            amount: parsed_total,
            occurred_at: parsed_date,
            description: parsed_vendor_name ?? "Unknown Vendor",
            external_id: draftId,         ← idempotency key
            metadata: { draftId, vendorProfileId, lineItemCount }
          }
          ```
       b. For each line item with confirmed `vendor_item_mapping`:
          - Create `InventoryTransaction` `{ business_id, inventory_item_id, transaction_type: "purchase", quantity, unit_cost, input_method: "receipt" }`
       c. Update `document_draft` → `{ status: "posted", financial_transaction_id, posted_at: now(), posted_by_user_id: userId, auto_posted: options?.autoPosted ?? false }`
       d. `incrementVendorPostedCount(businessId, vendorProfileId)`
       e. `evaluateAndUpdateTrustState(businessId, vendorProfileId)`
    4. Return `{ financialTransactionId, inventoryTransactionsCreated: number }`
  - `rejectDraft(businessId, draftId, userId)`:
    - Guard: status must be `pending_review` or `draft`
    - Update status → `rejected`
    - Does NOT touch vendor trust count

Draft review service:
- [ ] Create `src/features/documents/server/draft-review.service.ts`:
  - `getDraftInbox(businessId, { page, pageSize, statusFilter })` → `{ drafts: DocumentDraftSummary[], total: number }`
    - Default filter: `status IN ('pending_review', 'draft')`
    - Includes vendor name if linked
    - Ordered `created_at DESC`
  - `getDraftInboxBadgeCount(businessId)` → `number`
    - Returns `countDraftsByStatus(businessId, ['pending_review', 'draft'])`
    - This is the number shown on the nav badge
  - `getDraftDetail(businessId, draftId)` → full draft + parsed fields + vendor profile + item mappings
  - `getDraftDocumentUrl(businessId, draftId)` → signed URL for raw document from Supabase Storage

Server action additions:
- [ ] `getDraftInbox(businessId, filters)` in `app/actions/modules/documents.ts`
- [ ] `getDraftInboxBadgeCount(businessId)` — called from nav load path
- [ ] `getDraftDetail(businessId, draftId)`
- [ ] `getDraftDocumentUrl(businessId, draftId)`
- [ ] `postDraft(businessId, draftId)` — user-triggered
- [ ] `rejectDraft(businessId, draftId)`

Route pages:
- [ ] Create `app/(dashboard)/documents/page.tsx` — thin wrapper for `DocumentInboxClient`
- [ ] Create `app/(dashboard)/documents/[draftId]/page.tsx` — thin wrapper for `DocumentDraftDetailClient`
- [ ] Create `app/(dashboard)/documents/layout.tsx` — module guard: redirect to `/` if `documents` module not enabled

Nav badge:
- [ ] Update `components/nav/bottom-nav.tsx`:
  - Add `documents` nav entry (module-gated: only shown when `documents` module enabled)
  - Load `getDraftInboxBadgeCount(businessId)` in the nav data fetch
  - Render numeric badge on the documents icon when count > 0
  - Badge display: show exact count up to 99, then `99+`

UI components:
- [ ] Create `src/features/documents/ui/DocumentInboxClient.tsx`:
  - Draft cards: vendor name (or "Unknown Vendor"), date, total, confidence badge (`MatchConfidence` reuse), status badge
  - Filter tabs: All | Pending Review | Draft | Posted | Rejected
  - Each card links to `/documents/{draftId}`
  - "Auto-posted" indicator on cards where `auto_posted = true`
  - Empty state per filter tab
- [ ] Create `src/features/documents/ui/DocumentDraftDetailClient.tsx`:
  - Raw document section: signed URL iframe for PDF/image, or scrollable text block for JSON/text
  - Parsed fields panel: vendor name, date, total, tax, confidence score with band badge
  - Parse flags section (collapsible): shows structured diagnostic flags
  - Vendor mapping panel: `VendorMappingPanel` component (from DI-03)
  - Line items table: description, quantity, unit cost, line total, mapped inventory item
  - Anomaly warnings (when `anomaly_flags` is set): named flag with human explanation
  - Primary action: **"Post Expense"** — triggers `postDraft`
  - Secondary action: **"Reject"** — triggers `rejectDraft`
  - Posted state: "Posted as document_intake expense on {date}" + link to financial record

Unit tests:
- [ ] Create `src/features/documents/server/document-post.service.test.mjs`:
  - Test: `postDraft` on `pending_review` draft → `FinancialTransaction` created with `source: "document_intake"`, status → `posted`, `auto_posted: false`
  - Test: `postDraft` idempotency — second call returns same `financialTransactionId`, no duplicate created
  - Test: `postDraft` with 2 confirmed line item mappings → 2 `InventoryTransaction` records created
  - Test: `postDraft` on non-`pending_review` draft → throws
  - Test: `rejectDraft` → status `rejected`, vendor `total_posted` unchanged
  - Test: trust count increments after post
  - Test: `getDraftInboxBadgeCount` — returns correct count for `pending_review` + `draft` statuses
  - Test: `getDraftInboxBadgeCount` — excludes `posted` and `rejected` drafts from count
  - Minimum 8 test cases

Validation:
- [ ] `node --test src/features/documents/server/document-post.service.test.mjs` → PASS (8+/8+)
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint app/(dashboard)/documents/ src/features/documents/ components/nav/bottom-nav.tsx` → PASS
- [ ] Manual smoke: send email → review in inbox → Post → `financial_transactions` row has `source = 'document_intake'`, draft `status = 'posted'`
- [ ] Manual smoke: nav badge shows correct pending count; clears after posting all pending

---

### DI-05 — Controlled Automation (Trust-Gated Auto-Post)

**Goal:** Track vendor posting accuracy history. When the effective trust threshold is reached (respecting per-vendor override), enable auto-post for high-confidence documents from that vendor. Apply anomaly checks. Auto-post is per-vendor, not global.

**Status:** `[ ]` pending

**Prerequisite:** DI-04 complete.

#### Automation invariants (enforced in `trust.service.ts`)

1. Auto-post is only enabled per-vendor, never globally
2. Auto-post requires `vendor_profile.auto_post_enabled = true`
3. Auto-post requires `document_draft.confidence_score >= DOCUMENT_AUTO_POST_CONFIDENCE_MIN` (0.85)
4. Auto-post is blocked if any anomaly flag is present
5. A draft that fails the gate enters `pending_review` — never silently dropped
6. Every auto-post records `auto_posted = true` on the draft

#### Anomaly detection rules

- `large_total` — `parsed_total > P95 of last 30 days totals for this vendor`
- `new_format` — `confidence_score < 0.7` for a vendor with `total_posted >= 3` (format change detected)
- `vendor_name_mismatch` — parsed vendor name trigram distance > 0.3 from canonical name
- `unusual_line_count` — line item count deviates > 50% from vendor's historical average
- `duplicate_suspected` — another `posted` draft from same vendor with identical total + date within last 7 days

For `duplicate_suspected`: this now operates on `raw_content_hash` as a primary check (if same hash → already caught at DI-01 deduplication); the heuristic check catches semantic duplicates where the document content differs slightly but the financial data is identical.

#### Checklist

Trust service:
- [ ] Create `src/features/documents/server/trust.service.ts`:
  - `computeAnomalyFlags(businessId, vendorProfileId, parsedFields)` → `DocumentAnomalyFlag[]`
  - `evaluateAutoPostEligibility(vendorProfile, draft)` → `{ eligible: boolean, reason: string | null }`:
    - Uses `getEffectiveTrustThreshold(vendorProfile)` for threshold check
  - `attemptAutoPost(businessId, draftId)`:
    1. Load draft + vendor profile
    2. `computeAnomalyFlags` → persist to `draft.anomaly_flags`
    3. `evaluateAutoPostEligibility`
    4. Eligible → `postDraft(businessId, draftId, SYSTEM_USER_ID, { autoPosted: true })`
    5. Ineligible → `updateDraftStatus(businessId, draftId, 'pending_review')`; return `{ autoPosted: false, reason }`
    6. Structured log: `{ event: 'auto_post_attempt', businessId, draftId, eligible, reason, anomalyFlags }`

Update parse flow:
- [ ] Modify `document-parse.service.ts::parseAndSaveDraft` to call `attemptAutoPost` after parse when `vendor.auto_post_enabled = true`
- [ ] If auto-post not eligible → `pending_review` (inbox)
- [ ] If auto-post succeeds → `posted` (skips inbox)

Server action additions:
- [ ] `disableAutoPost(businessId, vendorProfileId)` — owner/manager only
- [ ] `blockVendor(businessId, vendorProfileId)` — owner/manager only
- [ ] `updateVendorTrustThreshold(businessId, vendorProfileId, threshold)` — already added in DI-03; ensure it re-evaluates trust state after change

Admin UI additions to `DocumentDraftDetailClient`:
- [ ] Vendor trust section: `trust_state` badge, `total_posted` count, effective threshold, `auto_post_enabled` toggle
- [ ] Owner/manager only: disable auto-post toggle, block vendor button
- [ ] Anomaly flags: each flag name with plain-English explanation

Unit tests:
- [ ] Create `src/features/documents/server/trust.service.test.mjs`:
  - Test: eligible vendor + confidence ≥ 0.85 + no anomalies → `eligible: true`
  - Test: `auto_post_enabled = false` → `eligible: false, reason: "auto_post_disabled"`
  - Test: `confidence_score < 0.85` → `eligible: false, reason: "low_confidence"`
  - Test: anomaly flag present → `eligible: false, reason: "anomaly_detected"`
  - Test: `large_total` anomaly fires when total > P95 of last 30 days
  - Test: `duplicate_suspected` fires for same vendor + same total + same date within 7 days
  - Test: `new_format` fires when `confidence < 0.7` and `total_posted >= 3`
  - Test: `attemptAutoPost` on ineligible → draft status → `pending_review`
  - Test: `attemptAutoPost` on eligible → `postDraft` called, `auto_posted = true`
  - Test: vendor with `trust_threshold_override = 2` — becomes eligible after 2 confirmed posts, not 5
  - Minimum 10 test cases

Validation:
- [ ] `node --test src/features/documents/server/trust.service.test.mjs` → PASS (10+/10+)
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint src/features/documents/server/trust.service.ts` → PASS
- [ ] Manual smoke: vendor with `total_posted >= effective_threshold` + high-confidence email → auto-posts, no inbox appearance, `auto_posted = true` on draft
- [ ] Manual smoke: same vendor + email with large total anomaly → appears in inbox with `large_total` flag displayed

---

### DI-06 — Intelligence Layer (Analytics and Insights)

**Goal:** Surface vendor spend tracking, price trend analysis, reorder prediction signals, tax summaries, and cost-of-goods analytics. Read-only. No new schema migrations.

**Status:** `[ ]` pending

**Prerequisite:** DI-04 complete. Do not execute if fewer than 20 posted document drafts exist for the business.

#### Checklist

Analytics service:
- [ ] Create `src/features/documents/server/document-analytics.service.ts`:
  - `getVendorSpendSummary(businessId, { period })` — queries `document_drafts` (status: `posted`) + `vendor_profiles`
  - `getPriceTrends(businessId, vendorProfileId, { inventoryItemId?, rawLineItemName? })` — from `parsed_line_items` jsonb
  - `getReorderSignals(businessId)` — items where `estimatedDaysUntilReorder <= 7`
  - `getTaxSummary(businessId, { period })` — sums `parsed_tax` from posted drafts; note `source: "document_intake"` filter on `financial_transactions`
  - `getCogsSummary(businessId, { period })` — joins `financial_transactions (source: "document_intake", type: "expense")` + vendor default category

Server action additions:
- [ ] `getVendorSpendSummary`, `getPriceTrends`, `getReorderSignals`, `getTaxSummary`, `getCogsSummary` in `app/actions/modules/documents.ts`

UI:
- [ ] Create `src/features/documents/ui/DocumentAnalyticsClient.tsx`:
  - Vendor spend bar chart (top 10 by spend for selected period)
  - Price trend line chart per vendor + item
  - Reorder signal cards (≤7 days)
  - Tax summary total + vendor breakdown
  - COGS breakdown by category
  - Period selector: 30 / 60 / 90 days / Custom
- [ ] Create `app/(dashboard)/documents/analytics/page.tsx` — thin route wrapper

Validation:
- [ ] `npx tsc --noEmit --incremental false` → PASS
- [ ] `npx eslint src/features/documents/` → PASS
- [ ] Manual: post 5+ documents across 2+ vendors → analytics page shows spend breakdown

---

## Security Checklist

- [ ] 1. Postmark inbound route verifies HTTP Basic Auth (`timingSafeEqual`) before reading body
- [ ] 2. Tenant identified by `MailboxHash`; unknown tokens return `200` (not `401`) to prevent enumeration
- [ ] 3. Raw document storage in private Supabase `documents` bucket — no public URLs; all access via signed URLs (max 300s expiry)
- [ ] 4. All server actions include `requireModule(businessId, "documents")` guard
- [ ] 5. All repository functions include `business_id` in every WHERE clause
- [ ] 6. `postDraft` is idempotent — uses `[business_id, raw_content_hash]` unique index + `external_id` on `FinancialTransaction`
- [ ] 7. Auto-post blocked by anomaly detection + confidence gate; ineligible → inbox, never silent drop
- [ ] 8. `disableAutoPost` and `blockVendor` are owner/manager role-gated
- [ ] 9. `address_token` generated with `crypto.randomBytes(16).toString('hex')` — not sequential
- [ ] 10. Postmark Basic Auth credentials stored in env (`POSTMARK_INBOUND_WEBHOOK_USER` / `POSTMARK_INBOUND_WEBHOOK_PASS`), not hardcoded

---

## Deferred (Non-Blocking)

- **Custom inbound domain setup** (MX record pointing `docs.yourdomain.com` → `inbound.postmarkapp.com`): DI-01 works with the default `@inbound.postmarkapp.com` address. Custom domain is a DNS change + Postmark config update — can be done at any time without code changes.
- **PDF text extraction** (pdf-parse, pdfmium, etc.): DI-02 stores PDF attachments but does not parse them. Text extraction is a one-import addition to `document-parse.service.ts` once a library is chosen.
- **Multi-attachment emails**: Each Postmark POST stores the JSON envelope (which includes all attachments). Parsing each attachment independently is a future enhancement to the parse service.
- **Persistent enrichment task integration** with the existing Fix Later Queue: low-confidence drafts could surface in the enrichment queue — future enhancement.
- **Scheduled auto-post batch runner**: Auto-post fires inline post-parse. A cron runner across pending trusted-vendor drafts is future hardening (mirrors `runAllProvidersCronSync` pattern from income integrations).
- **Postmark Inbound IP allowlisting**: As an additional security layer, configuring firewall rules to only accept Postmark's known IP ranges is deferred until deployment infrastructure supports it.

---

## Environment Variables Summary

| Variable | Phase | Purpose |
|---|---|---|
| `POSTMARK_INBOUND_WEBHOOK_USER` | DI-01 | Basic Auth username for Postmark webhook delivery |
| `POSTMARK_INBOUND_WEBHOOK_PASS` | DI-01 | Basic Auth password for Postmark webhook delivery |
| `POSTMARK_SERVER_INBOUND_HASH` | DI-01 | Full inbound address (e.g. `abc123@inbound.postmarkapp.com`) shown to business users |
| `SUPABASE_STORAGE_BUCKET_DOCUMENTS` | DI-01 | Supabase Storage bucket name — value: `documents` ✅ confirmed created |

---

## Validation Commands Reference

```bash
npx tsc --noEmit --incremental false
npx prisma validate
npx prisma migrate status
npx eslint src/features/documents/ app/(dashboard)/documents/ app/api/documents/ app/actions/modules/documents.ts components/nav/bottom-nav.tsx
node --test src/features/documents/server/postmark-inbound.adapter.test.mjs
node --test src/features/documents/server/inbound-address.repository.test.mjs
node --test src/domain/parsers/document-draft.test.mjs
node --test src/features/documents/server/vendor-profile.repository.test.mjs
node --test src/features/documents/server/document-post.service.test.mjs
node --test src/features/documents/server/trust.service.test.mjs
```

---

## Codebase Update Requirements

After each phase is complete:

1. Append a new entry at the top of `docs/codebase-changelog.md`
2. Update `## Product Capabilities` in `docs/codebase-overview.md` with `documents` feature section
3. Update `## Architecture Map` in `docs/codebase-overview.md` to include `src/features/documents`
4. Update `## Data Model` in `docs/codebase-overview.md` with new document entities
5. Update `docs/MASTER_BACKEND_ARCHITECTURE.md` Section 2 once DI-00 migration is applied (4 new tables, 3 new enums, 1 enum value addition)
6. Update this plan with phase completion notes (same format as `docs/income-integrations-onboarding-plan.md`)
7. Create one scoped git commit to this repository per completed checklist step and record commit hash in changelog

---

## Master Plan Cross-Reference

Tracked as initiative **DI** in `docs/master-plan-v2.md`.

- DI-00 through DI-05: sequentially dependent
- DI-06: deferrable independently
- No dependencies on any completed plan
- Fully additive — no existing module, table, route, or service is modified (except `FinancialSource` enum value addition in DI-00)


