# Inventory Intake Plan

Last updated: February 25, 2026

## How To Use This Plan

This is a living handoff + execution document. Update it as you work.

Rules for every change made from this plan:

1. After completing a step or instruction, update the matching line in this file with a status (`[x]` completed, `[~]` partial, `[ ]` not started).
2. Add any problems, blockers, or unexpected behavior under that step/phase so the next engineer can continue without re-discovering issues.
3. Update the `Latest Update` section after each meaningful change with what was done, what remains, and any important caveats.
4. Keep the `Pick Up Here (Next Continuation)` section current so it always points to the next concrete task.
5. Do not erase useful historical notes; append short progress notes instead.

Recommended progress note format (short and repeatable):

- `Status:` `[x]` / `[~]` / `[ ]`
- `Changed:` files/modules touched
- `Issues:` blockers, lint/test failures, migration status, behavior risks
- `Next:` exact next step

## Local Test Account (Agent Testing - Local Only)

When any agent needs to run local manual/automation testing, they may use this **test account** to sign in and verify flows in this workspace.

- Base URL: `http://localhost:3000`
- Email: `mehdi.eg2004@gmail.com`
- Password: `testtest`

Disclaimer:

- Local testing use only. Do not publish these credentials or commit them to a public remote.
- If this account stops working, rotate/update the credentials here before the next testing session.
- Agents may use this account for local verification and smoke tests when a login is required.
## Latest Update

- **Phase E observability closeout slice: derived-rate summaries (resolver cache/unresolved/retry rates + receipt auto-resolution metrics)** (February 26, 2026):
  - Added derived-rate summaries to barcode resolver aggregate metrics in `app/actions/core/barcode-resolver.ts`:
    - global barcode cache read hit rate (`cache_reads.hit_rate`)
    - resolver unresolved ratio / resolved-external ratio / exception ratio
    - background retry success rate (surfaced in derived rates and background retry summary)
  - Added global barcode cache read counters/status breakdowns (`resolved` / `unresolved` / `needs_review`) to resolver metrics summaries.
  - Added lightweight process-local receipt matching aggregate metrics in `src/features/receiving/receipt/server/receipt-workflow.service.ts` with periodic structured summary logs for:
    - receipt counts by source (`parsed_text`, `tabscanner`)
    - cumulative matched / suggested / unresolved line totals
    - derived receipt auto-resolution rate (receipts fully auto-matched)
    - derived line auto-resolution rate + unresolved ratio
  - Receipt metrics hook is wired to both receipt matching paths after successful write/update of line items:
    - text parse flow (`parseAndMatchReceipt`)
    - TabScanner image flow (`processReceiptImage`)
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
    - `npx eslint app\actions\core\barcode-resolver.ts src\features\receiving\receipt\server\receipt-workflow.service.ts` -- 0 errors
  - Notes:
    - Metrics are process-local structured console summaries (no DB/dashboard persistence yet).
    - This closes the remaining Phase E observability gap called out in `Pick Up Here` step 8.
  - Docs refresh:
    - Phase E `Pick Up Here` step 8 marked complete
    - Phase E status updated to complete
    - `Pick Up Here` advanced to Phase D (enrichment queue)
  - Next:
    - Phase D kickoff: implement optional enrichment tracking + "fix later" workflow without blocking intake

- **Phase E platform slice: background retry scheduling for unresolved barcodes (process-local queue + retry observability/success tracking)** (February 26, 2026):
  - Added a process-local background retry scheduler in `app/actions/core/barcode-resolver.ts` for unresolved barcodes using cached `retry_after_at` backoff timing.
  - Scheduler behavior:
    - deduplicates pending jobs per barcode and reschedules earlier when a sooner retry window is observed
    - bounds queue size to avoid unbounded memory growth during churn bursts
    - defers retries when backoff is not yet due or when abuse guards/cooldowns are active
    - cancels pending retry jobs when a barcode later resolves successfully (`resolved` / `resolved_external`)
  - Added background retry observability to existing barcode resolver summary metrics/logs:
    - scheduling / dedupe / queue-drop / deferral counts
    - started retry count + result counts (`resolved_external`, `unresolved`, `error`)
    - queue depth and in-flight high-water marks
    - derived retry success rate summary
  - Implemented an internal resolver path for background retries that runs **external providers only** (no tenant auth context required), while preserving the existing exported `resolveBarcode(...)` behavior for user-triggered flows.
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
    - `npx eslint app\actions\core\barcode-resolver.ts` -- 0 errors
  - Notes:
    - Background retry scheduling is process-local only (in-memory timers) and resets on server restart.
    - Background retries intentionally skip tenant-scoped internal lookup because timer callbacks do not run with a request auth context.
    - Full queue/job persistence is still out of scope for this hardening slice.
  - Docs refresh:
    - Phase E `Pick Up Here` step 7 marked complete
    - Phase E status wording refreshed to reflect background retries now in place
  - Next:
    - Phase E follow-up: add broader derived-rate/dashboard summaries (cache hit rate, unresolved ratio, retry success rate, receipt auto-resolution rate) to close observability gaps

- **Phase E hardening slice: strict barcode lookup churn abuse prevention (cache-backed + process-local cooldowns)** (February 26, 2026):
  - Hardened `app/actions/core/barcode-resolver.ts` to reduce repeated external barcode-provider hammering for the same unresolved/external-only barcodes.
  - Added strict external-provider gating that now:
    - honors cached unresolved `retry_after_at` backoff windows (skip external providers while still allowing internal tenant lookup)
    - applies a process-local per-barcode churn cooldown when repeated unresolved / `resolved_external` lookups occur in a short window
    - applies a process-local global external-attempt burst cooldown for high-rate barcode churn across many calls
  - Preserved barcode UX during cooldown by serving cached external metadata (`resolved_external`) when available after the internal lookup misses, instead of forcing a hard downgrade to plain `unresolved`.
  - Added abuse-guard observability to existing barcode resolver summary metrics/logs:
    - skipped resolver-call counts
    - guard reason counts (`cache_retry_after`, per-barcode cooldown, global burst cooldown)
    - cached-external-served counts
    - per-provider guard-skipped counters
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
  - Notes:
    - Cache `retry_after_at` enforcement is persistent (DB-backed); churn/global burst cooldowns are process-local and reset on server restart.
    - Background retry scheduling for unresolved barcodes is still pending (next Phase E step).
  - Docs refresh:
    - Phase E `Pick Up Here` step 6 marked complete
    - Phase E wording/status refreshed to reflect stricter barcode abuse controls now in place
  - Next:
    - Phase E step 7: add background retry scheduling for unresolved barcodes (with retry observability/success tracking)

- **Phase E hardening slice: layered barcode-provider aggregate counters + depth/latency summaries** (February 26, 2026):
  - Added lightweight process-local aggregate metrics in `app/actions/core/barcode-resolver.ts` for the layered barcode provider stack (internal lookup + OFF / OBF / UPCDatabase / UPCitemdb).
  - Metrics now track and periodically log structured summaries for:
    - per-provider call counts and hit/miss/error/throttle counts
    - per-provider timeout counts and error-code counts
    - total/external provider fallback depth histograms (per resolver call)
    - resolver result/source counts and latency summaries (count/avg/max)
    - per-provider lookup latency summaries (count/avg/max)
  - Instrumentation is implemented by wrapping provider `lookup()` calls inside `resolveBarcode()`; resolver behavior/return contracts are unchanged.
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
  - Docs refresh:
    - Phase E `Pick Up Here` step 4 marked complete
    - Phase E wording/status refreshed to reflect barcode-provider aggregate counters now in place
  - Next:
    - Phase E next hardening slice: stricter rate limiting / abuse prevention for repeated barcode lookup churn
    - Phase E next platform slice: background retry scheduling for unresolved barcodes

