# Codebase Overview

## Stack
- Next.js App Router app with React and TypeScript.
- Prisma ORM with PostgreSQL via `@prisma/adapter-pg`.
- Tailwind-based UI components.

## Product shape
This project is an inventory management/receiving app designed for restaurant operations. It supports four ingestion methods:
1. Barcode
2. Receipt parsing
3. Product photo parsing
4. Manual entry

The home route redirects into the receive flow, and dashboard pages are optimized for mobile with a bottom nav between Receive and Inventory.

## Feature implementation confirmation (current code)
Yes — the outlined MVP features are implemented in code today. This is not just schema/planning; there are concrete server actions and UI routes wired for each path:

| Feature | Current implementation evidence |
|---|---|
| Multi-modal ingestion hub | `app/(dashboard)/receive/page.tsx` renders and routes all 4 methods. |
| Barcode ingestion | `ingestByBarcode` looks up barcode and writes a transaction. |
| Photo ingestion + match assist | `ingestByPhoto` matches OCR text, supports suggestions, writes transaction, and learns alias. |
| Manual entry flow | `ingestManual` supports existing item or creation of new item, then writes transaction. |
| Receipt parse/review/commit | `processReceiptText` + `parseAndMatchReceipt` + `updateLineItemMatch` + `commitReceiptTransactions` implement full lifecycle and atomic commit. |
| OCR integration | `ocrImage` delegates to Google Vision REST client (`extractTextFromImage`). |
| Matching + confidence | `matchText` combines exact alias/fuzzy/word overlap and maps scores to confidence tiers. |
| Learning from corrections | `learnAlias` is called from receipt and photo flows to persist alias improvements. |
| Inventory visibility | Inventory list/detail pages load current quantities and transaction history. |

## Data model
The schema centers around:
- `inventory_items` (master records)
- `item_barcodes` and `item_aliases` (matching keys)
- `receipts` and `receipt_line_items` (receipt pipeline)
- `inventory_transactions` (append-only ledger)

The migration additionally defines views for current inventory levels and cost history.

## Core server actions
- `app/actions/inventory.ts`: CRUD for inventory records, barcodes, and aliases.
- `app/actions/transactions.ts`: single transactions and atomic receipt commits.
- `app/actions/receipts.ts`: receipt lifecycle (create, parse/match, review updates).
- `app/actions/ingestion.ts`: orchestrates barcode/photo/manual/receipt ingestion workflows.
- `app/actions/ocr.ts`: OCR server action wrapper.

## Matching and parsing pipeline
- `lib/parsers/receipt.ts` parses raw OCR text into structured line candidates (quantity, unit, prices).
- `lib/matching/engine.ts` resolves line text to inventory using:
  - exact alias match,
  - fuzzy trigram similarity,
  - word-overlap heuristics,
  - confidence thresholds (`high`/`medium`/`low`/`none`).
- Confirmed user corrections are learned back into `item_aliases`.

## UI flow summary
- **Receive hub**: choose barcode, receipt, photo, or manual.
- **Receipt page**: OCR (or manual text), parse/match, review line-by-line, then commit all.
- **Inventory list/detail**: current computed quantity, metadata, aliases, and recent transactions.

## Notable implementation details
- Prisma client is lazy-initialized to avoid build-time DB failures.
- Receipt commit is transactional: creates ledger rows, marks line items confirmed, and marks receipt committed in one DB transaction.
- OCR integrates with Google Vision REST API and gracefully returns structured errors if key/config/network fails.
