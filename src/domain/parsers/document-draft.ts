export interface ParsedLineItem {
  description: string;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number | null;
}

export interface ParsedDocumentFields {
  vendor_name: string | null;
  date: string | null;
  total: number | null;
  tax: number | null;
  line_items: ParsedLineItem[];
}

export interface PostmarkPayloadLike {
  TextBody?: string | null;
  HtmlBody?: string | null;
  Date?: string | null;
  FromFull?: {
    Name?: string | null;
    Email?: string | null;
  } | null;
}

export interface ParseHints {
  vendorNameSeed?: string;
  dateSeed?: string;
}

export interface DocumentConfidenceResult {
  score: number;
  band: "high" | "medium" | "low" | "none";
  flags: string[];
}

export const REQUIRED_DOCUMENT_FIELDS = ["vendor_name", "date", "total"] as const;

const TOTAL_KEYWORDS = [
  "total",
  "amount due",
  "balance due",
  "grand total",
  "invoice total",
];
const TAX_KEYWORDS = ["tax", "hst", "gst", "pst", "tvq", "tps", "vat"];

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function parseNumber(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateCandidate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatIsoDate(parsed);
}

function decodeHtmlEntities(input: string) {
  const base = input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return base.replace(/&#(\d+);/g, (_, code) => {
    const numeric = Number.parseInt(code, 10);
    if (!Number.isFinite(numeric)) return "";
    return String.fromCharCode(numeric);
  });
}

function sanitizeDescription(line: string) {
  return normalizeWhitespace(
    line
      .replace(/[$]?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, " ")
      .replace(/\bqty\b[:\s]*/gi, " ")
      .replace(/\bx\b/gi, " ")
      .replace(/[|]/g, " "),
  );
}

function extractAmounts(line: string) {
  const amountMatches = line.match(/[$]?\d{1,3}(?:,\d{3})*(?:\.\d{2})|[$]?\d+(?:\.\d{2})/g) ?? [];
  return amountMatches
    .map((match) => parseNumber(match))
    .filter((value): value is number => value !== null);
}

function inferVendorNameFromText(lines: string[]) {
  for (const line of lines) {
    const labelMatch = line.match(/^\s*(vendor|bill\s*from|from)\s*[:\-]\s*(.+)$/i);
    if (labelMatch?.[2]) {
      return normalizeWhitespace(labelMatch[2]);
    }
  }

  for (const line of lines) {
    const normalized = normalizeWhitespace(line);
    if (!/[a-z]/i.test(normalized)) continue;
    if (/(invoice|statement|receipt|date|total|amount due)/i.test(normalized)) continue;
    if (normalized.length < 3 || normalized.length > 80) continue;
    return normalized;
  }

  return null;
}

function inferDateFromText(lines: string[]) {
  const monthPattern =
    /\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2},?\s+20\d{2}\b/i;
  const isoPattern = /\b20\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])\b/;
  const slashPattern = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/;

  for (const line of lines) {
    const isoMatch = line.match(isoPattern);
    if (isoMatch) {
      const value = isoMatch[0].replace(/\//g, "-");
      const parsed = parseDateCandidate(value);
      if (parsed) return parsed;
    }

    const monthMatch = line.match(monthPattern);
    if (monthMatch) {
      const parsed = parseDateCandidate(monthMatch[0]);
      if (parsed) return parsed;
    }

    const slashMatch = line.match(slashPattern);
    if (slashMatch) {
      const first = Number.parseInt(slashMatch[1], 10);
      const second = Number.parseInt(slashMatch[2], 10);
      const year = Number.parseInt(slashMatch[3], 10);
      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      const parsed = parseDateCandidate(`${year}-${month}-${day}`);
      if (parsed) return parsed;
    }
  }

  return null;
}

function inferAmountByKeywords(lines: string[], keywords: string[]) {
  let candidate: number | null = null;
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (!keywords.some((keyword) => normalized.includes(keyword))) continue;
    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;
    candidate = amounts[amounts.length - 1] ?? candidate;
  }
  return candidate;
}

function inferLineItems(lines: string[]): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  for (const line of lines) {
    if (!/[a-z]/i.test(line)) continue;
    if (/(subtotal|tax|total|amount due|balance due|invoice total|grand total)/i.test(line)) {
      continue;
    }

    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    const description = sanitizeDescription(line);
    if (!description) continue;

    const quantityMatch = line.match(/\b(?:qty[:\s]*)?(\d+(?:\.\d+)?)\b/i);
    const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : null;
    const lineTotal = amounts[amounts.length - 1] ?? null;
    let unitCost: number | null = null;
    if (amounts.length >= 2) {
      unitCost = amounts[amounts.length - 2] ?? null;
    } else if (quantity != null && quantity > 0 && lineTotal != null) {
      unitCost = lineTotal / quantity;
    }

    items.push({
      description,
      quantity,
      unit_cost: unitCost,
      line_total: lineTotal,
    });
  }

  return items;
}

