/**
 * Shopping UI types and constants.
 * Shared between shopping UI components and hooks.
 */

import type { ProductInfo } from "@/domain/parsers/product-name";

export type SessionStatus = "draft" | "reconciling" | "ready" | "committed" | "cancelled";

export interface ShoppingItem {
  id: string;
  origin: "staged" | "receipt";
  inventory_item_id?: string | null;
  receipt_line_item_id?: string | null;
  scanned_barcode?: string | null;
  raw_name: string;
  quantity: number | string;
  unit: string;
  staged_unit_price: number | string | null;
  staged_line_total: number | string | null;
  receipt_quantity: number | string | null;
  receipt_unit_price: number | string | null;
  receipt_line_total: number | string | null;
  delta_quantity: number | string | null;
  delta_price: number | string | null;
  reconciliation_status:
    | "pending"
    | "exact"
    | "quantity_mismatch"
    | "price_mismatch"
    | "missing_on_receipt"
    | "extra_on_receipt";
  resolution: "pending" | "accept_staged" | "accept_receipt" | "skip";
}

export interface ShoppingSession {
  id: string;
  status: SessionStatus;
  receipt_id: string | null;
  store_name: string | null;
  store_address: string | null;
  store_lat: number | string | null;
  store_lng: number | string | null;
  staged_subtotal: number | string | null;
  receipt_subtotal: number | string | null;
  receipt_total: number | string | null;
  tax_total: number | string | null;
  items: ShoppingItem[];
}

export type ShoppingFallbackPhotoAnalysis = {
  raw_text: string;
  product_info: ProductInfo | null;
};

export type ShoppingWebFallbackSuggestion = {
  status:
    | "ok"
    | "unavailable"
    | "no_results"
    | "no_unmatched_receipt_items";
  query: string;
  rationale: string;
  web_result:
    | null
    | {
        confidence_label: "low" | "medium" | "high" | "none";
        confidence_score: number;
        structured: {
          canonical_name: string;
          brand: string | null;
          size: string | null;
          unit: string | null;
          pack_count: number | null;
        };
        candidates: Array<{
          title: string;
          link: string;
          snippet: string;
        }>;
      };
  pair_suggestions: Array<{
    receipt_item_id: string;
    receipt_line_item_id: string | null;
    receipt_name: string;
    receipt_line_total: number | null;
    score: number;
    confidence: "low" | "medium" | "high";
  }>;
  suggested_receipt_item_id?: string | null;
  suggested_confidence?: "low" | "medium" | "high";
  ambiguous?: boolean;
  auto_apply_eligible?: boolean;
  auto_apply_reason?: string;
};

export type QuickScanFeedback = {
  status: "resolved_inventory" | "resolved_barcode_metadata" | "unresolved";
  display_name: string;
  normalized_barcode: string;
  deferred_resolution: boolean;
  source: string;
  confidence: string;
};

// ─── Display constants ───────────────────────────────────────

export const reconLabel: Record<ShoppingItem["reconciliation_status"], string> = {
  pending: "Pending",
  exact: "Verified",
  quantity_mismatch: "Qty mismatch",
  price_mismatch: "Price mismatch",
  missing_on_receipt: "Missing",
  extra_on_receipt: "Extra",
};

export const reconVariant: Record<ShoppingItem["reconciliation_status"], "default" | "success" | "warning" | "danger"> = {
  pending: "default",
  exact: "success",
  quantity_mismatch: "warning",
  price_mismatch: "warning",
  missing_on_receipt: "danger",
  extra_on_receipt: "warning",
};

// ─── Pure UI helpers ─────────────────────────────────────────

export function asNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value) || 0;
}

export function formatMoney(value: number | string | null | undefined): string {
  return `$${asNumber(value).toFixed(2)}`;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function extractEmbeddedUpc(rawName: string): string | null {
  const match = rawName.match(/\[UPC:(\d{8,14})\]$/);
  return match ? match[1] : null;
}

export function displayShoppingItemName(rawName: string): string {
  return extractEmbeddedUpc(rawName) ? "Unresolved Item" : rawName;
}

export function getItemBarcodeBadgeValue(item: ShoppingItem): string | null {
  if (item.scanned_barcode) return item.scanned_barcode;
  return extractEmbeddedUpc(item.raw_name);
}
