# Initial PRD: Multi-Modal Inventory Ingestion System

## Label
- `initialprd`

## 1. Product Definition
### Core Purpose
Enable restaurants to ingest inventory from real-world inputs (barcode, product photo, or receipt) and convert them into structured, trackable inventory with minimal effort.

### Product Vision
A multi-modal inventory ingestion system that converts barcodes, product images, and receipts into structured inventory with intelligent matching and a transaction-based ledger.

### End Goal
A manager can return from a grocery run, scan a single receipt, and have inventory updated within seconds.

---

## 2. Core Modules
1. **Inventory Master**
2. **Inventory Ingestion Engine** (core)
3. **Receipt Parsing Engine** (new)
4. **Inventory Ledger**
5. **Inventory Viewer**

---

## 3. Inventory Ingestion Engine (Core)
The ingestion engine supports four methods, ordered by real-world usage and speed.

### 3.1 Barcode Scan (Primary)
**Best for:** Standard, repeatable inventory

**Flow:**
1. Scan barcode
2. Match to inventory item
3. Enter quantity
4. Confirm

### 3.2 Photo Parsing (Product-Level)
**Best for:** Products without barcodes

**Flow:**
1. Capture packaging photo
2. OCR extracts product name, size, and quantity hints
3. System suggests existing match or creates new item
4. User confirms

### 3.3 Manual Entry (Fallback)
**Best for:** Edge cases and OCR failures

**Flow:**
1. Search or create item
2. Enter quantity/unit/cost/source
3. Confirm

### 3.4 Receipt Parsing (High-Leverage)
**Best for:** Bulk purchases from grocery/suppliers

**Flow:**
1. Tap **Scan Receipt**
2. Take photo or upload image
3. System parses receipt lines
4. System matches each line to inventory
5. User reviews and fixes exceptions
6. Tap **Add All**

---

## 4. Receipt Parsing Engine (Detailed)
### Purpose
Convert one receipt image into multiple inventory additions in a single action.

### Input
- Receipt photo/upload

### Extraction Output
For each receipt line item:
- Raw item text
- Parsed/normalized name
- Quantity and unit (if available)
- Optional cost fields (line cost/unit cost)

### Matching Output
For each line item:
- Matched inventory item (or unresolved)
- Confidence score
- Suggested action (auto-assign, suggest, manual)

### Transaction Output
Creates multiple `PURCHASE` ledger entries atomically (single user confirmation):
- `+Chicken Breast: +2kg`
- `+Plastic Cups: +100`
- `+Napkins: +200`
- `+BBQ Sauce: +1L`

---

## 5. Matching & Intelligence Layer
### 5.1 Fuzzy Matching
Handle noisy receipt text (e.g., `CHK BRST 2KG`) and map to canonical inventory records.

**Signals:**
- String similarity
- Historical mappings
- Supplier-specific patterns
- Unit compatibility

### 5.2 Historical Learning
Persist mapping decisions from prior corrections.

Example rule:
- `Great Value Napkins` → `Napkins (Standard)`

### 5.3 Confidence Scoring
Each match gets a score and routing:
- **High confidence:** auto-assign
- **Medium confidence:** suggest and allow quick confirm
- **Low confidence:** require user input

### 5.4 Bulk Confirmation UX
Tabular review before commit:
- Receipt Item
- Matched Item
- Quantity
- Status

Users can edit inline and then confirm all lines.

---

## 6. Inventory Master
### Existing Fields
- Name
- Category
- Unit
- Units per case
- Cost
- Supplier
- Barcodes (optional)

### New Requirement: Aliases
Aliases become first-class for robust matching.

Examples:
- Chicken Breast
- Chicken
- CHK BRST
- Boneless Chicken

---

## 7. Inventory Ledger
Every ingestion method writes normalized `PURCHASE` transactions.

### Ledger Metadata
- `input_method`: `barcode | photo | manual | receipt`
- `source`: `supplier | grocery | unknown`
- `raw_data`: OCR payload and/or receipt extraction trace

---

## 8. Inventory Viewer
### Enhancements
- Show source of stock updates (receipt/barcode/photo/manual)
- Display cost history sourced from receipts
- Show purchase frequency trends

---

## 9. Data Model Additions
### `receipts`
- `id`
- `image_url`
- `raw_text`
- `parsed_data`
- `timestamp`

### `receipt_line_items`
- `id`
- `receipt_id`
- `raw_name`
- `parsed_name`
- `matched_inventory_item_id`
- `quantity`
- `confidence_score`

### `item_aliases`
- `id`
- `inventory_item_id`
- `alias_text`

---

## 10. Input Method Hierarchy
| Method | Speed | Power | Use Case |
|---|---|---|---|
| Barcode | Fastest | High | Standard recurring inventory |
| Receipt | Fast | Highest | Bulk purchases |
| Photo | Medium | Medium | No barcode items |
| Manual | Slow | Necessary | Edge cases |

---

## 11. Functional Requirements
### FR-1: Multi-Modal Ingestion
System must support barcode, product photo, manual, and receipt inputs.

### FR-2: Receipt Parsing
System must parse receipt images into line-item candidates with quantities when detectable.

### FR-3: Match Assistance
System must match each line item with confidence classification (high/medium/low).

### FR-4: Bulk Review and Commit
System must provide a single review screen for all parsed items and support one-click commit.

### FR-5: Transaction Integrity
Bulk receipt commit must create one `PURCHASE` ledger transaction per confirmed line item.

### FR-6: Learn from Corrections
System must store approved alias/mapping corrections for future auto-match improvement.

### FR-7: Traceability
System must preserve source metadata and extraction traces for auditing and debugging.

---

## 12. Non-Functional Requirements
- **Speed:** Receipt parsing + initial matching should feel near-real-time for typical receipts.
- **Reliability:** Imperfect OCR should degrade gracefully to user correction, not hard failure.
- **Usability:** Corrections must be fast and inline to keep bulk entry efficient.
- **Scalability:** Matching quality should improve with accumulated historical mappings.
- **Auditability:** All inventory additions remain ledger-backed and source-attributed.

---

## 13. Success Criteria (Initial)
- Significant reduction in manual line-by-line entry for bulk purchases
- High user completion rate for receipt workflows
- Improved item-cost freshness from receipt-derived updates
- Increasing auto-match rate over time due to learned aliases/mappings

---

## 14. Risks & Reality Constraints
- Receipt parsing will not reach 100% accuracy.
- Supplier formatting variance will cause extraction noise.
- Product abbreviations and ambiguous units require robust UX for correction.

**Mitigation Strategy:**
- Confidence-driven routing
- Fast inline edits
- Alias expansion and learning loop

---

## 15. MVP Scope Recommendation
### In Scope
- Receipt upload/capture
- OCR text extraction
- Line-item parsing
- Fuzzy matching with confidence tiers
- Bulk confirmation UI
- Ledger write for confirmed lines
- Alias persistence for corrected mappings

### Out of Scope (Initial)
- Fully autonomous no-review posting
- Advanced invoice tax reconciliation
- Cross-supplier catalog standardization pipeline
