/**
 * Receipt Prisma repository.
 * Encapsulates all receipt queries and standard includes.
 */

import { prisma } from "@/server/db/prisma";
import { serialize } from "@/domain/shared/serialize";
import type { Prisma, MatchConfidence, LineItemStatus } from "@/lib/generated/prisma/client";
import {
  RECEIPT_WITH_LINE_ITEMS_INCLUDE,
  RECEIPT_DETAIL_INCLUDE,
  RECEIPT_LIST_INCLUDE,
} from "./contracts";

export interface ReceiptHistoricalLinePriceSample {
  parsed_name: string;
  line_cost: number;
  unit_cost: number | null;
  status: LineItemStatus;
  matched_item_id: string | null;
}

export interface UpsertReceiptParseProfileInput {
  businessId: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
  profileKey: string;
  signals: Prisma.InputJsonValue;
  stats: Prisma.InputJsonValue;
  version?: number;
  lastSeenAt?: Date;
}

// ---- Single receipt queries -------------------------------------------

export async function findReceiptById(receiptId: string, businessId: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, business_id: businessId },
    include: RECEIPT_WITH_LINE_ITEMS_INCLUDE,
  });
  return receipt ? serialize(receipt) : null;
}

export async function findReceiptWithSupplier(
  receiptId: string,
  businessId: string,
) {
  return prisma.receipt.findFirstOrThrow({
    where: { id: receiptId, business_id: businessId },
    include: {
      supplier: {
        select: { google_place_id: true, formatted_address: true },
      },
    },
  });
}

export async function findReceiptDetail(receiptId: string, businessId: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, business_id: businessId },
    include: RECEIPT_DETAIL_INCLUDE,
  });
  return receipt ? serialize(receipt) : null;
}

export async function findReceiptParseProfileByKey(params: {
  businessId: string;
  profileKey: string;
}) {
  return prisma.receiptParseProfile.findUnique({
    where: {
      business_id_profile_key: {
        business_id: params.businessId,
        profile_key: params.profileKey,
      },
    },
  });
}

// ---- List queries ----------------------------------------------------

export async function findReceipts(businessId: string, status?: string) {
  const receipts = await prisma.receipt.findMany({
    where: status
      ? { business_id: businessId, status: status as never }
      : { business_id: businessId },
    orderBy: { created_at: "desc" },
    include: RECEIPT_LIST_INCLUDE,
  });
  return serialize(receipts);
}

