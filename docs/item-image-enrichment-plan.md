# Item Image Enrichment Plan

Last updated: February 28, 2026
Status: ACTIVE - launch slice IMG-00/IMG-01 prioritized; IMG-02/IMG-03 post-launch queue
Constitution source: `docs/execution-constitution.md`

---

## Latest Update

- **2026-02-28 - Mandatory execution restatement gate added.**
  - Added explicit "Mandatory Restatement Before Phase Work" section.
  - Requires constitution restatement before starting any `IMG-*` task.

- **2026-02-28 - Launch scope confirmation finalized.**
  - Restaurant launch requires IMG-00 and IMG-01 only.
  - No IMG-02/IMG-03 enrichment runs are required for launch.
  - No requirement to pre-populate real produce images before launch.

- **2026-02-28 - Launch slicing applied from master plan v2.**
  - Launch-critical scope is IMG-00 and IMG-01 only.
  - IMG-02 and IMG-03 remain planned for post-launch execution.

- **2026-02-28 — Plan created (v1).** Full plan authored covering produce (PLU) and barcode enrichment channels.

---

## Pick Up Here

Launch path: start at **IMG-00**, then **IMG-01**.

Post-launch path: continue with IMG-02 and IMG-03.

---

## Mandatory Restatement Before Phase Work

Before starting any checklist item in this plan:

- [ ] Paste `Constitution Restatement` template from `docs/execution-constitution.md` into session/job summary.
- [ ] Confirm scope sentence references exact `IMG-*` task ID.
- [ ] If task touches UI, include UI/UX confirmations from constitution restatement.

---

## Commit Checkpoint (Required)

After each completed checklist step in this plan:

- [ ] Create one scoped git commit before moving to the next step.
- [ ] Include the `IMG-*` task ID in the commit message.
- [ ] Record commit hash + title in job summary/changelog evidence.

---

## Purpose

Ensure every inventory item in the system has an image where one is available. Images power the Uber Eats–style grocery grid UI, item cards, receipt correction review, and the document intake vendor mapping panel.

Two enrichment channels are defined:

1. **PLU channel** — `produce_items` table rows enriched via Spoonacular ingredient image lookup, keyed by commodity + variety name. One-time batch enrichment script, images stored in Supabase Storage.
2. **Barcode channel** — `global_barcode_catalog` rows enriched via existing barcode resolution providers (UPC Database, UPCitemdb). `image_url` column already exists on this table. This channel fills gaps where providers return an image URL and ensures those URLs are mirrored to Supabase Storage for permanence.

The unified display layer is `inventory_items.image_url` — a single nullable field populated by a resolver that checks: own uploaded image → PLU image (if produce) → barcode catalog image (if barcode-linked) → null.

---

## Core Principles

1. **Images are never blocking.** No intake, scan, or posting flow waits on image enrichment. Images are decorative metadata.
2. **Own your storage.** All image URLs stored in DB point to your Supabase Storage bucket (`item-images`), not to external CDNs. External URLs are only a transient enrichment step.
3. **One-time enrichment, not runtime calls.** No external API is called at display time. Enrichment runs once per PLU and once per barcode resolution.
4. **Graceful degradation.** Items without images show a placeholder. No UI error, no broken layout.
5. **PLU images are language-agnostic.** A PLU has one canonical image regardless of language row — stored against `plu_code` in a new `produce_item_images` table.

---

## Architecture

### Storage bucket

Bucket: `item-images` (private, Supabase Storage)

Path conventions:
```
item-images/produce/{plu_code}.jpg        ← PLU enrichment output
item-images/barcodes/{barcode_normalized}.jpg  ← barcode enrichment output
item-images/inventory/{inventory_item_id}.jpg  ← user-uploaded or manually assigned
```

### Schema additions

**`produce_item_images`** — new table (one row per PLU code, language-agnostic)
- `plu_code Int @id` — FK to `produce_items` (any language row)
- `image_url String` — Supabase Storage public or signed URL
- `storage_path String` — raw bucket path (`item-images/produce/{plu_code}.jpg`)
- `source_provider String` — e.g. `"spoonacular"`, `"manual"`
- `enriched_at DateTime`
- `@@map("produce_item_images")`

**`inventory_items.image_url String?`** — new nullable column on existing table
- Populated by the unified image resolver (IMG-02)
- Not set by any intake, scan, or document flow directly

**`global_barcode_catalog.image_url`** — already exists. IMG-01 adds `image_storage_path String?` alongside it to track the mirrored Supabase Storage path.

