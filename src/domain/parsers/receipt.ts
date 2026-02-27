import type { UnitType } from "@/lib/generated/prisma/client";

// ============================================================
// Receipt line item parser
// Converts raw OCR text into structured line items
// ============================================================

export interface ParsedLineItem {
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | null;
  unit: UnitType | null;
  line_cost: number | null;
  unit_cost: number | null;
  plu_code?: number | null;
  produce_match?: ParsedLineProduceMatch | null;
  organic_flag?: boolean | null;
}

export interface ParsedLineProduceMatch {
  display_name: string;
  commodity: string;
  variety: string | null;
  language_code: string;
  match_method: "plu" | "name_fuzzy";
}

// Common unit patterns found on receipts
const UNIT_PATTERNS: { pattern: RegExp; unit: UnitType }[] = [
  { pattern: /\b(\d+(?:\.\d+)?)\s*kg\b/i, unit: "kg" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*g\b/i, unit: "g" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*lb[s]?\b/i, unit: "lb" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*oz\b/i, unit: "oz" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*[lL]\b/, unit: "l" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*ml\b/i, unit: "ml" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*gal\b/i, unit: "gal" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*(?:pk|pack)[s]?\b/i, unit: "pack" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*(?:bx|box)\b/i, unit: "box" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*(?:cs|case)[s]?\b/i, unit: "case_unit" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*(?:dz|dozen)\b/i, unit: "dozen" },
  { pattern: /\b(\d+(?:\.\d+)?)\s*(?:bag)[s]?\b/i, unit: "bag" },
];

// Price pattern: $12.99 or 12.99 at end of line
const PRICE_PATTERN = /\$?\s*(\d+\.\d{2})\s*$/;
// Quantity at start: "2 x" or "2x" or just leading number
const QTY_PREFIX_PATTERN = /^(\d+)\s*[xX@]\s*/;
const QTY_LEADING_PATTERN = /^(\d+)\s+/;

/**
 * Parse a single receipt line into structured data.
 */
function parseReceiptLine(rawText: string, lineNumber: number): ParsedLineItem {
  let text = rawText.trim();
  let quantity: number | null = null;
  let unit: UnitType | null = null;
  let lineCost: number | null = null;
  let unitCost: number | null = null;

  // Extract price (usually at end of line)
  const priceMatch = text.match(PRICE_PATTERN);
  if (priceMatch) {
    lineCost = parseFloat(priceMatch[1]);
    text = text.replace(PRICE_PATTERN, "").trim();
  }

  // Extract quantity prefix (e.g., "2 x Chicken Breast")
  const qtyPrefixMatch = text.match(QTY_PREFIX_PATTERN);
  if (qtyPrefixMatch) {
    quantity = parseInt(qtyPrefixMatch[1], 10);
    text = text.replace(QTY_PREFIX_PATTERN, "").trim();
  }

  // Extract unit + quantity from body (e.g., "2kg", "500ml")
  for (const { pattern, unit: u } of UNIT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      quantity = parseFloat(match[1]);
      unit = u;
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  // If still no quantity, try leading number
  if (quantity === null) {
    const leadingMatch = text.match(QTY_LEADING_PATTERN);
    if (leadingMatch) {
      const num = parseInt(leadingMatch[1], 10);
      // Only treat as quantity if reasonable (1-999)
      if (num >= 1 && num <= 999) {
        quantity = num;
        unit = "each";
        text = text.replace(QTY_LEADING_PATTERN, "").trim();
      }
    }
  }

  // Compute unit cost if we have both
  if (lineCost !== null && quantity !== null && quantity > 0) {
    unitCost = Math.round((lineCost / quantity) * 100) / 100;
  }

  // Clean up parsed name
  const parsedName = text
    .replace(/[^a-zA-Z0-9\s\-\/]/g, "")
    .replace(/\s+/g, " ")
    .trim() || null;

  return {
    line_number: lineNumber,
    raw_text: rawText.trim(),
    parsed_name: parsedName,
    quantity: quantity ?? 1, // default to 1 if not detected
    unit: unit ?? "each",
    line_cost: lineCost,
    unit_cost: unitCost,
  };
}

/**
 * Parse raw OCR text from a receipt into structured line items.
 * Filters out header/footer noise (store name, tax lines, totals, etc.)
 */
export function parseReceiptText(rawText: string): ParsedLineItem[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Filter out non-item lines
  const SKIP_PATTERNS = [
    /^(?:sub\s*total|subtotal|grand\s*total|total)\b/i,
    /^(?:sales\s+)?tax\b/i,
    /^(?:g\.?\s*s\.?\s*t|h\.?\s*s\.?\s*t|p\.?\s*s\.?\s*t|q\.?\s*s\.?\s*t|t\.?\s*p\.?\s*s|t\.?\s*v\.?\s*q)\b/i,
    /^change\b/i,
    /^cash/i,
    /^credit|debit|visa|master/i,
    /^thank\s*you/i,
    /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/, // dates
    /^\d{1,2}:\d{2}/, // times
    /^tel|phone|fax/i,
    /^www\.|\.com|\.ca/i,
    /^#\d+/, // receipt/transaction numbers
    /^\*+$/, // decorative lines
    /^-+$/, // separators
    /^=+$/, // separators
    /^store|branch|location/i,
    /^coupon\b/i,
    /^discount\b/i,
    /^savings/i,
    /^member/i,
    /^balance/i,
  ];

  const items: ParsedLineItem[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    // Skip noise
    if (SKIP_PATTERNS.some((p) => p.test(line))) continue;
    // Skip very short lines (likely noise)
    if (line.length < 3) continue;
    // Skip lines that are only numbers (receipt IDs, etc.)
    if (/^\d+$/.test(line)) continue;

    lineNumber++;
    items.push(parseReceiptLine(line, lineNumber));
  }

  return items;
}