export async function findRecentReceiptLinePriceSamples(params: {
  businessId: string;
  parsedNames: string[];
  excludeReceiptId?: string;
  supplierId?: string | null;
  googlePlaceId?: string | null;
  take?: number;
  lookbackDays?: number;
}): Promise<ReceiptHistoricalLinePriceSample[]> {
  const normalizedNames = Array.from(
    new Set(
      params.parsedNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  );

  if (normalizedNames.length === 0) {
    return [];
  }

  const lookbackDays = Math.max(1, Math.min(params.lookbackDays ?? 120, 720));
  const lookbackStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const where: Prisma.ReceiptLineItemWhereInput = {
    receipt: {
      business_id: params.businessId,
      created_at: { gte: lookbackStart },
      ...(params.excludeReceiptId ? { id: { not: params.excludeReceiptId } } : {}),
      ...(params.supplierId
        ? { supplier_id: params.supplierId }
        : params.googlePlaceId
          ? { supplier: { google_place_id: params.googlePlaceId } }
          : {}),
    },
    parsed_name: {
      not: null,
    },
    line_cost: {
      not: null,
    },
    OR: normalizedNames.map((name) => ({
      parsed_name: {
        equals: name,
        mode: "insensitive",
      },
    })),
  };

  const rows = await prisma.receiptLineItem.findMany({
    where,
    select: {
      parsed_name: true,
      line_cost: true,
      unit_cost: true,
      status: true,
      matched_item_id: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
    take: Math.min(Math.max(params.take ?? normalizedNames.length * 40, 40), 800),
  });

  const result: ReceiptHistoricalLinePriceSample[] = [];
  for (const row of rows) {
    if (!row.parsed_name || row.line_cost == null) continue;

    const lineCost = Number(row.line_cost);
    if (!Number.isFinite(lineCost) || lineCost <= 0) continue;

    const unitCostNumber = row.unit_cost == null ? null : Number(row.unit_cost);
    const unitCost =
      unitCostNumber == null || !Number.isFinite(unitCostNumber) || unitCostNumber <= 0
        ? null
        : unitCostNumber;

    result.push({
      parsed_name: row.parsed_name,
      line_cost: lineCost,
      unit_cost: unitCost,
      status: row.status,
      matched_item_id: row.matched_item_id ?? null,
    });
  }

  return result;
}

// ---- Mutations -------------------------------------------------------

export async function createReceiptRecord(data: {
  businessId: string;
  imageUrl?: string;
  imagePath?: string | null;
  rawText?: string;
  supplierId?: string;
  status: string;
  parsedData?: Prisma.InputJsonValue;
}) {
  return prisma.receipt.create({
    data: {
      business_id: data.businessId,
      image_url: data.imageUrl,
      image_path: data.imagePath,
      raw_text: data.rawText,
      supplier_id: data.supplierId,
      status: data.status as never,
      parsed_data: data.parsedData,
    },
  });
}

export async function updateReceiptStatus(
  tx: Prisma.TransactionClient,
  receiptId: string,
  status: string,
  parsedData?: Prisma.InputJsonValue,
) {
  return tx.receipt.update({
    where: { id: receiptId },
    data: {
      status: status as never,
      ...(parsedData !== undefined ? { parsed_data: parsedData } : {}),
    },
  });
}

export async function upsertReceiptParseProfile(input: UpsertReceiptParseProfileInput) {
  const lastSeenAt = input.lastSeenAt ?? new Date();
  return prisma.receiptParseProfile.upsert({
    where: {
      business_id_profile_key: {
        business_id: input.businessId,
        profile_key: input.profileKey,
      },
    },
    create: {
      business_id: input.businessId,
      supplier_id: input.supplierId ?? null,
      google_place_id: input.googlePlaceId ?? null,
      profile_key: input.profileKey,
      signals: input.signals,
      stats: input.stats,
      version: input.version ?? 1,
      last_seen_at: lastSeenAt,
    },
    update: {
      supplier_id: input.supplierId ?? null,
      google_place_id: input.googlePlaceId ?? null,
      signals: input.signals,
      stats: input.stats,
      ...(input.version != null ? { version: input.version } : {}),
      last_seen_at: lastSeenAt,
    },
  });
}

// ---- Line item mutations ---------------------------------------------

export async function deleteLineItems(
  tx: Prisma.TransactionClient,
  receiptId: string,
) {
  return tx.receiptLineItem.deleteMany({
    where: { receipt_id: receiptId },
  });
}

export async function createLineItem(
  tx: Prisma.TransactionClient,
  receiptId: string,
  line: {
    line_number: number;
    raw_text: string;
    parsed_name: string | null;
    quantity: number | null;
    unit: string | null;
    line_cost: number | null;
    unit_cost: number | null;
    plu_code?: number | null;
    organic_flag?: boolean | null;
    parse_confidence_score?: number | null;
    parse_confidence_band?: MatchConfidence | null;
    parse_flags?: string[] | null;
    parse_corrections?: unknown[] | null;
    matched_item_id: string | null;
    confidence: MatchConfidence | null;
    status: LineItemStatus;
  },
) {
  return tx.receiptLineItem.create({
    data: {
      receipt_id: receiptId,
      line_number: line.line_number,
      raw_text: line.raw_text,
      parsed_name: line.parsed_name,
      quantity: line.quantity,
      unit: line.unit as never,
      line_cost: line.line_cost,
      unit_cost: line.unit_cost,
      plu_code: line.plu_code ?? null,
      organic_flag: line.organic_flag ?? null,
      parse_confidence_score: line.parse_confidence_score ?? null,
      parse_confidence_band: line.parse_confidence_band ?? null,
      parse_flags: (line.parse_flags ?? []) as Prisma.InputJsonValue,
      parse_corrections: (line.parse_corrections ?? []) as Prisma.InputJsonValue,
      matched_item_id: line.matched_item_id,
      confidence: line.confidence ?? undefined,
      status: line.status,
    },
  });
}

export async function findLineItemWithReceipt(
  lineItemId: string,
  businessId: string,
) {
  return prisma.receiptLineItem.findFirst({
    where: { id: lineItemId, receipt: { business_id: businessId } },
    select: {
      id: true,
      receipt: {
        select: {
          supplier_id: true,
          supplier: {
            select: { google_place_id: true },
          },
        },
      },
    },
  });
}

export async function updateLineItem(
  lineItemId: string,
  data: {
    matched_item_id: string | null;
    status: LineItemStatus;
    quantity?: number;
    unit?: string;
    confidence: MatchConfidence;
  },
) {
  return prisma.receiptLineItem.update({
    where: { id: lineItemId },
    data: {
      matched_item_id: data.matched_item_id,
      status: data.status,
      quantity: data.quantity,
      unit: data.unit as never,
      confidence: data.confidence,
    },
  });
}
