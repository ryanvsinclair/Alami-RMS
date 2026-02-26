/**
 * Shopping feature shared contracts, types, and constants.
 * Canonical location for shopping server/client DTOs and configuration values.
 */

import type {
  Prisma,
  ShoppingItemResolution,
  ShoppingReconciliationStatus,
  ShoppingSessionStatus,
  UnitType,
} from "@/lib/generated/prisma/client";

// ─── Constants ───────────────────────────────────────────────

export const OPEN_STATUSES: ShoppingSessionStatus[] = ["draft", "reconciling", "ready"];
export const RECEIPT_TOTAL_TOLERANCE = 0.01;

// ─── Types ───────────────────────────────────────────────────

export type SelectedGooglePlace = {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
};

export type ShoppingFallbackPhotoAnalysis = {
  raw_text: string;
  product_info: ProductInfo | null;
};

export type ShoppingBalanceCheckItem = {
  origin: "staged" | "receipt";
  resolution: ShoppingItemResolution;
  staged_line_total: Prisma.Decimal | number | null;
  receipt_line_total: Prisma.Decimal | number | null;
};

export type ReceiptBalanceCheckParams = {
  receiptId: string | null;
  receiptSubtotal: Prisma.Decimal | number | null;
  receiptTotal: Prisma.Decimal | number | null;
  taxTotal: Prisma.Decimal | number | null;
  items: ShoppingBalanceCheckItem[];
};

export type ReceiptBalanceCheckResult = {
  hasReceipt: boolean;
  selectedSubtotal: number;
  selectedTotal: number;
  subtotalDelta: number | null;
  totalDelta: number | null;
  isBalanced: boolean;
  isMissingExpectedTotal: boolean;
};

// Re-export for convenience within the feature
export type {
  Prisma,
  ShoppingItemResolution,
  ShoppingReconciliationStatus,
  ShoppingSessionStatus,
  UnitType,
};

// Import and re-export ProductInfo type
import type { ProductInfo } from "@/core/parsers/product-name";
export type { ProductInfo };
