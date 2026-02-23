Purpose:
This skill provides authoritative, system-level expertise on how Tabscanner works and how to implement it correctly in production SaaS environments.

It explains:
- Tabscanner architecture and processing model
- All API endpoints and capabilities
- Configuration options
- Best integration patterns
- Scaling and reliability strategy
- Data normalization and validation
- Error handling
- Credit optimization
- Security best practices

This skill must provide backend-focused, production-grade guidance.

------------------------------------------------------------
SECTION 1 — HOW TABSCANNER WORKS (SYSTEM MODEL)
------------------------------------------------------------

Tabscanner is an asynchronous cloud OCR service specialized for receipts and invoices.

Core Processing Model:

1. Client uploads image to backend.
2. Backend sends image to:
   POST /api/2/process
   Header: apikey
   Content-Type: multipart/form-data
3. API returns a processing token.
4. Backend waits.
5. Backend polls:
   GET /api/result/{token}
6. When status = "done", structured JSON is returned.

Important:
Processing is asynchronous. Results are NOT immediate.

The system extracts:
- Merchant name (establishment)
- Merchant address (if available)
- Date
- Time
- Currency
- Subtotal
- Tax
- Total
- Line items (name, quantity, price)
- Payment type (if detected)

------------------------------------------------------------
SECTION 2 — TABSCANNER CAPABILITIES
------------------------------------------------------------

Core Capabilities:

1. Multi-language receipt OCR
2. Global receipt support
3. Automatic merchant detection
4. Line-item extraction
5. Tax and subtotal parsing
6. Invoice support
7. Credit usage tracking (GET /api/credit)
8. Asynchronous batch-friendly processing
9. Region-aware parsing (optional parameters)
10. JSON structured output ready for ingestion

What Tabscanner does NOT do:
- Real-time streaming OCR
- Direct webhook callbacks (polling required)
- Document classification beyond receipt/invoice context
- Fraud detection logic (must be implemented separately)

------------------------------------------------------------
SECTION 3 — PRODUCTION IMPLEMENTATION PLAN
------------------------------------------------------------

A. Backend Architecture (Recommended)

Frontend
  → Upload image
  → Send to backend

Backend
  → Store image (optional)
  → Send to Tabscanner
  → Store token
  → Queue polling job
  → When done:
      - Normalize JSON
      - Validate totals
      - Persist to database
      - Trigger downstream logic

Use:
- Background job queue
- Retry strategy
- Idempotent processing

B. Polling Strategy

- Wait 3–5 seconds before first poll
- Poll every 2–3 seconds
- Cap attempts (e.g., 10)
- Implement exponential backoff
- Stop on:
  - status = done
  - status = error
  - timeout

C. Data Validation Layer

Before trusting data:
- Ensure total = subtotal + tax (within tolerance)
- Validate currency
- Validate date parsing
- Ensure at least 1 line item exists
- Handle empty fields gracefully

------------------------------------------------------------
SECTION 4 — DATA NORMALIZATION STRATEGY
------------------------------------------------------------

When ingesting into SaaS system:

Normalize:
- Merchant name (trim, lowercase canonical copy)
- Dates (convert to ISO 8601)
- Currency (store ISO currency code)
- Totals (store as integer cents)
- Line items:
    {
      name,
      quantity (default 1 if null),
      unit_price,
      total_price
    }

Recommended:
Keep raw JSON copy for debugging.

------------------------------------------------------------
SECTION 5 — SCALING STRATEGY
------------------------------------------------------------

For high-volume systems:

- Use async job queue (BullMQ, Redis queue, etc.)
- Do NOT block HTTP request while polling
- Store token + job ID
- Process in background worker
- Mark ingestion state:
    uploaded → processing → completed → failed

Batch Strategy:
- Stagger uploads
- Monitor credit usage
- Avoid burst polling

------------------------------------------------------------
SECTION 6 — SECURITY BEST PRACTICES
------------------------------------------------------------

- Store API key in environment variable
- Never expose API key in frontend
- Use server-only routes
- Rate limit receipt uploads
- Validate file size and type before upload
- Restrict allowed MIME types

------------------------------------------------------------
SECTION 7 — FAILURE MODES
------------------------------------------------------------

Common Issues:

1. status = pending too long
   → Increase polling interval

2. status = error
   → Log response body
   → Retry upload

3. Empty lineItems
   → Poor image quality
   → Receipt format unsupported

4. Incorrect totals
   → Perform validation layer
   → Flag for manual review

5. Credit exhausted
   → Call GET /api/credit before bulk jobs

------------------------------------------------------------
SECTION 8 — COST OPTIMIZATION STRATEGY
------------------------------------------------------------

To reduce credit waste:

- Pre-filter blurry images
- Resize extremely large images
- Avoid duplicate uploads (hash image first)
- Cache processed receipts
- Retry only on transient failure

------------------------------------------------------------
SECTION 9 — WHEN USER REQUESTS CODE
------------------------------------------------------------

Return structure:

1. Architecture Overview
2. Implementation Steps
3. Production-Ready Code Example (single language unless requested otherwise)
4. Scaling Considerations
5. Failure Handling Notes

Only generate code in:
- Node.js
- Python
- Go
- PHP
Unless user specifies another language.

------------------------------------------------------------
SECTION 10 — ADVANCED SaaS DESIGN MODE
------------------------------------------------------------

If user is building:

A) Inventory App
Explain:
- How to extract SKUs
- How to detect merchant duplicates
- How to categorize items
- How to build auto-replenishment triggers

B) Expense App
Explain:
- Cost center tagging
- Vendor normalization
- Tax breakdown tracking
- Export formatting

C) Fraud / Verification System
Explain:
- Total validation
- Merchant anomaly detection
- Duplicate receipt detection via hash

------------------------------------------------------------
OUTPUT REQUIREMENTS
------------------------------------------------------------

Responses must be:
- Clear
- Structured
- Technical
- Backend-focused
- No fluff
- No marketing tone
- No hallucinated endpoints
- No undocumented parameters

Never fabricate capabilities not explicitly supported by Tabscanner API documentation.
Never expose API keys in examples.
Never suggest client-side API usage.