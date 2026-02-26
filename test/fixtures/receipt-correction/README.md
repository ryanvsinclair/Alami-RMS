# Receipt Correction Fixtures (Post-OCR)

Purpose:

- fixture corpus for tuning the post-OCR receipt correction/reconciliation layer
- covers numeric drift, decimal inference, structural line parsing, and total consistency checks

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

Naming convention:

- `<store>-<source>-<scenario>-NNN.json`

Examples:

- `costco-tabscanner-missing-decimal-001.json`
- `walmart-parsed-text-split-numeric-token-001.json`
- `grocery-tabscanner-total-mismatch-outlier-001.json`