function domainFromEmail(email: string | null | undefined) {
  if (!email) return null;
  const atIndex = email.indexOf("@");
  if (atIndex < 0) return null;
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain) return null;
  const primary = domain.split(".")[0];
  if (!primary) return domain;
  return primary
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function stripHtml(html: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<\/(?:div|p|br|li|tr|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

export function parseDocumentFromText(rawText: string, hints: ParseHints = {}): ParsedDocumentFields {
  const normalizedText = normalizeWhitespace(rawText);
  const lines = normalizedText
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0);

  let vendorName = inferVendorNameFromText(lines);
  if (!vendorName && hints.vendorNameSeed) {
    vendorName = normalizeWhitespace(hints.vendorNameSeed);
  }

  let date = inferDateFromText(lines);
  if (!date) {
    date = parseDateCandidate(hints.dateSeed);
  }

  const total = inferAmountByKeywords(lines, TOTAL_KEYWORDS);
  const tax = inferAmountByKeywords(lines, TAX_KEYWORDS);
  const lineItems = inferLineItems(lines);

  return {
    vendor_name: vendorName || null,
    date: date || null,
    total,
    tax,
    line_items: lineItems,
  };
}

export function parseDocumentFromPostmark(payload: PostmarkPayloadLike): ParsedDocumentFields {
  const textBody = payload.TextBody?.trim() || "";
  const htmlBody = payload.HtmlBody?.trim() || "";
  const resolvedText = textBody || stripHtml(htmlBody) || "";

  const vendorNameSeed =
    payload.FromFull?.Name?.trim() || domainFromEmail(payload.FromFull?.Email ?? null) || undefined;

  const parsed = parseDocumentFromText(resolvedText, {
    vendorNameSeed,
    dateSeed: payload.Date ?? undefined,
  });

  if (!parsed.vendor_name) {
    parsed.vendor_name = vendorNameSeed ?? null;
  }

  if (!parsed.date) {
    parsed.date = parseDateCandidate(payload.Date) ?? null;
  }

  return parsed;
}

function parseLineItemsFromJson(value: unknown): ParsedLineItem[] {
  if (!Array.isArray(value)) return [];

  const items: ParsedLineItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const entry = row as Record<string, unknown>;
    const description =
      typeof entry.description === "string"
        ? normalizeWhitespace(entry.description)
        : typeof entry.name === "string"
          ? normalizeWhitespace(entry.name)
          : "";
    if (!description) continue;

    const quantity = parseNumber(String(entry.quantity ?? entry.qty ?? ""));
    const unitCost = parseNumber(String(entry.unit_cost ?? entry.unitCost ?? entry.price ?? ""));
    const lineTotal = parseNumber(String(entry.line_total ?? entry.lineTotal ?? entry.total ?? ""));

    items.push({
      description,
      quantity,
      unit_cost: unitCost,
      line_total: lineTotal,
    });
  }

  return items;
}

export function parseDocumentFromJson(payload: unknown): ParsedDocumentFields {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      vendor_name: null,
      date: null,
      total: null,
      tax: null,
      line_items: [],
    };
  }

  const record = payload as Record<string, unknown>;
  const vendorName = record.vendor_name ?? record.vendorName ?? record.vendor ?? null;
  const dateValue = record.date ?? record.invoice_date ?? record.invoiceDate ?? null;
  const totalValue = record.total ?? record.amount_due ?? record.amountDue ?? null;
  const taxValue = record.tax ?? record.tax_total ?? record.taxTotal ?? null;

  return {
    vendor_name: typeof vendorName === "string" ? normalizeWhitespace(vendorName) : null,
    date: parseDateCandidate(typeof dateValue === "string" ? dateValue : null),
    total: parseNumber(String(totalValue ?? "")),
    tax: parseNumber(String(taxValue ?? "")),
    line_items: parseLineItemsFromJson(record.line_items ?? record.items ?? null),
  };
}

function sumLineItems(fields: ParsedDocumentFields) {
  if (!fields.line_items.length) return null;
  let sum = 0;
  let seen = 0;
  for (const line of fields.line_items) {
    if (line.line_total != null && Number.isFinite(line.line_total)) {
      sum += line.line_total;
      seen += 1;
      continue;
    }

    if (
      line.quantity != null &&
      line.unit_cost != null &&
      Number.isFinite(line.quantity) &&
      Number.isFinite(line.unit_cost)
    ) {
      sum += line.quantity * line.unit_cost;
      seen += 1;
    }
  }

  return seen > 0 ? sum : null;
}

function scoreToBand(score: number): "high" | "medium" | "low" | "none" {
  if (score >= 0.8) return "high";
  if (score >= 0.65) return "medium";
  if (score >= 0.4) return "low";
  return "none";
}

export function scoreDocumentConfidence(fields: ParsedDocumentFields): DocumentConfidenceResult {
  const flags: string[] = [];
  let requiredCount = 0;
  if (fields.vendor_name) requiredCount += 1;
  else flags.push("missing_vendor_name");
  if (fields.date) requiredCount += 1;
  else flags.push("missing_date");
  if (fields.total != null) requiredCount += 1;
  else flags.push("missing_total");

  const lineSum = sumLineItems(fields);
  if (lineSum == null) {
    flags.push("line_items_missing");
  }

  let score = 0.2;
  if (requiredCount >= 3) {
    score = 0.82;
    if (lineSum != null && fields.total != null) {
      const expected = lineSum + (fields.tax ?? 0);
      const delta = Math.abs(fields.total - expected);
      const tolerance = Math.max(Math.abs(fields.total), 1) * 0.01;
      if (delta <= tolerance) {
        score = 1.0;
      } else {
        score = 0.74;
        flags.push("totals_inconsistent");
      }
    }
  } else if (requiredCount === 2) {
    score = 0.55;
  } else if (requiredCount === 1) {
    score = 0.35;
  } else {
    score = 0.15;
  }

  return {
    score,
    band: scoreToBand(score),
    flags: Array.from(new Set(flags)),
  };
}