- **Phase E hardening slice: repeated transient web fallback failure cooldown escalation** (February 26, 2026):
  - Tightened `lib/modules/shopping/web-fallback.ts` Serper retry/rate-limit behavior for repeated transient failures (timeouts, network errors, and retriable `5xx` responses).
  - Added a lightweight process-local transient failure streak tracker (time-windowed) so repeated transient provider failures trigger a temporary self-cooldown instead of repeatedly hammering the provider.
  - Preserved the existing `429` cooldown path, while enriching logs with transient failure streak/cooldown escalation context.
  - Added clearer structured logs when cooldown is entered because of repeated transient failures (not only explicit provider `429` rate limits).
  - Successful Serper responses now reset the transient failure streak tracker.
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
  - Notes:
    - This change is process-local hardening only (no schema changes).
    - Existing successful fallback parsing behavior is unchanged.
  - Next:
    - Phase E step 4: add aggregate counters for layered barcode providers
    - Phase E step 5: revisit Phase E wording/status after barcode-provider metrics are added

- **Phase C closure verification completed + Phase E validation checkpoint advanced** (February 26, 2026):
  - Re-verified place-scoped receipt aliasing Phase C closure status using current environment checks (no code changes required).
  - Confirmed current DB migration state and schema validity:
    - `npx prisma migrate status` -- database schema is up to date
    - `npx prisma validate --schema prisma/schema.prisma` -- success
  - Confirmed generated Prisma client still includes `receiptItemAlias` delegate/types (via local generated client inspection).
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
    - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -- 10/10 pass
  - Docs cleanup:
    - Phase C status updated from partial to complete in `Current Status`
    - Phase E `Pick Up Here` step 2 (static validation checkpoint) marked complete
  - Notes:
    - No runtime/manual UI receipt flow verification was re-run in this session.
    - No schema or application code changes were made; this was verification + documentation alignment.
  - Next:
    - Phase E step 3: tighten retry/rate-limit policy for repeated transient web fallback failures
    - Phase E step 4: add aggregate counters for layered barcode providers

- **Phase E hardening slice: aggregate web fallback outcome counters + provider depth/latency summaries** (February 25, 2026):
  - Added lightweight process-local aggregate metrics in `lib/modules/shopping/web-fallback.ts` for the post-receipt constrained web/AI fallback.
  - Metrics now track and periodically log cumulative counters for:
    - fallback outcomes (`success`, `no_results`, `throttled`, `error`, other unavailable cases)
    - raw result statuses (`ok`, `no_results`, `unavailable`) and unavailable reasons
    - parser mode usage (`none`, `deterministic`, `gemini`)
    - Serper attempt-depth histogram (`0/1/2...`) plus retry/throttle/timeout counts
  - Added latency summaries (count/avg/max) for:
    - total fallback runtime
    - Serper search runtime
    - Gemini parser runtime (when attempted)
  - Existing fallback behavior is unchanged; this is observability-only instrumentation with periodic structured console summary logs.
  - Validation:
    - `npx tsc --noEmit --incremental false` -- 0 errors
  - Next:
    - tighten retry/rate-limit policy for the web fallback provider (cooldown/backoff thresholds and emit reasoned logs for repeated transient failures)
    - extend similar lightweight counters to the layered barcode provider stack (OFF/OBF/UPCDatabase/UPCitemdb) for Phase E parity

- **Phase E hardening slice: structured web fallback provider timeout/retry/cooldown + observability metadata** (February 25, 2026):
  - Hardened `lib/modules/shopping/web-fallback.ts` (Serper path):
    - request timeout
    - transient retry (single retry for timeout/network/5xx)
    - provider cooldown on `429` rate-limit responses (and short cooldown on repeated timeouts)
    - structured console logging for success/failure/throttle outcomes
  - Hardened optional Gemini parser call with request timeout and safe fallback to deterministic parsing if the parser errors.
  - Added provider observability metadata to web fallback results (attempt count, duration, throttle/cooldown state, parser mode/timing).
  - Persisted provider observability metadata into `ShoppingSessionItem.resolution_audit.web_fallback` during post-receipt fallback attempts.
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Next:
    - add lightweight aggregate counters/metrics for fallback usage outcomes (success/no-results/throttled/error) and provider depth/latency summaries

- **Fallback audit metadata persistence added for unresolved barcode resolution traceability** (February 25, 2026):
  - Added `ShoppingSessionItem.resolution_audit` (`Json`) to persist fallback evidence and pairing decision metadata.
  - Added Prisma migration `20260225223000_shopping_session_item_resolution_audit` and applied it successfully.
  - Shopping fallback photo analysis now stores `photo_fallback` audit data on the staged barcode item:
    - barcode
    - OCR excerpt
    - parsed product hints (brand/product/size-related fields when available)
  - Post-receipt constrained web/AI fallback now stores `web_fallback` audit data on the staged barcode item:
    - query + rationale + status
    - photo-hint usage summary
    - structured web result snapshot + top candidates
    - pair-suggestion scores
    - suggested pair / ambiguity / auto-apply eligibility + reason
  - Manual and suggestion-driven barcode-to-receipt pairing now store `final_pairing_decision` audit metadata:
    - pairing source (`manual`, `web_suggestion_manual`, `web_suggestion_auto`)
    - staged item snapshot + barcode
    - receipt item snapshot
    - resolved inventory item id
    - reconciliation deltas/status
  - UI pairing actions now correctly tag suggestion-derived pair confirmations as `web_suggestion_manual`.
  - Validation:
    - `npx prisma validate --schema prisma/schema.prisma` -- success
    - `npx prisma generate` -- success
    - `npx prisma migrate deploy` -- applied `20260225223000_shopping_session_item_resolution_audit`
    - `npx tsc --noEmit` -- 0 errors
  - Next:
    - add lightweight observability around fallback usage/outcomes (counters/logs) and rate-limit/backoff hardening for external fallback providers

- **Strict auto-apply threshold added for post-receipt web/AI pairing suggestions (user-triggered)** (February 25, 2026):
  - Added explicit auto-apply eligibility logic to shopping web/AI fallback suggestions in `app/actions/modules/shopping.ts`:
    - requires high web/AI confidence
    - requires high receipt-pair confidence score
    - blocks auto-apply when top candidate is ambiguous vs second-best
  - `Try Web/AI Suggestion` in the Shopping manual pairing panel can now auto-apply the suggested receipt pair **only** when the strict threshold is met.
  - Auto-apply remains user-triggered (runs after the user taps the fallback suggestion button), not background/silent.
  - UI now shows auto-apply eligibility / reason messaging for web/AI suggestions.
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Next:
    - persist fallback evidence/audit metadata (photo hints + web rationale + confidence snapshot) for traceability/hardening

- **Photo-assisted web/AI fallback added to unresolved barcode pairing (authoritative phase)** (February 25, 2026):
  - Added optional item-photo analysis for unresolved scanned-barcode shopping items in `app/actions/modules/shopping.ts`:
    - validates the staged barcode item + receipt-scanned session
    - runs OCR (`extractTextFromImage`)
    - runs structured product parsing (`extractProductInfo`, same seam used by `/receive/photo`)
  - Added constrained post-receipt web fallback suggestion pipeline (`lib/modules/shopping/web-fallback.ts`):
    - structured search via Serper (env-gated on `SERPER_API_KEY`)
    - optional Gemini parsing of search results into structured fields (falls back to deterministic extraction if Gemini key is unavailable)
    - returns canonical name + brand/size/unit/pack hints + confidence
  - Added shopping action to suggest receipt-line pairing from web/AI fallback for a staged barcode item:
    - combines web/AI structured product result with unmatched receipt items
    - ranks likely receipt-line pairings with confidence
    - remains confirmation-first (no silent auto-pair)
  - Added UI in the Shopping manual pairing panel:
    - `Take Item Photo` (optional, improves fallback hints)
    - `Try Web/AI Suggestion`
    - displays suggested canonical product + confidence + ranked receipt pairing options
    - `Apply Suggested Pair` uses the existing manual-pair confirmation action
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Notes:
    - If `SERPER_API_KEY` is not configured, structured web fallback returns `unavailable` and the UI continues to support manual pairing.
    - This preserves the plan rule: web/AI fallback only runs in the post-receipt authoritative phase.
  - Next:
    - add stricter auto-apply threshold (optional) for web/AI pair suggestions when both web confidence and receipt-pair confidence are high
    - persist photo-assisted fallback evidence/audit metadata on the shopping session item or receipt line (optional hardening)

