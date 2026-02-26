/**
 * Pure helper functions for the shopping feature.
 * No side effects, no Prisma, no external calls.
 */

import { normalizeText, similarity } from "@/domain/matching/fuzzy";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  RECEIPT_TOTAL_TOLERANCE,
  type ShoppingBalanceCheckItem,
  type ReceiptBalanceCheckParams,
  type ReceiptBalanceCheckResult,
} from "./contracts";

// ─── Numeric helpers ─────────────────────────────────────────

export function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  return value.toNumber();
}
export function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Text helpers ────────────────────────────────────────────

export function normalizeName(value: string): string {
  return normalizeText(value) || value.toLowerCase().trim();
}

export function normalizeSpace(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

// ─── JSON helpers ────────────────────────────────────────────

export function asJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mergeResolutionAudit(
  current: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base = asJsonRecord(current);
  return {
    ...base,
    ...patch,
    updated_at: new Date().toISOString(),
  } as Prisma.InputJsonValue;
}

// ─── Display / label helpers ─────────────────────────────────

export function buildExternalBarcodeDisplayName(metadata: {
  name: string;
  brand: string | null;
  size_text: string | null;
}): string {
  const parts = [metadata.brand, metadata.name, metadata.size_text]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(" ") || metadata.name || "Unresolved Item";
}

export function isGenericUnresolvedShoppingLabel(rawName: string): boolean {
  return /^unresolved item(?:\s+\[upc:\d{8,14}\])?$/i.test(rawName.trim());
}

// ─── Scoring functions ───────────────────────────────────────

export function scoreShoppingReceiptLineCandidate(params: {
  itemInventoryItemId: string | null | undefined;
  itemRawName: string;
  itemNormalizedName: string;
  itemScannedBarcode: string | null | undefined;
  itemQuantity: Prisma.Decimal | number | null | undefined;
  itemStagedLineTotal: Prisma.Decimal | number | null | undefined;
  stagedIndex: number;
  lineIndex: number;
  lineMatchedItemId: string | null | undefined;
  lineRawText: string;
  lineParsedName: string | null | undefined;
  lineQuantity: Prisma.Decimal | number | null | undefined;
  lineLineTotal: Prisma.Decimal | number | null | undefined;
  lineConfidence: string | null | undefined;
}): number {
  if (
    params.itemInventoryItemId &&
    params.lineMatchedItemId === params.itemInventoryItemId
  ) {
    return 1;
  }

  const lineName = normalizeName(params.lineParsedName ?? params.lineRawText);
  let score = similarity(params.itemNormalizedName, lineName);

  if (!params.itemScannedBarcode) {
    return score;
  }

  const distance = Math.abs(params.stagedIndex - params.lineIndex);
  let barcodeHeuristicScore = Math.max(0, 0.72 - distance * 0.12);

  const stagedTotal = toNumber(params.itemStagedLineTotal);
  const lineTotal = toNumber(params.lineLineTotal);
  if (stagedTotal != null && lineTotal != null) {
    const delta = Math.abs(stagedTotal - lineTotal);
    if (delta <= 0.01) {
      barcodeHeuristicScore += 0.16;
    } else if (delta <= 0.5) {
      barcodeHeuristicScore += 0.08;
    }
  }

  const stagedQty = toNumber(params.itemQuantity);
  const lineQty = toNumber(params.lineQuantity);
  if (
    stagedQty != null &&
    lineQty != null &&
    Math.abs(stagedQty - lineQty) <= 0.001
  ) {
    barcodeHeuristicScore += 0.05;
  }

  if (params.lineConfidence === "high" && params.lineMatchedItemId) {
    barcodeHeuristicScore += 0.04;
  }

  const cappedBarcodeHeuristic = Math.min(barcodeHeuristicScore, 0.95);
  if (
    !params.itemInventoryItemId &&
    isGenericUnresolvedShoppingLabel(params.itemRawName)
  ) {
    score = Math.max(score, cappedBarcodeHeuristic);
  } else {
    score = Math.max(score, Math.min(score + cappedBarcodeHeuristic * 0.2, 0.95));
  }

  return Math.min(score, 1);
}

export function scoreReceiptItemAgainstWebFallback(params: {
  receiptItemName: string;
  receiptLineTotal: Prisma.Decimal | number | null | undefined;
  receiptQuantity: Prisma.Decimal | number | null | undefined;
  stagedLineTotal: Prisma.Decimal | number | null | undefined;
  stagedQuantity: Prisma.Decimal | number | null | undefined;
  canonicalName: string;
  brand: string | null;
  size: string | null;
  webConfidenceScore: number;
}): number {
  const receiptText = normalizeName(params.receiptItemName);
  const targetText = normalizeName(
    [params.brand, params.canonicalName, params.size].filter(Boolean).join(" ")
  );
  let score = similarity(receiptText, targetText);

  const receiptTotal = toNumber(params.receiptLineTotal);
  const stagedTotal = toNumber(params.stagedLineTotal);
  if (receiptTotal != null && stagedTotal != null) {
    const delta = Math.abs(receiptTotal - stagedTotal);
    if (delta <= 0.01) score += 0.14;
    else if (delta <= 0.5) score += 0.08;
    else if (delta <= 1.5) score += 0.03;
  }

  const receiptQty = toNumber(params.receiptQuantity);
  const stagedQty = toNumber(params.stagedQuantity);
  if (
    receiptQty != null &&
    stagedQty != null &&
    Math.abs(receiptQty - stagedQty) <= 0.001
  ) {
    score += 0.05;
  }

  score += Math.min(params.webConfidenceScore, 0.9) * 0.15;
  return clamp(score, 0, 1);
}

// ─── Receipt total parsing ──────────────────────────────────

export function parseReceiptTotals(rawText: string): {
  subtotal: number | null;
  tax: number | null;
  total: number | null;
} {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  const amountFromLine = (line: string) => {
    const match = line.match(/(\d+\.\d{2})\s*$/);
    return match ? parseFloat(match[1]) : null;
  };

  const subtotal = lines.find((line) => /^sub\s*total|^subtotal/.test(line));
  const tax = lines.find((line) => /^tax|^gst|^hst|^pst/.test(line));
  const total = lines.find((line) => /^total(?!.*sub)/.test(line));

  return {
    subtotal: subtotal ? amountFromLine(subtotal) : null,
    tax: tax ? amountFromLine(tax) : null,
    total: total ? amountFromLine(total) : null,
  };
}

// ─── Balance check ──────────────────────────────────────────

export function getSelectedShoppingLineSubtotal(items: ShoppingBalanceCheckItem[]): number {
  const subtotal = items
    .filter((item) => item.resolution !== "skip")
    .reduce((sum, item) => {
      const useReceipt = item.origin === "receipt" || item.resolution === "accept_receipt";
      if (useReceipt) {
        return sum + (toNumber(item.receipt_line_total) ?? toNumber(item.staged_line_total) ?? 0);
      }
      return sum + (toNumber(item.staged_line_total) ?? 0);
    }, 0);

  return round(subtotal);
}

export function getReceiptBalanceCheck(params: ReceiptBalanceCheckParams): ReceiptBalanceCheckResult {
  if (!params.receiptId) {
    return {
      hasReceipt: false,
      selectedSubtotal: 0,
      selectedTotal: 0,
      subtotalDelta: null as number | null,
      totalDelta: null as number | null,
      isBalanced: false,
      isMissingExpectedTotal: false,
    };
  }

  const selectedSubtotal = getSelectedShoppingLineSubtotal(params.items);
  const selectedTotal = round(selectedSubtotal + (toNumber(params.taxTotal) ?? 0));

  const expectedSubtotal = toNumber(params.receiptSubtotal);
  const expectedTotal = toNumber(params.receiptTotal);
  const subtotalDelta =
    expectedSubtotal == null ? null : round(selectedSubtotal - expectedSubtotal);
  const totalDelta = expectedTotal == null ? null : round(selectedTotal - expectedTotal);

  const subtotalBalanced =
    subtotalDelta == null || Math.abs(subtotalDelta) <= RECEIPT_TOTAL_TOLERANCE;
  const totalBalanced =
    totalDelta != null && Math.abs(totalDelta) <= RECEIPT_TOTAL_TOLERANCE;

  return {
    hasReceipt: true,
    selectedSubtotal,
    selectedTotal,
    subtotalDelta,
    totalDelta,
    isBalanced: subtotalBalanced && totalBalanced,
    isMissingExpectedTotal: expectedTotal == null,
  };
}