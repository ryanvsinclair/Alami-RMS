/**
 * Receipt Prisma repository.
 * Encapsulates all receipt queries and standard includes.
 */

import { prisma } from "@/server/db/prisma";
import { serialize } from "@/core/utils/serialize";
import type { Prisma, MatchConfidence, LineItemStatus } from "@/lib/generated/prisma/client";
import {
  RECEIPT_WITH_LINE_ITEMS_INCLUDE,
  RECEIPT_DETAIL_INCLUDE,
  RECEIPT_LIST_INCLUDE,
} from "./contracts";

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
        select: { google_place_id: true },
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