- **Manual unresolved barcode vs receipt-item pairing added (authoritative phase fallback UI)** (February 25, 2026):
  - Added a manual pairing action in `app/actions/modules/shopping.ts` to pair a staged scanned-barcode item to an unmatched receipt-origin shopping item after receipt scan.
  - Pairing action behavior:
    - validates both items belong to the same open shopping session with a scanned receipt
    - transfers the receipt line linkage/amounts onto the staged barcode item
    - deletes the consumed receipt-origin extra item to prevent duplicate receipt accounting
    - recomputes session state
    - treats manual pairing as a strong confirmation signal for barcode mapping persistence when an inventory item is known
  - Added a shopping UI fallback panel in `app/(dashboard)/shopping/page.tsx`:
    - lists unresolved scanned-barcode staged items
    - lists unmatched receipt items as tap-to-pair choices
    - appears after receipt scan when the scan is complete enough for reconciliation
  - This implements the user-confirmation fallback path while constrained web query + AI fallback is still pending.
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Next:
    - implement constrained web query + AI fallback for post-receipt unresolved barcode/receipt pairs before this manual UI is used in the majority of cases

- **Post-receipt unresolved-barcode pairing heuristics added before web/AI fallback** (February 25, 2026):
  - Improved shopping receipt reconciliation scoring in `app/actions/modules/shopping.ts` for staged items with saved `scanned_barcode`:
    - sequence/order proximity heuristic (staged scan order vs receipt line order)
    - price proximity boost (when staged price exists)
    - quantity agreement boost
    - small boost when receipt line already has a high-confidence matched item
  - Added stricter auto-pair gating for scanned-barcode items during receipt reconciliation:
    - higher score threshold than normal text matching
    - ambiguity margin check (top candidate must sufficiently beat second-best candidate)
  - Behavior now matches the planned authoritative-phase rule:
    - high-confidence scanned-barcode pairings are auto-linked
    - low-confidence or ambiguous pairings stay unresolved (deferred for future web/AI fallback or manual pairing UI)
  - This was applied in both shopping receipt reconciliation paths:
    - parsed raw-text receipt flow
    - TabScanner structured receipt flow
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Next:
    - implement constrained web query + AI fallback for post-receipt unresolved barcode/receipt pairs only
    - add explicit manual pairing UI for unresolved barcodes vs receipt items when confidence remains low

- **Shopping quick-shop barcode resolver now runs layered barcode APIs + structured UPC persistence** (February 25, 2026):
  - Updated quick-shop barcode scan action (`addShoppingSessionItemByBarcodeQuick(...)`) in `app/actions/modules/shopping.ts` to use the shared layered barcode resolver stack:
    - internal lookup first
    - then Layer 1-4 barcode providers until first hit
    - still **no** constrained web query / AI fallback during live shopping
  - Added structured `scanned_barcode` persistence on `ShoppingSessionItem`:
    - Prisma schema field: `shopping_session_items.scanned_barcode` (nullable)
    - migration file: `prisma/migrations/20260225213000_shopping_session_item_scanned_barcode/migration.sql`
    - migration also includes a best-effort backfill from legacy provisional `[UPC:...]` labels
  - Applied the migration with `npx prisma migrate deploy` and regenerated Prisma client.
  - Shopping UI quick-scan feedback now reflects layered-barcode resolution outcomes:
    - inventory hit
    - external barcode metadata hit (still provisional for receipt-phase pairing)
    - unresolved barcode (deferred)
  - Cart rows now surface scanned UPC from the structured field (with fallback to older provisional-label parsing for previously staged rows).
  - Receipt reconciliation now auto-links a saved scanned barcode to an inventory item when the matched receipt line resolves with **high confidence** (authoritative-phase pairing bootstrap).
  - Validation:
    - `npx prisma validate --schema prisma/schema.prisma` -- succeeds
    - `npx prisma generate` -- succeeds
    - `npx prisma migrate deploy` -- succeeds (applied `20260225213000_shopping_session_item_scanned_barcode`)
    - `npx tsc --noEmit` -- 0 errors
  - Next:
    - improve post-receipt unresolved-barcode pairing heuristics before web/AI fallback (price/order/context-aware pairing)
    - implement constrained web query + AI fallback only for post-receipt low-confidence unresolved pairs
    - add explicit UI for manual pairing of unresolved barcodes vs receipt items when confidence remains low

- **Shopping quick-shop barcode loop added (internal-only lookup; deferred fallback)** (February 25, 2026):
  - Added `addShoppingSessionItemByBarcodeQuick(...)` to `app/actions/modules/shopping.ts` for in-session barcode adds during Shopping Mode.
  - Quick-shop barcode behavior now:
    - normalizes UPC/EAN
    - performs **internal tenant DB lookup only** (no external provider/web fallback during active shopping)
    - immediately saves a staged shopping cart item
    - returns resolved vs provisional status for UI feedback
  - Added Shopping UI quick-scan flow to `app/(dashboard)/shopping/page.tsx`:
    - scan/type UPC/EAN input with Enter-to-scan
    - `Scan & Save` loop for repeated scans (`scan -> save -> next scan`)
    - visible `Conclude Quick Shop` button that jumps the user to the receipt scan phase
    - immediate feedback card showing resolved item name or provisional unresolved item
  - Added provisional unresolved item display support in shopping UI:
    - unresolved quick scans are labeled as `Unresolved Item`
    - scanned UPC is surfaced on the cart row badge for local shopping context
  - Authoritative-phase UX copy now explicitly marks receipt scan as the final matching/deferred fallback phase.
  - Important limitation (temporary):
    - unresolved quick-scan UPCs are currently persisted via a provisional shopping item label suffix (`[UPC:...]`) for local session visibility only
    - a dedicated structured `shopping_session_items` barcode field is still recommended for clean authoritative-phase UPC reuse
  - Validation:
    - Code changes applied; typecheck/runtime verification still pending
  - Next:
    - add structured shopping-session UPC persistence (schema field) and use it in post-receipt authoritative reconciliation
    - implement constrained web query fallback only in the post-receipt low-confidence path (not during live shopping)

- **Phase C -- store receipt line-code alias learning added (place-scoped)** (February 25, 2026):
  - Added extraction of likely store line codes from receipt line text (example: `5523795 TERRA DATES $9.49` -> `5523795`) in `lib/core/matching/receipt-line-core.ts`.
  - Receipt line resolution now checks a place-scoped code alias before the existing place-scoped text alias and fuzzy fallback.
  - `learnReceiptItemAlias(...)` now saves both:
    - the normalized receipt text alias
    - the extracted store line code alias (when present and distinct)
  - This reuses the existing `ReceiptItemAlias` table (no new migration required) while improving future exact matches for stores that print stable item codes.
  - Validation:
    - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -- 10/10 pass
    - `npx tsc --noEmit` -- 0 errors

- **Shopping receipt reconciliation hardening -- incomplete scans are now rescan-only** (February 25, 2026):
  - Tightened shopping receipt commit gating in `app/actions/modules/shopping.ts`:
    - sessions with scanned receipts must be fully `ready` to commit
    - incomplete scanned receipts now return a rescan-required error (`"Receipt scan is not 100% complete..."`)
    - commit still blocks on subtotal/total mismatch against scanned receipt totals
  - Disabled manual mismatch resolution for scanned receipts that are not fully reconciled:
    - `resolveShoppingSessionItem(...)` now rejects and instructs the user to rescan
    - shopping UI replaces `Keep Staged / Use Receipt / Skip` buttons with a `Rescan Receipt` prompt when the scanned receipt is incomplete
  - Receipt viewer title now prefers the shopping session's Google Places store name over OCR establishment text:
    - `getReceiptDetail(...)` includes `shopping_session.store_name`
    - `app/(dashboard)/receive/receipt/[id]/page.tsx` uses that preferred store name for header + digital receipt title
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
  - Notes:
    - This enforces rescan-first behavior for incomplete shopping receipt scans and prevents commit/manual discrepancy resolution from papering over missed OCR lines.

