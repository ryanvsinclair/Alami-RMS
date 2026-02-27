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

export type ReceiptParserProvinceHint = "ON" | "QC";
export type ReceiptParserSkuPositionHint = "prefix" | "suffix";

export interface ParseReceiptTextOptions {
  provinceHint?: ReceiptParserProvinceHint | null;
  skuPositionHint?: ReceiptParserSkuPositionHint | null;
}

type ReceiptLineSection =
  | "item"
  | "tax"
  | "subtotal"
  | "total"
  | "payment"
  | "meta"
  | "promo"
  | "separator";

type ParsedItemCandidateLine = {
  parsed: Omit<ParsedLineItem, "line_number">;
  hasPrice: boolean;
  removedSkuPrefix: boolean;
  removedSkuSuffix: boolean;
  explicitQuantityDetected: boolean;
};

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

const SUBTOTAL_LABEL_PATTERN = /^(?:(?:sub|sous)[\s-]*total)\b/i;
const TOTAL_LABEL_PATTERN =
  /^(?:(?:grand[\s-]*)?total(?:\s+(?:due|du|amount|a\s+payer))?|amount\s+due|balance\s+due|montant\s+(?:total|du))\b/i;
const TAX_GENERIC_LABEL_PATTERN = /^(?:(?:sales\s+)?tax(?:e)?|taxes)\b/i;
const TAX_HST_LABEL_PATTERN = /\bH\.?\s*S\.?\s*T\b/i;
const TAX_GST_LABEL_PATTERN = /\bG\.?\s*S\.?\s*T\b/i;
const TAX_QST_LABEL_PATTERN = /\bQ\.?\s*S\.?\s*T\b/i;
const TAX_TPS_LABEL_PATTERN = /\bT\.?\s*P\.?\s*S\b/i;
const TAX_TVQ_LABEL_PATTERN = /\bT\.?\s*V\.?\s*Q\b/i;
const TAX_PERCENT_RATE_PATTERN = /\b(\d{1,2}(?:[.,]\d{1,3})?)\s*%/;
const PAYMENT_LINE_PATTERN =
  /^(?:change|cash|credit|debit|visa|master|amex|interac|approved|auth(?:orization)?|tender|txn|trace)\b/i;
const META_LINE_PATTERN =
  /^(?:thank\s*you|tel\b|phone\b|fax\b|www\.|.*(?:\.com|\.ca)\b|store\b|branch\b|location\b|\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{1,2}:\d{2}|#\d+)\b/i;
const PROMO_LINE_PATTERN = /^(?:coupon|discount|savings|member|promo(?:tion)?)\b/i;
const SEPARATOR_PATTERN = /^(?:\*+|-+|=+)$/;

const QTY_CLUSTER_PATTERN = /\b(\d+(?:\.\d+)?)\s*[xX@]\s*(\d+(?:[.,]\d{1,2})?)\b/;
const QTY_PREFIX_PATTERN = /^(\d+(?:\.\d+)?)\s*[xX@]\s*/;
const QTY_LEADING_PATTERN = /^(\d+(?:\.\d+)?)\s+/;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTrailingNumericToken(rawToken: string): string | null {
  if (!rawToken) return null;

  const compactSpaces = rawToken
    .replace(/\$/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!compactSpaces) return null;

  if (/^-?\d+\s+\d{2}$/.test(compactSpaces)) {
    // Keep split tokens as integer-like ambiguity (e.g. "6 99" -> 699).
    // Correction core decides whether decimal re-interpretation is safe.
    return compactSpaces.replace(/\s+/g, "");
  }

  let compact = compactSpaces.replace(/\s+/g, "");
  if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(compact)) {
    compact = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(compact)) {
    compact = compact.replace(/,/g, "");
  } else if (/^-?\d+,\d{1,2}$/.test(compact)) {
    compact = compact.replace(",", ".");
  } else {
    compact = compact.replace(/,(?=\d{3}(?:\D|$))/g, "");
  }

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(compact)) return null;
  return compact;
}

