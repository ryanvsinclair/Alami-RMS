# Receipt Correction Fixtures (Post-OCR)

Purpose:

- fixture corpus for tuning the post-OCR receipt correction/reconciliation layer
- covers numeric drift, decimal inference, structural line parsing, total consistency checks, and tax interpretation/validation scenarios

Status:

- Phase 0 scaffold (seed fixtures only)
- expand to 10-20+ fixtures before threshold tuning work begins

Recommended fixture contents:

- `source` (`tabscanner` or `parsed_text`)
- store identity (`store_name`, `google_place_id` if available)
- raw parser input:
  - TabScanner structured result OR raw OCR text
- expected corrected lines
- expected totals consistency outcome
- notes describing the OCR/parsing failure mode being tested

Optional machine-checkable assertions (recommended for active tuning):

- `expected.assertions.totals_status`
- `expected.assertions.totals_delta_to_total`
- `expected.assertions.changed_line_numbers`
- `expected.assertions.outlier_line_numbers`
- `expected.assertions.expected_line_costs[]` (`line_number`, `line_cost`)
- `expected.assertions.required_parse_flags[]` (`line_number`, `flags[]`)
- `expected.assertions.tax_interpretation` (planned schema for ON/QC province/tax-structure expectations)

Fixture harness notes:

- TabScanner fixtures are normalized into parser-like line items using the same qty/unit-cost mapping used by the workflow service.
- Parsed-text fixtures are run through `parseReceiptText(...)` first, then the correction core.
- Parsed-text fixture totals (for totals checks) are inferred from labeled lines (`Subtotal`, `Tax`, `Total`) in the raw text when present.

Tax-focused fixture scenarios to add/maintain:

- Ontario receipts with `HST` / `H.S.T.` / `Tax 13%`
- Quebec receipts with `GST+QST` and French labels (`TPS` + `TVQ`)
- zero-rated grocery receipts (`subtotal == total`, no tax line)
- mixed taxable + zero-rated baskets
- incomplete/incorrect tax structures (for mismatch detection)

Naming convention:

- `<store>-<source>-<scenario>-NNN.json`

Examples:

- `costco-tabscanner-missing-decimal-001.json`
- `walmart-parsed-text-split-numeric-token-001.json`
- `grocery-tabscanner-total-mismatch-outlier-001.json`
