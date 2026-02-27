/**
 * Receipt feature shared contracts, types, and constants.
 * Canonical location for receipt server DTOs and configuration values.
 */

import type { Prisma, MatchConfidence, LineItemStatus } from "@/lib/generated/prisma/client";
import type { ReceiptPostOcrCorrectionSummary } from "./receipt-correction.contracts";
import type { ParsedLineProduceMatch } from "@/domain/parsers/receipt";

// ---- Standard Prisma includes ----------------------------------------

export const RECEIPT_WITH_LINE_ITEMS_INCLUDE = {
  supplier: true,
  line_items: {
    orderBy: { line_number: "asc" } as const,
    include: {
      matched_item: true,
    },
  },
} satisfies Prisma.ReceiptInclude;

export const RECEIPT_DETAIL_INCLUDE = {
  supplier: true,
  shopping_session: {
    select: {
      id: true,
      store_name: true,
    },
  },
  line_items: {
    orderBy: { line_number: "asc" } as const,
    include: {
      matched_item: { select: { id: true, name: true, unit: true } },
    },
  },
} satisfies Prisma.ReceiptInclude;

export const RECEIPT_LIST_INCLUDE = {
  supplier: true,
  _count: { select: { line_items: true } },
} satisfies Prisma.ReceiptInclude;

// ---- Types -----------------------------------------------------------

/** Shape returned by the line-item matching step. */
export type ResolvedLineItem = {
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | null;
  unit: string | null;
  line_cost: number | null;
  unit_cost: number | null;
  plu_code?: number | null;
  produce_match?: ParsedLineProduceMatch | null;
  organic_flag?: boolean | null;
  matched_item_id: string | null;
  confidence: MatchConfidence | null;
  status: LineItemStatus;
};

// Re-export Prisma enum types for convenience
export type { MatchConfidence, LineItemStatus };

/** Summary stats written to receipt.parsed_data. */
export type ParsedDataSummary = {
  source?: string;
  establishment?: string | null;
  date?: string | null;
  currency?: string | null;
  paymentMethod?: string | null;
  correction?: ReceiptPostOcrCorrectionSummary;
  line_count: number;
  matched_count: number;
  suggested_count: number;
  unresolved_count: number;
};