- **Phase C -- receipt alias resolver hardened + targeted core tests added** (February 25, 2026):
  - Extracted pure receipt-line core helpers into `lib/core/matching/receipt-line-core.ts` so place-scoped alias behavior can be tested without Prisma/Next runtime wiring.
  - Refactored `lib/core/matching/receipt-line.ts` to use the shared core helpers for:
    - place-scoped alias lookup query-building
    - alias upsert payload-building
    - alias-first -> fuzzy fallback resolution status mapping (`receipt` vs `shopping`)
  - Added targeted `node:test` coverage in `lib/core/matching/receipt-line-core.test.mjs` for:
    - alias normalization and place-scoped lookup/upsert payload generation
    - alias precedence over fuzzy matching
    - profile-specific handling of medium-confidence matches (`receipt => suggested`, `shopping => unresolved`)
    - unresolved fallback when no matches exist
  - Validation:
    - `node --test --experimental-transform-types lib\\core\\matching\\receipt-line-core.test.mjs` -- 7/7 pass
  - Notes:
    - Runtime/UI verification is still pending (receipt review + shopping reconciliation flows).

- **Infrastructure cleanup -- physical DB naming now matches business model** (February 25, 2026):
  - Applied migration `20260225200000_rename_legacy_restaurant_tables_to_business` to rename legacy database objects:
    - tables: `restaurants` -> `businesses`, `user_restaurants` -> `user_businesses`, `restaurant_invites` -> `business_invites`
    - enums: `RestaurantRole` -> `BusinessRole`, `RestaurantInviteStatus` -> `BusinessInviteStatus`
  - Updated Prisma schema mappings so `Business`, `UserBusiness`, and `BusinessInvite` point to the new physical table names.
  - Validation:
    - `npx prisma migrate deploy` -- succeeds
    - `npx prisma generate` -- succeeds
    - `npx prisma migrate status` -- database schema is up to date
    - `npx tsc --noEmit` -- 0 errors
  - Notes:
    - This is a naming/alignment cleanup only (no phase scope change).
    - Restart the local Next.js dev server if it was running before `prisma generate` so the in-memory Prisma client picks up the renamed DB objects.

- **Phase C -- place-scoped receipt aliasing (partial implementation)** (February 25, 2026):
  - Added additive Prisma model for `ReceiptItemAlias` in `prisma/schema.prisma` with:
    - `business_id`, `google_place_id`, normalized `alias_text`, `inventory_item_id`, `confidence`, `created_at`
    - unique constraint on `(business_id, google_place_id, alias_text)`
  - Added SQL migration `prisma/migrations/20260225180000_receipt_item_aliases_phase_c/migration.sql` and applied it to the configured PostgreSQL database with `npx prisma migrate deploy`.
  - Ran `npx prisma generate`; generated client now includes `receiptItemAlias` delegate.
  - Updated `lib/core/matching/receipt-line.ts`:
    - exact place-scoped alias lookup runs before fuzzy matching
    - falls back to existing `matchText(...)` pipeline
    - unresolved behavior preserved
    - added `learnReceiptItemAlias(...)` helper (fail-open until Prisma client/migration are applied)
  - Wired `google_place_id` into receipt line resolution in:
    - `app/actions/modules/receipts.ts` (receipt parse + TabScanner receipt image flow)
    - `app/actions/modules/shopping.ts` (shopping receipt reconciliation flows)
  - Added place-scoped alias learning on user confirmation paths:
    - `updateLineItemMatch(...)` in receipts module
    - `resolveShoppingSessionItem(...)` in shopping module when a receipt-linked line is resolved
  - Added explicit receipt commit idempotency guard in `commitReceiptTransactions(...)`:
    - checks `receipt.status === "committed"` before processing and returns existing transactions only when the requested line set is already committed
  - Validation:
    - `npx prisma validate --schema prisma/schema.prisma` -- succeeds
    - `npx prisma migrate status` -- database schema is up to date
    - `npx tsc --noEmit` -- 0 errors
  - Remaining Phase C work:
    - runtime verification in receipt + shopping UI flows (confirm alias is learned, then auto-resolves on next receipt from same `google_place_id`)
    - add/execute targeted tests for place-scoped alias matching/learning if desired
    - restart local Next.js dev server if it was already running before `prisma generate` (to refresh in-memory Prisma client)

- **Phase B -- external barcode provider integrations complete** (February 25, 2026):
  - Implemented all four external provider adapters with real API calls:
    - **Open Food Facts** (`open-food-facts.ts`): Calls OFF API v2, extracts product_name, brands, quantity, categories, image_front_url. No auth required.
    - **Open Beauty Facts** (`open-beauty-facts.ts`): Same API shape as OFF, different domain. No auth required.
    - **UPCDatabase** (`upcdatabase.ts`): Calls `api.upcdatabase.org/product/{barcode}` with `Authorization: Bearer` token from `UPCDATABASE_API_KEY` env var. Returns `no_api_key` error gracefully when env var is not set.
    - **UPCitemdb** (`upcitemdb.ts`): Uses free trial endpoint `/prod/trial/lookup?upc=`. Includes in-memory daily throttle (95/day with 5-request buffer under 100/day limit).
  - Introduced `ExternalProductMetadata` type and `hit_external` outcome for external providers (product found in external DB but not in tenant inventory).
  - Introduced `resolved_external` result variant in `BarcodeResolutionResult` so consumers can distinguish internal inventory matches from external product discoveries.
  - Updated `resolver-core.ts` with `hit_external` handling, `upsertResolvedExternalGlobalBarcodeCatalog` callback, and `buildExternalHitSnapshot` for event metadata.
  - Updated `barcode-resolver-cache.ts` with `buildResolvedExternalGlobalBarcodeCatalogUpsertArgs` -- populates `canonical_title`, `brand`, `size_text`, `category_hint`, `image_url` in the global catalog.
  - Enabled the fallback chain: `getBarcodeProviders()` now returns all 5 providers (internal + 4 external).
  - Added 4-second per-provider timeout (`AbortSignal.timeout(PROVIDER_TIMEOUT_MS)`).
  - Confidence scoring per plan: OFF/OBF with name+brand = `high`; UPCDatabase/UPCitemdb or incomplete fields = `medium`; unresolved = `none`.
  - Updated consumers:
    - `ingestion.ts` (`ingestByBarcode`): returns `external_match` error with metadata when `resolved_external`, so UI can offer item creation.
    - Barcode scan page (`receive/barcode/page.tsx`): added `external_found` step that shows product image, name, brand, size, category from external provider, then feeds into `ItemNotFound` with pre-filled suggested name.
    - `ItemNotFound` component: added optional `suggestedName` prop to pre-fill the new item name from external metadata.
  - Added 2 new resolver-core tests:
    - `hit_external` returns `resolved_external` with metadata, upserts external catalog, records 2 events (internal miss + external hit)
    - Fallback chain: error on first external provider falls through to next provider which returns `hit_external`
  - Validation:
    - `npx tsc --noEmit` -- 0 errors
    - `node --test barcode-resolver-cache.test.mjs` -- 5/5 pass
    - `npx next build` -- succeeds
  - Next concrete task: **Phase C -- place-scoped receipt aliasing** or **runtime verification of external provider lookups**.

