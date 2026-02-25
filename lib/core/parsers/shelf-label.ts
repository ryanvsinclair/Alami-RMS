// ============================================================
// Shelf price label parser
// Extracts product name, quantity, unit price, and size from
// OCR text read off in-store shelf price tags.
// ============================================================

export interface ShelfLabelResult {
  raw_text: string;
  product_name: string | null;
  quantity: number;
  unit_price: number | null;
  size_descriptor: string | null;
}

// Price at end of text: $11.09 or 11.09
const PRICE_PATTERN = /\$?\s*(\d+\.\d{2})\s*$/;
// Price anywhere (fallback)
const PRICE_ANYWHERE = /\$\s*(\d+\.\d{2})/;
// Quantity multiplier: *1, x2, X3, @1
const QTY_PATTERN = /[*xX@]\s*(\d+)/;
// Size descriptor: 70CL, 2KG, 500ML, 1.5L, etc.
const SIZE_PATTERN = /\b(\d+(?:\.\d+)?\s*(?:cl|ml|l|kg|g|lb|oz|gal|fl\.?\s*oz))\b/i;
// Barcode pattern (strip these)
const BARCODE_PATTERN = /\b\d{8,14}\b/g;

export function parseShelfLabel(rawText: string): ShelfLabelResult {
  let text = rawText.trim();

  // Strip barcodes
  text = text.replace(BARCODE_PATTERN, " ").trim();

  // Extract price (prefer end-of-text, fallback to anywhere)
  let unit_price: number | null = null;
  const priceEndMatch = text.match(PRICE_PATTERN);
  if (priceEndMatch) {
    unit_price = parseFloat(priceEndMatch[1]);
    text = text.replace(PRICE_PATTERN, "").trim();
  } else {
    const priceAnyMatch = text.match(PRICE_ANYWHERE);
    if (priceAnyMatch) {
      unit_price = parseFloat(priceAnyMatch[1]);
      text = text.replace(PRICE_ANYWHERE, "").trim();
    }
  }

  // Extract quantity multiplier
  const qtyMatch = text.match(QTY_PATTERN);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  if (qtyMatch) text = text.replace(QTY_PATTERN, "").trim();

  // Extract size descriptor
  const sizeMatch = text.match(SIZE_PATTERN);
  const size_descriptor = sizeMatch ? sizeMatch[1].toUpperCase() : null;

  // Clean product name: strip size, clean punctuation, normalize whitespace
  const product_name =
    text
      .replace(SIZE_PATTERN, "")
      .replace(/[^a-zA-Z0-9\s\-']/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null;

  return {
    raw_text: rawText.trim(),
    product_name,
    quantity,
    unit_price,
    size_descriptor,
  };
}