### Unified image resolver

`src/features/inventory/server/item-image.resolver.ts`

```
resolveItemImageUrl(inventoryItem, { pluCode?, barcodeNormalized? }) → string | null

Priority:
  1. inventory_items.image_url (user-uploaded or manually assigned) → return immediately
  2. pluCode provided → look up produce_item_images by plu_code → return storage_path URL
  3. barcodeNormalized provided → look up global_barcode_catalog.image_url → return it
  4. null
```

This resolver is called when building item cards and inventory list projections — not at scan time.

---

## Enrichment Sources

### PLU Channel — Spoonacular Ingredient API

**Endpoint used:** `GET https://api.spoonacular.com/food/ingredients/search?query={name}&number=1&apiKey={key}`

**Response shape (relevant fields):**
```json
{
  "results": [
    {
      "id": 9003,
      "name": "apple",
      "image": "apple.jpg"
    }
  ]
}
```

**Image URL construction:** `https://spoonacular.com/cdn/ingredients_500x500/{image}`

**Enrichment script logic:**
```
For each unique (commodity, variety) pair in produce_items (EN rows only):
  1. Build search query: variety ?? commodity (e.g. "Granny Smith Apple" or "Apple")
  2. GET /food/ingredients/search?query={name}&number=1
  3. If result found:
     a. Fetch image bytes from spoonacular CDN URL
     b. Upload to item-images/produce/{plu_code}.jpg in Supabase Storage
     c. Upsert produce_item_images row
  4. If no result: log miss, skip (no row created — resolver returns null)
  5. Rate limit: 1 req/sec (Spoonacular free tier = 150/day → run over multiple days or use $10/month plan)
```

**Coverage expectation:** ~70–80% of the ~4,479 PLU rows will match. Common varieties (Granny Smith, Roma Tomato, etc.) match well. Rare specialty varieties may miss.

**Required env var:**
```
SPOONACULAR_API_KEY=
```

### Barcode Channel — Existing providers + mirror

`global_barcode_catalog.image_url` is already populated by UPC Database and UPCitemdb during barcode resolution (existing IMG-01 enrichment path). What's missing is:

1. Mirroring those external URLs to Supabase Storage (external URLs rot)
2. Propagating the image down to `inventory_items.image_url` via the resolver

The mirror job runs on a schedule (nightly) and processes any `global_barcode_catalog` row where `image_url IS NOT NULL AND image_storage_path IS NULL`.

---

## Phases

---

### IMG-00 — Schema Additions and Contracts

**Goal:** Add `produce_item_images` table, add `image_url` to `inventory_items`, add `image_storage_path` to `global_barcode_catalog`. Define TypeScript contracts.

**Status:** `[ ]` pending

#### Checklist

Schema:
- [ ] Add `ProduceItemImage` model to `prisma/schema.prisma`:
  - `plu_code Int @id`
  - `image_url String`
  - `storage_path String`
  - `source_provider String`
  - `enriched_at DateTime @default(now())`
  - `@@map("produce_item_images")`
- [ ] Add `image_url String?` to `InventoryItem` model
- [ ] Add `image_storage_path String?` to `GlobalBarcodeCatalog` model
- [ ] Run `npx prisma migrate dev --name item_image_enrichment_schema`
- [ ] Run `npx prisma generate`

TypeScript contracts at `src/features/inventory/shared/item-image.contracts.ts`:
- [ ] `IMAGE_SOURCE_PROVIDERS` tuple: `['spoonacular', 'barcode_provider', 'manual']`
- [ ] `ImageSourceProvider` type
- [ ] `ProduceImageRecord` DTO: `{ pluCode: number, imageUrl: string, storagePath: string, sourceProvider: ImageSourceProvider, enrichedAt: Date }`
- [ ] `ItemImageResolution` type: `{ imageUrl: string | null, source: 'own' | 'produce' | 'barcode' | 'none' }`
- [ ] `ITEM_IMAGES_BUCKET = 'item-images' as const`
- [ ] `PRODUCE_IMAGE_PATH_PREFIX = 'produce/' as const`
- [ ] `BARCODE_IMAGE_PATH_PREFIX = 'barcodes/' as const`
- [ ] `INVENTORY_IMAGE_PATH_PREFIX = 'inventory/' as const`

Validation:
- [ ] `npx prisma validate` → PASS
- [ ] `npx tsc --noEmit --incremental false` → PASS

---