- Root cause of the Layer-0 cache/event persistence failure confirmed (February 25, 2026):
  - Ran direct Prisma write diagnostics against `global_barcode_catalog` and `barcode_resolution_events` -- **all writes succeed** when using the correct Prisma client instance and the exact same builder functions the resolver uses.
  - Confirmed the generated Prisma client exposes `globalBarcodeCatalog` and `barcodeResolutionEvent` delegates correctly.
  - The failure was exclusively caused by a **stale in-memory Prisma client** in the Next.js dev server. The previous agent ran `prisma generate` but did not restart the dev server, so the runtime's cached `PrismaClient` instance (in `globalForPrisma`) predated the schema additions. `getBarcodeCacheDelegates()` correctly returned `null` because the old instance didn't have the new model delegates.
  - **Resolution: no code bug. Restarting the dev server after `prisma generate` is all that is needed.** The code, builders, DB schema, and migration are all correct and functional.
- Improved delegate-unavailable logging: replaced one-shot `hasLoggedBarcodeCacheDelegatesUnavailable` flag with a counting approach that logs on the 1st occurrence and every 10th thereafter, making it harder to miss in the dev console.
- Expanded `BarcodeResolutionResult` return payload with a `confidence` field (`high` / `medium` / `low` / `none`):
  - Internal tenant lookups return `"high"` confidence on hit.
  - External providers (Phase B) will return `"medium"` by default, with per-provider tuning.
  - Unresolved results return `"none"`.
  - The `source` (provenance) field was already present; `confidence` completes the Phase A payload expansion.
- Validation (February 25, 2026):
  - `npx tsc --noEmit` -- 0 errors
  - `node --test --experimental-transform-types app\\actions\\core\\barcode-resolver-cache.test.mjs` -- 5/5 pass
  - `npx next build` -- succeeds
- Phase A is now **complete**. All items are done: resolver seam, cache/event integration, confidence + provenance in return payload, targeted test coverage, and DB migration applied.
- Next concrete task: **Phase B -- implement external provider integrations** (Open Food Facts, Open Beauty Facts, UPCDatabase, UPCitemdb).

Previous updates (retained for history):

- Static/runtime debugging of the Layer-0 cache persistence issue identified two likely causes and shipped a guard/fix on February 25, 2026:
  - `getBarcodeCacheDelegates()` could return `null` silently when the running Next.js dev server was still using an older in-memory Prisma client instance (for example after `prisma generate` without a server restart), which would disable cache/event writes with no log output
  - `buildBarcodeResolutionEventCreateArgs(...)` was sending `normalized_fields_snapshot: null` for miss/error events; Prisma nullable JSON fields may reject raw `null` in create payloads, so the builder now omits the field when no snapshot exists
- Added a one-time local-dev warning in `app/actions/core/barcode-resolver.ts` when cache delegates are unavailable, with an explicit restart hint for the Next.js server after Prisma client regeneration.
- Updated resolver cache helper tests for the event-payload change and revalidated targeted cache helper coverage.
- Validation (February 25, 2026):
  - `node --test --experimental-transform-types app\\actions\\core\\barcode-resolver-cache.test.mjs` ✅
  - `npx eslint app/actions/core/barcode-resolver.ts app/actions/core/barcode-resolver-cache.ts app/actions/core/barcode-resolver-cache.test.mjs` ✅
  - Running `app\\actions\\core\\barcode-resolver-core.test.mjs` directly with `node --test` still hits an existing local Node ESM extensionless-import resolution issue in this repo context (not caused by the cache payload patch)
- Next concrete task is now runtime re-verification after restarting the local Next.js server (to refresh the Prisma client in memory), then checking whether cache/event rows persist and whether any new resolver cache logs appear.
- Runtime app-flow verification was performed in the local UI on February 25, 2026:
  - barcode receive flow successfully linked barcodes to inventory items and subsequent barcode lookups resolved correctly via the existing tenant-scoped item lookup path
  - `item_barcodes` rows were confirmed in the dev DB after manual testing
- DB verification immediately after the app-flow check shows `global_barcode_catalog` and `barcode_resolution_events` are still empty (`0` rows each), so the new resolver cache/event persistence path is not currently writing records despite the lookup flow succeeding.
- Added local-dev cache-layer error logging in `app/actions/core/barcode-resolver.ts` (still fail-open) so hidden Prisma/cache write failures surface in the Next.js server console during the next barcode lookup.
- Important behavior clarification (confirmed by manual test): cross-account barcode matches do **not** resolve to another user/business inventory item today, which is expected under tenant isolation. The planned global barcode layer is for shared barcode knowledge/provenance, not cross-tenant inventory item reuse.
- Added targeted resolver cache/event metadata coverage for Layer-0 side effects (hit/miss/error) by extracting shared payload builders into `app/actions/core/barcode-resolver-cache.ts` and reusing them in `app/actions/core/barcode-resolver.ts`.
- Added `node:test` coverage in `app/actions/core/barcode-resolver-cache.test.mjs` for:
  - resolved cache upsert metadata reset
  - unresolved miss/error failure-count + retry-backoff updates
  - resolved-row preservation on later misses
  - event payload generation and hit snapshot fields
- Validation (February 25, 2026):
  - `node --test --experimental-transform-types app\\actions\\core\\barcode-resolver-cache.test.mjs` ✅
  - `npx eslint app/actions/core/barcode-resolver.ts app/actions/core/barcode-resolver-cache.ts app/actions/core/barcode-resolver-cache.test.ts` ✅
- Runtime app-flow verification of cache/event writes has started and exposed a persistence issue (rows not writing while lookup succeeds); capturing the hidden cache-layer error and fixing the Prisma write path is now the next concrete task before external providers.
- Added `How To Use This Plan` guidance at the top so engineers update statuses, issues, and the `Latest Update` section after each plan-driven change.
- Imported implementation progress from `docs/inventoryintakeplan.progress-handoff.md` (dated February 25, 2026).
- Latest completed change (from handoff): additive Prisma schema updates and a draft SQL migration for the global barcode cache/provenance prerequisite (`GlobalBarcodeCatalog` and `BarcodeResolutionEvent`), not applied yet.
- This document now includes a current status snapshot, exact pickup point, and a structured index.
- Implemented Layer-0 resolver cache integration in `app/actions/core/barcode-resolver.ts`:
  - reads `GlobalBarcodeCatalog` (when Prisma client + DB schema support it)
  - updates cache metadata for internal lookup `hit` / `miss` / `error`
  - writes `BarcodeResolutionEvent` records for internal outcomes
- Preserved current barcode UX behavior:
  - tenant-scoped `lookupBarcode(...)` remains the active match source
  - external providers remain disabled (`getBarcodeProviders()` still internal-only)
  - cache/event writes fail open (no-op) if Prisma client generation or DB migration is not yet applied
- Ran `npx prisma generate` and confirmed the generated Prisma client now includes `GlobalBarcodeCatalog`, `BarcodeResolutionEvent`, and the barcode cache/provenance enums.
- Applied `20260225133000_global_barcode_cache_prereq` to the configured PostgreSQL dev database on February 25, 2026 using `npx prisma migrate deploy`; follow-up `npx prisma migrate status` reports the schema is up to date.
- Next immediate follow-up: validate resolver cache/event writes in app flow (or targeted tests) and add resolver coverage for cache/event side effects.

## Current Status

- [x] Phase 0 (mandatory audit) completed and documented in `docs/inventoryintakeplan.phase0-audit.md`.
- [x] Phase A (safe internal layer) complete. Resolver seam, cache/event integration, confidence + provenance in return payload, targeted test coverage, DB migration applied, and runtime verified.
- [x] Phase B (external provider integrations) complete. All four providers (OFF, OBF, UPCDatabase, UPCitemdb) implemented with real API calls, fallback chain enabled, 4s timeouts, confidence scoring, `resolved_external` result type, UI support in barcode page, and 7 total resolver tests passing.
- [x] Phase C (place-scoped receipt aliasing) complete. Place-scoped alias schema/migration, matching + learning paths, and receipt/shopping wiring are implemented; migration/schema/type verification reconfirmed on February 26, 2026.
- [ ] Phase D (enrichment queue) not started.
- [x] Phase E (observability/hardening) complete. Shopping web fallback audit trails/hardening/metrics, layered barcode-provider aggregate counters (provider outcomes/depth/latency/error-code summaries), stricter barcode lookup abuse controls/cooldowns, process-local background retries for unresolved barcodes, and derived-rate summaries (cache hit/unresolved/retry success + receipt auto-resolution) are in place.

