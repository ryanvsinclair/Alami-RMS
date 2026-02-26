const BARCODE_SEPARATOR_RE = /[\s-]+/g;
const GTIN_DIGITS_RE = /^\d+$/;

export function normalizeBarcode(value: string): string {
  return value.trim().replace(BARCODE_SEPARATOR_RE, "");
}

export function isSupportedGtinLength(value: string): boolean {
  return value.length === 8 || value.length === 12 || value.length === 13 || value.length === 14;
}

export function hasValidGtinCheckDigit(value: string): boolean | null {
  if (!GTIN_DIGITS_RE.test(value) || !isSupportedGtinLength(value)) {
    return null;
  }

  const digits = value.split("").map(Number);
  const checkDigit = digits.pop();
  if (checkDigit == null) {
    return null;
  }

  let sum = 0;
  for (let i = digits.length - 1, offset = 0; i >= 0; i--, offset++) {
    sum += digits[i] * (offset % 2 === 0 ? 3 : 1);
  }

  const expected = (10 - (sum % 10)) % 10;
  return checkDigit === expected;
}