### IMG-01 — Storage Service and Resolver

**Goal:** Implement the image storage service (upload + signed URL) and the unified item image resolver. Wire resolver into inventory item projections.

**Status:** `[ ]` pending

**Prerequisite:** IMG-00 complete. `item-images` bucket created in Supabase Storage (private).

#### Checklist

Image storage service:
- [ ] Create `src/features/inventory/server/item-image-storage.service.ts`:
  - `uploadImageFromUrl(sourceUrl: string, storagePath: string)` → `{ storagePath: string, publicUrl: string }`:
    - Fetches image bytes from `sourceUrl` (with timeout 10s, max 5MB)
    - Uploads to `item-images` bucket at `storagePath`
    - Returns storage path + Supabase Storage URL
    - Throws `ImageFetchError` on fetch failure, `ImageStorageError` on upload failure
  - `uploadImageFromBuffer(buffer: Buffer, storagePath: string, contentType: string)` → `{ storagePath: string, publicUrl: string }`
  - `getImageSignedUrl(storagePath: string, expiresInSeconds?: number)` → `string`
  - `imageExistsInStorage(storagePath: string)` → `boolean`
    - Used by enrichment scripts to skip already-stored items (idempotency)

Produce image repository:
- [ ] Create `src/features/inventory/server/produce-image.repository.ts`:
  - `upsertProduceImage(pluCode: number, record: { imageUrl, storagePath, sourceProvider })` → `ProduceItemImage`
  - `findProduceImage(pluCode: number)` → `ProduceItemImage | null`
  - `listUnenrichedPluCodes()` → `number[]`
    - Returns all `plu_code` values from `produce_items` (EN rows) where no `produce_item_images` row exists