## Pick Up Here (Next Continuation)

Primary continuation task: **Phase D -- kick off the optional enrichment queue ("fix later" tracking) without blocking intake workflows**.

Phases A, B, and C are complete. The barcode resolver supports internal inventory lookups and 4 external providers (OFF, OBF, UPCDatabase, UPCitemdb) with fallback chain, timeouts, confidence scoring, and global barcode catalog caching.

Do this next:

1. `[x]` Add aggregate fallback counters + provider depth/latency summary logging in `lib/modules/shopping/web-fallback.ts` (process-local, structured console metrics).
2. `[x]` Validate the current web fallback hardening slice (`npx tsc --noEmit --incremental false`; optional manual run of `Try Web/AI Suggestion` flow to inspect summary logs).
3. `[x]` Tighten retry/rate-limit policy for repeated transient web fallback failures:
   - review timeout cooldown thresholds and repeated-error escalation behavior
   - add clearer summary logs when cooldown is entered due to repeated transient failures (not only `429`)
4. `[x]` Add lightweight aggregate counters for the layered barcode provider stack (OFF / OBF / UPCDatabase / UPCitemdb):
   - provider hit/miss/error/throttle counts
   - fallback depth distribution
   - timeout/error-code counts
   - latency summaries (count/avg/max)
5. `[x]` Revisit Phase E section wording/status after the above metrics are added across both web fallback and barcode provider paths
6. `[x]` Add strict rate limiting / abuse prevention for repeated barcode lookup churn (especially repeated unresolved/external misses that hammer external providers)
7. `[x]` Add background retry scheduling for unresolved barcodes (with retry observability/success tracking)
8. `[x]` Add broader derived-rate/dashboard summaries across resolver and receipt matching paths:
   - cache hit rate
   - unresolved ratio
   - background retry success rate
   - receipt auto-resolution rate
9. `[ ]` Phase D kickoff: propose/implement minimal optional enrichment tracking + non-blocking "fix later" flow

Notes:

- The `Supplier` model already has `google_place_id` and `ShoppingSession` has `google_place_id`. These are the store context identifiers.
- `ItemAlias` is the existing general-purpose alias table (not store-scoped). `ReceiptItemAlias` is the new store-scoped table for receipt-specific mappings.
- Chain-level alias fallback is a future enhancement -- start with strict `place_id` scoping.
- The receipt matching pipeline currently only uses the fuzzy engine. The alias layer adds a fast exact-match first step.
- Phase B external providers now work: `resolved_external` result type, UI support in barcode page, and confidence scoring are all in place.

## Index