function parseTrailingAmount(text: string): { amount: number | null; remaining: string } {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact) {
    return { amount: null, remaining: text.trim() };
  }

  const tokens = compact.split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return { amount: null, remaining: text.trim() };
  }

  let consumedTokenCount = 1;
  let candidateToken = tokens[tokens.length - 1] ?? "";
  if (/^\d{2}$/.test(candidateToken) && tokens.length >= 2) {
    const previousToken = tokens[tokens.length - 2] ?? "";
    if (/^-?\d+$/.test(previousToken)) {
      candidateToken = `${previousToken} ${candidateToken}`;
      consumedTokenCount = 2;
    }
  }

  const normalizedToken = normalizeTrailingNumericToken(candidateToken);
  if (!normalizedToken) {
    return { amount: null, remaining: text.trim() };
  }

  const numeric = Number.parseFloat(normalizedToken);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 2000) {
    return { amount: null, remaining: text.trim() };
  }

  return {
    amount: roundCurrency(numeric),
    remaining: tokens.slice(0, tokens.length - consumedTokenCount).join(" ").trim(),
  };
}

function cleanParsedName(text: string): string | null {
  const cleaned = text
    .replace(/[^a-zA-Z0-9\s\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isSkuToken(token: string, allowShortPluLikeToken: boolean): boolean {
  if (allowShortPluLikeToken) {
    return /^\d{4,8}$/.test(token);
  }
  // Avoid stripping likely PLU codes (4/5-digit) unless a store-profile hint explicitly prefers it.
  return /^\d{6,8}$/.test(token);
}

function removeSkuToken(
  rawText: string,
  skuPositionHint: ReceiptParserSkuPositionHint | null,
): { text: string; removedPrefix: boolean; removedSuffix: boolean } {
  const tokens = rawText.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { text: rawText.trim(), removedPrefix: false, removedSuffix: false };
  }

  const allowShortPluLikeToken = skuPositionHint != null;
  const firstToken = tokens[0] ?? "";
  const lastToken = tokens[tokens.length - 1] ?? "";
  const bodyText = tokens.slice(1).join(" ");
  const headText = tokens.slice(0, -1).join(" ");

  const canRemovePrefix =
    isSkuToken(firstToken, allowShortPluLikeToken) && /[a-zA-Z]/.test(bodyText);
  const canRemoveSuffix =
    isSkuToken(lastToken, allowShortPluLikeToken) && /[a-zA-Z]/.test(headText);

  let removePrefix = false;
  let removeSuffix = false;

  if (skuPositionHint === "prefix" && canRemovePrefix) {
    removePrefix = true;
  } else if (skuPositionHint === "suffix" && canRemoveSuffix) {
    removeSuffix = true;
  } else if (canRemovePrefix && !canRemoveSuffix) {
    removePrefix = true;
  } else if (!canRemovePrefix && canRemoveSuffix) {
    removeSuffix = true;
  } else if (canRemovePrefix && canRemoveSuffix) {
    removePrefix = true;
  }

  if (removePrefix) {
    return {
      text: tokens.slice(1).join(" ").trim(),
      removedPrefix: true,
      removedSuffix: false,
    };
  }

  if (removeSuffix) {
    return {
      text: tokens.slice(0, -1).join(" ").trim(),
      removedPrefix: false,
      removedSuffix: true,
    };
  }

  return { text: rawText.trim(), removedPrefix: false, removedSuffix: false };
}

function detectTaxLabelFromLine(
  text: string,
  provinceHint: ReceiptParserProvinceHint | null | undefined,
): "HST" | "GST" | "QST" | "TPS" | "TVQ" | "Tax" | null {
  if (TAX_HST_LABEL_PATTERN.test(text)) return "HST";
  if (TAX_QST_LABEL_PATTERN.test(text)) return "QST";
  if (TAX_TVQ_LABEL_PATTERN.test(text)) return "TVQ";
  if (TAX_GST_LABEL_PATTERN.test(text)) return "GST";
  if (TAX_TPS_LABEL_PATTERN.test(text)) return "TPS";

  if (!TAX_GENERIC_LABEL_PATTERN.test(text)) return null;

  const rateMatch = text.match(TAX_PERCENT_RATE_PATTERN);
  if (!rateMatch) return "Tax";

  const parsedRate = Number.parseFloat((rateMatch[1] ?? "").replace(",", "."));
  if (!Number.isFinite(parsedRate)) return "Tax";

  if (provinceHint === "ON" && Math.abs(parsedRate - 13) <= 0.3) {
    return "HST";
  }
  if (provinceHint === "QC") {
    if (Math.abs(parsedRate - 5) <= 0.3) return "TPS";
    if (Math.abs(parsedRate - 9.975) <= 0.3 || Math.abs(parsedRate - 9.98) <= 0.3) {
      return "TVQ";
    }
  }
  return "Tax";
}

function classifyReceiptLine(
  rawLine: string,
  options: ParseReceiptTextOptions,
): ReceiptLineSection {
  const normalized = rawLine.replace(/\s+/g, " ").trim();
  if (!normalized) return "meta";
  if (SEPARATOR_PATTERN.test(normalized)) return "separator";
  if (SUBTOTAL_LABEL_PATTERN.test(normalized)) return "subtotal";
  if (TOTAL_LABEL_PATTERN.test(normalized)) return "total";
  if (detectTaxLabelFromLine(normalized, options.provinceHint)) return "tax";
  if (PROMO_LINE_PATTERN.test(normalized)) return "promo";
  if (PAYMENT_LINE_PATTERN.test(normalized)) return "payment";
  if (META_LINE_PATTERN.test(normalized)) return "meta";
  if (/^\d+$/.test(normalized)) return "meta";
  if (normalized.length < 3) return "meta";
  return "item";
}

/**
 * Parse a single item-candidate line into structured data.
 */
function parseItemCandidateLine(
  rawText: string,
  options: ParseReceiptTextOptions,
): ParsedItemCandidateLine {
  let text = rawText.trim();
  let quantity: number | null = null;
  let unit: UnitType | null = null;
  let lineCost: number | null = null;
  let unitCost: number | null = null;
  let explicitQuantityDetected = false;
  let removedSkuPrefix = false;
  let removedSkuSuffix = false;

  const trailingAmount = parseTrailingAmount(text);
  if (trailingAmount.amount != null) {
    lineCost = trailingAmount.amount;
    text = trailingAmount.remaining;
  }

  // Handle quantity + unit-price clusters found in many structured OCR lines:
  // e.g. "2 x 3.49 6.98" or "2 @ 3.49 6.98"
  const quantityClusterMatch = text.match(QTY_CLUSTER_PATTERN);
  if (quantityClusterMatch) {
    const clusterQuantity = Number.parseFloat(quantityClusterMatch[1] ?? "");
    const clusterUnitCost = Number.parseFloat((quantityClusterMatch[2] ?? "").replace(",", "."));
    if (Number.isFinite(clusterQuantity) && clusterQuantity > 0) {
      quantity = clusterQuantity;
      explicitQuantityDetected = true;
      unit = "each";
    }
    if (Number.isFinite(clusterUnitCost) && clusterUnitCost > 0) {
      unitCost = roundCurrency(clusterUnitCost);
    }
    text = text.replace(QTY_CLUSTER_PATTERN, " ").trim();
  }

  // Extract quantity prefix (e.g., "2 x Chicken Breast")
  const qtyPrefixMatch = text.match(QTY_PREFIX_PATTERN);
  if (qtyPrefixMatch) {
    const parsedQty = Number.parseFloat(qtyPrefixMatch[1] ?? "");
    if (Number.isFinite(parsedQty) && parsedQty > 0) {
      quantity = parsedQty;
      explicitQuantityDetected = true;
      unit = "each";
    }
    text = text.replace(QTY_PREFIX_PATTERN, "").trim();
  }

  // Extract unit + quantity from body (e.g., "2kg", "500ml")
  for (const { pattern, unit: u } of UNIT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const parsedQty = Number.parseFloat(match[1] ?? "");
      if (Number.isFinite(parsedQty) && parsedQty > 0) {
        quantity = parsedQty;
        explicitQuantityDetected = true;
      }
      unit = u;
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  // If still no quantity, try leading number
  if (quantity === null) {
    const leadingMatch = text.match(QTY_LEADING_PATTERN);
    if (leadingMatch) {
      const num = Number.parseFloat(leadingMatch[1] ?? "");
      // Only treat as quantity if reasonable (1-999)
      if (Number.isFinite(num) && num >= 1 && num <= 999) {
        quantity = num;
        unit = "each";
        explicitQuantityDetected = true;
        text = text.replace(QTY_LEADING_PATTERN, "").trim();
      }
    }
  }

  const skuRemoval = removeSkuToken(text, options.skuPositionHint ?? null);
  text = skuRemoval.text;
  removedSkuPrefix = skuRemoval.removedPrefix;
  removedSkuSuffix = skuRemoval.removedSuffix;

  if (lineCost == null && quantity != null && unitCost != null) {
    lineCost = roundCurrency(quantity * unitCost);
  }

  if (quantity != null && unit == null) {
    unit = "each";
  }

  // Compute unit cost if we have both values available.
  if (lineCost !== null && quantity !== null && quantity > 0) {
    unitCost = roundCurrency(lineCost / quantity);
  }

  const parsedName = cleanParsedName(text);

  return {
    parsed: {
      raw_text: rawText.trim(),
      parsed_name: parsedName,
      quantity: quantity ?? 1,
      unit: unit ?? "each",
      line_cost: lineCost,
      unit_cost: unitCost,
    },
    hasPrice: lineCost != null,
    removedSkuPrefix,
    removedSkuSuffix,
    explicitQuantityDetected,
  };
}

function hasStrongItemSignalWithoutPrice(
  parsedLine: ParsedItemCandidateLine,
  rawLine: string,
): boolean {
  if (parsedLine.hasPrice) return true;
  if (!/[a-zA-Z]/.test(rawLine)) return false;
  if (/\d/.test(rawLine)) return true;
  if (parsedLine.explicitQuantityDetected) return true;
  if (parsedLine.removedSkuPrefix || parsedLine.removedSkuSuffix) return true;
  if (parsedLine.parsed.unit != null && parsedLine.parsed.unit !== "each") return true;
  if (/\b(?:kg|g|lb|oz|ml|l|pk|pack|box|cs|case|dz|dozen|bag)\b/i.test(rawLine)) return true;
  return false;
}

function isLikelyMultilineDescriptionFragment(rawLine: string): boolean {
  if (!/[a-zA-Z]/.test(rawLine)) return false;
  if (/\d/.test(rawLine)) return false;
  const tokens = rawLine.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 8) return false;
  return true;
}

/**
 * Parse raw OCR text from a receipt into structured line items.
 * Uses a hybrid pass:
 * - section classification (items vs tax/summary/footer lines)
 * - numeric-cluster parsing (qty x unit-price + trailing totals)
 * - two-line merge for wrapped item descriptions
 * - optional store-profile hints (province + sku-token position)
 */
export function parseReceiptText(
  rawText: string,
  options: ParseReceiptTextOptions = {},
): ParsedLineItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ParsedLineItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const section = classifyReceiptLine(line, options);
    if (section !== "item") {
      continue;
    }

    const parsedCurrent = parseItemCandidateLine(line, options);
    let selected = parsedCurrent;
    let consumedNextLine = false;

    if (!parsedCurrent.hasPrice) {
      const nextLine = lines[i + 1];
      if (nextLine) {
        const nextSection = classifyReceiptLine(nextLine, options);
        if (nextSection === "item" && isLikelyMultilineDescriptionFragment(line)) {
          const parsedNext = parseItemCandidateLine(nextLine, options);
          if (parsedNext.hasPrice) {
            const merged = parseItemCandidateLine(`${line} ${nextLine}`, options);
            if (merged.hasPrice && merged.parsed.parsed_name) {
              selected = merged;
              consumedNextLine = true;
            }
          }
        }
      }

      if (!selected.hasPrice && !hasStrongItemSignalWithoutPrice(selected, line)) {
        continue;
      }
    }

    if (!selected.parsed.parsed_name && selected.parsed.line_cost == null) {
      continue;
    }

    items.push({
      ...selected.parsed,
      line_number: items.length + 1,
    });

    if (consumedNextLine) {
      i += 1;
    }
  }

  return items;
}