Unified image resolver:
- [ ] Create `src/features/inventory/server/item-image.resolver.ts`:
  - `resolveItemImageUrl(params: { inventoryItemImageUrl?: string | null, pluCode?: number | null, barcodeNormalized?: string | null })` → `ItemImageResolution`
    - Priority chain as defined in Architecture section
    - Pure function — no DB calls (caller pre-fetches what's needed)
  - `resolveItemImageUrlFromDb(inventoryItemId: string, businessId: string)` → `ItemImageResolution`
    - DB-aware variant: loads item + produce image + barcode catalog in one query
    - Used for single-item detail views

Wire into inventory projections:
- [ ] Update inventory item list query (wherever `InventoryItem` rows are projected for UI) to include `image_url` field
- [ ] Pass `image_url` through to item card components

Unit tests:
- [ ] Create `src/features/inventory/server/item-image.resolver.test.mjs`:
  - Test: own `image_url` present → returns `{ source: 'own', imageUrl }`
  - Test: no own, plu code present, produce image exists → returns `{ source: 'produce', imageUrl }`
  - Test: no own, no plu, barcode catalog has image → returns `{ source: 'barcode', imageUrl }`
  - Test: nothing → returns `{ source: 'none', imageUrl: null }`
  - Test: own image takes priority over produce image when both present
  - Minimum 5 test cases

Validation:
- [ ] `node --test src/features/inventory/server/item-image.resolver.test.mjs` → PASS
- [ ] `npx tsc --noEmit --incremental false` → PASS

---

### IMG-02 — PLU Enrichment Script (Spoonacular)

**Goal:** One-time batch script that iterates all PLU codes, queries Spoonacular ingredient search by commodity+variety name, downloads the image, stores it in Supabase Storage, and records the result in `produce_item_images`.

**Status:** `[ ]` pending

**Prerequisite:** IMG-01 complete. `SPOONACULAR_API_KEY` added to `.env`. `item-images` Supabase Storage bucket created (private).

#### Checklist

- [ ] Add `SPOONACULAR_API_KEY=` to `.env`
- [ ] Create Supabase Storage bucket `item-images` (private)
- [ ] Create `scripts/enrich-produce-images.mjs`:

  ```
  Algorithm:
    1. listUnenrichedPluCodes() — only processes PLUs without an existing image row
    2. For each plu_code:
       a. Load EN produce_item row (commodity + variety)
       b. Build search term: `${variety ?? ''} ${commodity}`.trim()
       c. GET https://api.spoonacular.com/food/ingredients/search?query={term}&number=1&apiKey={key}
       d. If results[0] exists:
          - Construct CDN URL: https://spoonacular.com/cdn/ingredients_500x500/{results[0].image}
          - storagePath = `produce/{plu_code}.jpg`
          - imageExistsInStorage(storagePath) → skip if already uploaded (resume safety)
          - uploadImageFromUrl(cdnUrl, storagePath)
          - upsertProduceImage(plu_code, { imageUrl: publicUrl, storagePath, sourceProvider: 'spoonacular' })
       e. If no result: log `[MISS] PLU {plu_code} — {term}`, continue
       f. Sleep 700ms between requests (≤ 150/day free tier safe pace)
    3. Print summary: total / enriched / missed / skipped
  ```

  Script flags:
  - `--dry-run` — logs what would happen, no writes
  - `--limit N` — process only first N PLUs (for testing)
  - `--plu N` — enrich a single PLU code

- [ ] Run `node scripts/enrich-produce-images.mjs --dry-run --limit 10` → verify output
- [ ] Run `node scripts/enrich-produce-images.mjs --limit 20` → verify 20 rows in `produce_item_images`, images visible in Supabase Storage
- [ ] Run full enrichment: `node scripts/enrich-produce-images.mjs` (may span multiple days on free tier)

Validation:
- [ ] 10+ rows in `produce_item_images` after test run
- [ ] Images accessible via signed URL from `item-images/produce/` bucket path
- [ ] `listUnenrichedPluCodes()` returns 0 after full run

---

### IMG-03 — Barcode Image Mirror Job

**Goal:** Mirror existing `global_barcode_catalog.image_url` values (set by UPC/UPCitemdb providers) to Supabase Storage. Populate `image_storage_path`. Nightly job processes new rows.

**Status:** `[ ]` pending

**Prerequisite:** IMG-01 complete.

#### Checklist

- [ ] Create `src/features/inventory/server/barcode-image-mirror.service.ts`:
  - `mirrorPendingBarcodeImages(limit = 100)`:
    - Queries: `global_barcode_catalog WHERE image_url IS NOT NULL AND image_storage_path IS NULL LIMIT {limit}`
    - For each row:
      - `storagePath = barcodes/{barcode_normalized}.jpg`
      - `imageExistsInStorage(storagePath)` → if yes, just update `image_storage_path` (already mirrored)
      - `uploadImageFromUrl(image_url, storagePath)`
      - Update `global_barcode_catalog.image_storage_path = storagePath`
    - Returns `{ processed: number, failed: number }`
  - On fetch/upload failure: log error, continue (don't block batch)

- [ ] Add `mirrorBarcodeImages` server action (admin-only) to trigger manually
- [ ] Wire `mirrorPendingBarcodeImages(100)` into existing nightly cron (or add standalone cron route `app/api/cron/mirror-barcode-images/route.ts`)

Validation:
- [ ] Manual trigger: `mirrorPendingBarcodeImages(10)` → 10 rows get `image_storage_path` populated
- [ ] Resolver now returns `source: 'barcode'` for those items in inventory list
- [ ] `npx tsc --noEmit --incremental false` → PASS

---

## Environment Variables

| Variable | Phase | Purpose |
|---|---|---|
| `SPOONACULAR_API_KEY` | IMG-02 | Spoonacular ingredient search API key |
| `ITEM_IMAGES_BUCKET` | IMG-01 | Supabase Storage bucket name — value: `item-images` |

---

## Supabase Setup Required

- [ ] Create bucket `item-images` in Supabase Storage (private)
- [ ] No RLS policies needed — access is via service role key only (signed URLs for display)

---

## Validation Commands Reference

```bash
npx prisma validate
npx prisma migrate status
npx tsc --noEmit --incremental false
npx eslint src/features/inventory/server/item-image.resolver.ts src/features/inventory/server/item-image-storage.service.ts
node --test src/features/inventory/server/item-image.resolver.test.mjs
node scripts/enrich-produce-images.mjs --dry-run --limit 10
```

---

## Codebase Update Requirements

After each phase:
1. Append entry to `docs/codebase-changelog.md`
2. Update `docs/codebase-overview.md` — Data Model section with new columns/table
3. Update `docs/MASTER_BACKEND_ARCHITECTURE.md` after IMG-00 migration
4. Update this plan with phase completion notes
5. Create one scoped git commit per completed checklist step and record commit hash in changelog

---

## Master Plan Cross-Reference

Tracked as initiative **IMG** in `docs/master-plan-v2.md`.

- IMG-00 → IMG-01 → IMG-02 and IMG-03 are parallel (both depend on IMG-01, not each other)
- No dependencies on DI initiative
- Fully additive — existing barcode resolution pipeline is unchanged