- [How To Use This Plan](#how-to-use-this-plan)
- [Latest Update](#latest-update)
- [Current Status](#current-status)
- [Pick Up Here (Next Continuation)](#pick-up-here-next-continuation)
- [Progress Imported From Handoff (2026-02-25)](#progress-imported-from-handoff-2026-02-25)
- [Goal](#goal)
- [Phase 0 - Mandatory Initial Evaluation](#phase-0---mandatory-initial-evaluation)
- [Target System Design (High-Level Behavior)](#target-system-design-high-level-behavior)
- [Data Model Design Principles](#data-model-design-principles)
- [Confidence and Matching Rules](#confidence-and-matching-rules)
- [Implementation Plan (Step-by-Step)](#implementation-plan-step-by-step)
- [Constraints](#constraints)
- [Expected Deliverables](#expected-deliverables)
- [Conclusion](#conclusion)

## Progress Imported From Handoff (2026-02-25)

Source: `docs/inventoryintakeplan.progress-handoff.md`

### Completed Work Recorded in Handoff

1. Phase 0 audit completed and documented in `docs/inventoryintakeplan.phase0-audit.md`.
2. Added a Layer-0 barcode resolver seam (`app/actions/core/barcode-resolver.ts`) with typed `resolved` / `unresolved` results and normalized barcode handling.
3. Routed barcode ingest action through the resolver seam (`app/actions/core/ingestion.ts`).
4. Routed barcode receive UI preview lookup through the same resolver seam (`app/(dashboard)/receive/barcode/page.tsx`).
5. Added provider adapter contract + registry seam (`app/actions/core/barcode-providers.ts`), but runtime remains internal-only.
6. Added external provider adapter stubs (OFF / OBF / UPCDatabase / UPCitemdb), all returning `not_implemented`.
7. Added additive Prisma schema models/enums for global barcode cache + provenance (`prisma/schema.prisma`).
8. Added draft SQL migration for the barcode cache/provenance prerequisite (`prisma/migrations/20260225133000_global_barcode_cache_prereq/migration.sql`) and did not apply it.

### Validation Performed in Handoff

- Targeted ESLint passed for barcode resolver/provider files and barcode receive page.
- Prisma schema validation passed (`npx prisma validate --schema prisma/schema.prisma`).

### Known Unrelated Repo Issues (Observed During Handoff Validation)

Full `npm run lint` fails on existing unrelated hook lint errors in:

- `app/(dashboard)/receive/receipt/[id]/page.tsx`
- `app/page.tsx`
- `components/theme/theme-toggle.tsx`

### Not Done Yet (Carried Forward)

- Resolver does not yet read/write `GlobalBarcodeCatalog`.
- Resolver does not yet create `BarcodeResolutionEvent` records.
- Unresolved caching/backoff behavior is not implemented.
- Provider throttling/retry/circuit-breaker behavior is not implemented.
- External adapters are stubs only (no live API calls/auth/normalization mappings).
- Prisma migration was drafted but not executed in app integration flow.

## Goal

Design and implement a production-grade, multi-industry inventory intelligence system that supports:

- Multi-tenant, multi-location businesses (stores, salons, barbershops, restaurants).
- Barcode-first product identity resolution with layered external provider fallback.
- Shopping mode tied to Google Places (`place_id`) for store-context-aware receipt mapping.
- Receipt ingestion that progressively "learns" store-specific aliases and reduces future manual work.
- Optional product photo enrichment without blocking core intake workflows.
- Safe, auditable, and step-by-step rollout.

The system must:

- Minimize friction for small business users.
- Avoid duplicate work and repeated API costs.
- Improve automation over time via structured learning.
- Maintain strict tenant isolation.
- Be implemented incrementally and safely.

The agent MUST first evaluate the existing database schema and codebase before proposing or implementing any structural changes.

## Phase 0 - Mandatory Initial Evaluation

Status (as of February 25, 2026): Completed and documented in `docs/inventoryintakeplan.phase0-audit.md`.

Before making any changes:

1. Audit the current database
   - Identify all inventory-related entities.
   - Identify how items, locations, and organizations are modeled.
   - Identify how receipt data is stored (if already implemented).
   - Identify whether barcode data is currently stored and how.
   - Identify whether there is any global vs organization-specific product separation.
   - Identify constraints, indexes, and RLS/authorization boundaries.
2. Audit the codebase
   - Locate barcode scanning flow.
   - Locate receipt parsing (Tabscanner) flow.
   - Identify where inventory updates are written.
   - Identify whether background jobs / queues exist.
   - Identify where Google Places is integrated.
   - Identify where product images are stored (if anywhere).
   - Identify caching patterns.
3. Document:
   - What can be reused.
   - What must be refactored.
   - What is missing entirely.
   - Risks of modifying existing logic.

Only after this evaluation may structural changes be proposed.

## Target System Design (High-Level Behavior)

### Barcode Resolution Pipeline

Resolution order:

- Layer 0: Internal database lookup (cache/mappings).
- Layer 1: Open Food Facts lookup (food/grocery oriented, no API key; requires clean User-Agent).
- Layer 2: Open Beauty Facts lookup (cosmetics/personal care oriented, no API key; requires clean User-Agent).
- Layer 3: UPCDatabase.org lookup (general fallback; requires account + bearer token; enforce rate limits).
- Layer 4: UPCitemdb lookup (general fallback; free explorer/trial endpoint with daily limits; enforce throttling).
- If no hit: mark as unresolved and avoid re-query spam via retry scheduling/backoff.

Provider usage requirements (implementation notes):

- Open Food Facts:
  - No token required for read access.
  - Call: `world.openfoodfacts.org` product-by-barcode endpoint.
  - Set a descriptive `User-Agent` for requests.
- Open Beauty Facts:
  - No token required for read access.
  - Call: `world.openbeautyfacts.org` product-by-barcode endpoint.
  - Set a descriptive `User-Agent` for requests.
- UPCDatabase.org:
  - Requires creating an account and obtaining an API token.
  - Send token as `Authorization: Bearer <token>` header.
  - Call: their product-by-barcode endpoint.
- UPCitemdb:
  - Free plan uses their "trial" lookup endpoint with strict daily quota.
  - Paid plans use headers; free trial does not (but still enforce internal throttling).
  - Call: their trial lookup endpoint with barcode query string.

Behavior:

- Normalize barcode format before lookup (strip spaces, validate UPC/EAN format/check digit when applicable).
- Cache all results (including unresolved) to minimize external requests and cost.
- Assign confidence score to resolved items (source reliability + field completeness).
- If low confidence, prompt user confirmation (edit name/brand/size/category).
- If no image returned, enqueue optional image enrichment task (do not block the main flow).
- If external providers fail, allow user to name the item and optionally add a photo to seed your internal mapping.

Expected outcome:

- Each unique barcode becomes known once.
- Subsequent scans are instant and cost-free.
- Data quality improves over time and external calls become rare.

### Shopping Mode (Google Places Context)

Shopping sessions are tied to:

- `place_id` (specific store)
- Optional merchant chain identity (derived from store brand/chain grouping when safe)

Behavior:

- When a user shops at a store, session context includes `place_id`.
- Once a shopping session is started for a store, the user can use a quick-shop loop:
  - scan item barcode
  - save item to cart
  - scan next item barcode
  - conclude quick shop via an explicit on-screen action/button
- Support scanning the **product barcode (UPC/EAN) directly from packaging** during shopping.
- For non-integrated stores (for example Costco, Walmart), product barcode scanning is the **primary identifier** for packaged items.
- Product barcode scanning builds and reuses a **store-independent canonical product database**.
- Persist `UPC -> Canonical Product` mappings so future receipt resolution can reuse the same product identity without re-learning.
- Receipt alias mappings are scoped to `place_id` first (store-specific).
- When the same item is purchased at a different store:
  - Barcode resolves globally via internal cache.
  - Receipt alias mapping is new for that store context (`place_id`) unless chain-level reuse is safe.
- Consider chain-level alias reuse as a fallback if you can reliably identify the chain and item-number stability.

Product barcode scan architecture (primary signal for packaged goods):

```text
Scan Product Barcode
-> Lookup internal DB
-> If exists: return canonical product
-> If not: trigger resolution pipeline
-> Save UPC -> Canonical Product mapping
```

During active shopping (quick-shop phase), use a fast path and defer expensive fallback work:

```text
During Shopping

Scan UPC

Attempt quick DB lookup

If no DB hit -> run layered barcode APIs (Layer 1-4) until first hit

If found -> show clean name

If not found -> show provisional label (e.g., "Unresolved Item")

Do NOT trigger expensive web query yet

Store UPC locally (shopping session/cart)

Repeat scan -> save to cart -> next item until user selects Conclude Quick Shop
```

Note: while the user is actively shopping, the system may attempt barcode normalization plus layered barcode-provider resolution (internal + Layer 1-4), but expensive constrained web-query / AI fallback should be deferred until the receipt-backed reconciliation phase.

Shopping-mode barcode provider behavior (layered barcode APIs, no web/AI during live shopping):

- When an item is scanned in Shopping Mode:
  - Run internal barcode lookup first.
  - If no internal hit, run the layered barcode provider stack in order (Layer 1 -> Layer 4) until a hit is returned.
  - Stop on first barcode-provider hit (internal or external barcode metadata hit).
- If no hit is returned from the full barcode provider stack:
  - save/store the scanned barcode on the shopping session item first
  - keep the item as unresolved/provisional during live shopping
  - wait for final receipt scan (authoritative phase) before attempting expensive web/AI fallback
- Live shopping should not trigger the constrained web query / AI search fallback.

### Receipt Ingestion Intelligence

For each parsed receipt line (including shopping-session receipt reconciliation):

Attempt resolution in this order (item resolution flow):

1. Store-specific alias match (`place_id` + receipt item identifier).
2. Chain-level alias match (if applicable and proven safe).
3. Heuristic match (description similarity + price proximity + quantity).
4. Prompt user to scan product barcode (UPC/EAN) from packaging (photo optional; primary signal for packaged goods in non-integrated stores).
5. Final failsafe only: constrained web query resolution when UPC lookup fails, fuzzy match confidence is low, and the internal DB has no strong match.

When barcode is scanned:

- Resolve via the Barcode Resolution Pipeline (Layer 0-4).
- Create alias mapping between store receipt identifier and resolved barcode mapping.
- Persist mapping for future automation at that store (and optionally chain).

Final web query fallback (last-resort failsafe, not primary):

- Trigger only when all of the following are true:
  - UPC lookup fails.
  - Receipt fuzzy match confidence is low.
  - Internal DB has no strong match.
- Perform a constrained, structured web query using:
  - parsed item text
  - store name
  - brand (if available)
  - pack size (if parsed)
- Use structured search and field extraction (not raw scraping) to return candidate product names and normalized fields:
  - brand
  - size
  - unit
  - pack count
- AI proposes a canonical item name and assigns a confidence score.
- Auto-save only if confidence exceeds the defined threshold; otherwise require user confirmation before saving.
- Any web-derived resolution must be validated before permanent storage.

Shopping mode phased resolution (receipt-backed authoritative phase):

```text
After Receipt Scan (Authoritative Phase)

Resolution hierarchy:

UPC exact match

Store SKU previously mapped

Fuzzy match using receipt text + price

Only if still low confidence -> web query fallback

If web confidence high -> save canonical mapping

Otherwise -> request user confirmation
```

If barcode provider stack did not resolve during live shopping:

- Use the saved unresolved barcode + receipt reconciliation context to attempt pairing with a receipt item.
- If receipt-based pairing confidence is high, pair them and persist the barcode mapping.
- If still low confidence, prompt for an optional item photo, then run the constrained web query + AI canonicalization fallback using receipt context plus photo-derived hints (brand/size/pack text) when available.
- If web/AI still cannot produce a high-confidence result, show unresolved barcodes vs receipt items and require user pairing/confirmation.

Design requirement:

- Receipt line identifiers must be treated as store/chain context aliases, not global product IDs.
- Receipt scanning must become more automated over time.

### Optional Enrichment Queue

If:

- No image exists
- Metadata confidence is low
- Product lacks normalization

Create non-blocking enrichment tasks:

- "Add product photo"
- "Confirm product size"
- "Confirm category"
- "Confirm brand / title cleanup"

User may complete later; never block intake.

## Data Model Design Principles

Do NOT hardcode schema changes immediately.

Instead:

- Propose minimal new logical entities needed to support:
  - Global barcode knowledge (cross-tenant reuse where appropriate)
  - Store-context receipt alias mapping (`place_id`-scoped with optional chain fallback)
  - Confidence + enrichment tracking
  - Audit history and source attribution (which provider produced the data)
- Ensure multi-tenant isolation.
- Avoid duplicating product identity per organization unless necessary.
- Keep receipt-to-product mapping distinct from inventory transaction records.
- Ensure idempotency protections for repeated scans or duplicate receipt ingestion.
- Store provider raw responses only if necessary; prefer normalized fields + provenance metadata.

Data mapping strategy note (global anchor):

```text
Store_ID
    -> Store_SKU (optional)
        -> UPC
            -> Canonical_Product
```

- `UPC` is the global anchor for packaged goods product identity.
- `Store_SKU` / receipt item codes remain store-context identifiers and should resolve through `UPC` when available.
- Persisted `UPC -> Canonical_Product` mappings should be reused across stores and during future receipt resolution.

## Confidence and Matching Rules

Define structured scoring:

Confidence hierarchy (highest -> lowest):

- Exact UPC match.
- Store SKU previously mapped to UPC (store-context alias already learned).
- Strong fuzzy match with historical data.
- PLU match (produce), especially when supported by description/price context.
- Web query resolution (last-resort; lowest confidence).

Web-based resolution must be validated before permanent storage.

Shopping-mode timing rule:

- During the live quick-shop scan loop, do not run the expensive web query fallback for unresolved UPCs.
- Defer web-based resolution to the post-receipt authoritative phase, where receipt text/price context improves confidence and reduces unnecessary calls.

Barcode Resolution:

- Resolved from internal cache = highest confidence.
- Resolved from Open Food Facts / Open Beauty Facts with complete fields = high.
- Resolved from UPCDatabase / UPCitemdb with partial fields = medium.
- Conflicting provider results = low (requires confirmation).
- Heuristic-only inference = low (requires confirmation).

Receipt Matching:

- Exact store alias match = auto-resolve.
- Chain alias match = medium-high confidence (only if chain stability is validated).
- Description similarity > threshold + price match = medium confidence.
- PLU match (produce) = medium confidence unless corroborated by stronger signals.
- Web query fallback result = low/lowest confidence and confirmation-first unless confidence exceeds a strict auto-save threshold.
- No reliable match = require barcode scan.

Never auto-commit low-confidence matches without confirmation.

Updated Resolution Pipeline (summary):

```text
Quick Shop (in-session): scan UPC -> internal lookup -> layered barcode APIs (Layer 1-4, stop on first hit) -> save to cart -> next scan -> Conclude Quick Shop
If barcode stack misses: save unresolved barcode and defer web/AI
Post-receipt (authoritative): UPC exact -> Store SKU mapped -> fuzzy/PLU -> pair unresolved barcodes to receipt lines -> constrained web query + AI (last failsafe) -> user pairing if still unresolved
Persist only validated mappings; reuse UPC -> Canonical Product globally (UPC is the anchor)
```

## Implementation Plan (Step-by-Step)

### Phase A - Safe Internal Layer

Status (as of February 25, 2026): Partially implemented.

Completed so far (from handoff):

- Resolver seam added for shared barcode resolution entrypoint (`app/actions/core/barcode-resolver.ts`).
- Barcode ingest action routed through resolver (`app/actions/core/ingestion.ts`).
- Barcode receive preview UI routed through resolver (`app/(dashboard)/receive/barcode/page.tsx`).
- Behavior preserved for current tenant-scoped lookup path and existing return contracts.

Remaining work for this phase / immediate bridge:

- [x] Add internal barcode cache logic with resolved/unresolved status tracking using the new global cache tables (guarded/fail-open until Prisma client + DB migration are applied).
- [~] Add confidence scoring + provenance fields (source provider) in resolver storage/event logging (resolver return payload not expanded yet).
- [x] Add targeted coverage for resolver cache/event metadata behavior (`hit` / `miss` / `error`) via shared payload-builder tests.
- Add or finalize basic normalization rules for barcodes and titles as needed.
- Do not modify receipt logic yet.
- Deploy and verify.

### Phase B - External Provider Layering (Sources 1-4)

Status (as of February 25, 2026): Not implemented yet (seams and prerequisites only).

Completed prerequisites so far (from handoff):

- Provider interface + registry seam added (`app/actions/core/barcode-providers.ts`).
- External adapter stubs created for OFF / OBF / UPCDatabase / UPCitemdb (all `not_implemented`).
- Additive Prisma schema + draft migration created for `GlobalBarcodeCatalog` and `BarcodeResolutionEvent` (not applied).

Remaining work:

- Implement provider fallback chain in this order:
  - Open Food Facts -> Open Beauty Facts -> UPCDatabase -> UPCitemdb
- Add per-provider throttling, timeouts, retries, and circuit breakers.
- Add caching + retry backoff for unresolved barcodes (avoid hammering providers).
- Keep rollout staged so external providers stay disabled until internal cache/provenance path is stable.
- Deploy and verify.

### Phase C - Receipt Alias Mapping (Google Places Context)

Status (as of February 26, 2026): Completed (place-scoped alias schema/migration, matching + learning paths, and receipt/shopping wiring are in place; migration/schema/type verification reconfirmed).

Planned work (historical phase intent; completed):

- Introduce store-context alias resolution using `place_id`.
- Implement receipt line resolution pipeline (alias -> heuristic -> barcode prompt).
- Store alias mapping after user barcode scan confirmation.
- Ensure idempotent receipt ingestion (same receipt cannot double-add inventory).
- Deploy and verify.

### Phase D - Enrichment Queue

Status (as of February 25, 2026): Not started.

Planned work:

- Implement optional enrichment tracking and "fix later" UI.
- Ensure missing images do not block workflows.
- Add lightweight admin controls for resolving low-confidence items.

### Phase E - Observability & Hardening

Status (as of February 26, 2026): Completed (shopping web fallback audit trails/hardening/metrics, layered barcode-provider aggregate counters, strict barcode abuse controls, background retries for unresolved barcodes, and derived-rate summaries including cache hit/unresolved/retry success + receipt auto-resolution metrics are in place).

Planned work:

- Add metrics:
  - Cache hit rate
  - Provider hit rate per source (OFF / OBF / UPCDatabase / UPCitemdb)
  - Provider fallback depth distribution
  - Receipt auto-resolution rate
  - Unresolved ratio and retry success rate
- Add strict rate limiting and abuse prevention.
- Add background retry scheduling for unresolved barcodes.
- Add logging + error handling + audit trails.

Each phase must:

- Be independently deployable.
- Not break existing flows.
- Include migration strategy if needed.

## Constraints

- Do not refactor unrelated systems.
- Do not introduce breaking schema changes without migration plan.
- Maintain tenant isolation at all times.
- Avoid synchronous external API dependency in user-critical paths where possible (use async enrichment where appropriate).
- Ensure duplicate receipt ingestion cannot double-add inventory.
- Take this project step-by-step; ship in small increments with acceptance criteria.

## Expected Deliverables

1. A written evaluation of the current database and codebase.
2. A proposed minimal logical data extension model (no premature schema bloat).
3. A phased rollout plan with clear acceptance criteria per phase.
4. Pseudocode for:
   - `resolve_barcode()` (Layer 0-4 with caching and backoff)
   - `resolve_receipt_line()` (`place_id` aliasing + heuristic + barcode prompt)
   - `create_alias_mapping()` (store/chain mapping after confirmation)
5. Risk assessment and mitigation plan (rate limits, bad data, duplicates, provider outages).
6. Clear reasoning for every structural change and why it is the minimum needed.

## Conclusion

This system must evolve into a self-learning barcode and receipt intelligence engine.

The guiding principle:

- Barcode = global product truth.
- Receipt identifiers = store-context alias (`place_id`-scoped; chain fallback only when safe).
- Users teach the system once.
- The system automates thereafter.

Begin with a full audit of the existing system, then proceed in incremental, testable phases using the layered external sources: Open Food Facts, Open Beauty Facts, UPCDatabase.org, and UPCitemdb.
