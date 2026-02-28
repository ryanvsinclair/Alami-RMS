/**
 * Inventory Prisma repository.
 * Encapsulates inventory item, barcode, and alias persistence queries.
 */

import { prisma } from "@/server/db/prisma";
import type { Prisma, UnitType } from "@/lib/generated/prisma/client";

const INVENTORY_ITEM_INCLUDE = {
  category: true,
  supplier: true,
  barcodes: true,
  aliases: true,
} satisfies Prisma.InventoryItemInclude;

const INVENTORY_ENRICHMENT_ITEM_SELECT = {
  id: true,
  name: true,
  category_id: true,
  updated_at: true,
  category: {
    select: {
      name: true,
    },
  },
  barcodes: {
    select: {
      barcode: true,
    },
  },
} satisfies Prisma.InventoryItemSelect;

const GLOBAL_BARCODE_ENRICHMENT_SELECT = {
  barcode_normalized: true,
  resolution_status: true,
  confidence: true,
  image_url: true,
  canonical_title: true,
  brand: true,
  size_text: true,
  category_hint: true,
  source_provider: true,
  last_seen_at: true,
} satisfies Prisma.GlobalBarcodeCatalogSelect;

export function buildInventoryItemWhere(params: {
  businessId: string;
  activeOnly?: boolean;
  categoryId?: string;
  search?: string;
}): Prisma.InventoryItemWhereInput {
  const where: Prisma.InventoryItemWhereInput = {
    business_id: params.businessId,
  };

  if (params.activeOnly !== false) {
    where.is_active = true;
  }
  if (params.categoryId) {
    where.category_id = params.categoryId;
  }
  if (params.search) {
    where.name = { contains: params.search, mode: "insensitive" };
  }

  return where;
}

export async function findInventoryItems(where: Prisma.InventoryItemWhereInput) {
  return prisma.inventoryItem.findMany({
    where,
    include: INVENTORY_ITEM_INCLUDE,
    orderBy: { name: "asc" },
  });
}

export async function findInventoryItemsForEnrichmentQueue(
  businessId: string,
  limit = 250,
) {
  return prisma.inventoryItem.findMany({
    where: {
      business_id: businessId,
      is_active: true,
    },
    select: INVENTORY_ENRICHMENT_ITEM_SELECT,
    orderBy: { updated_at: "desc" },
    take: limit,
  });
}

export async function findGlobalBarcodeCatalogByBarcodes(barcodes: string[]) {
  if (barcodes.length === 0) return [];

  return prisma.globalBarcodeCatalog.findMany({
    where: {
      barcode_normalized: { in: barcodes },
    },
    select: GLOBAL_BARCODE_ENRICHMENT_SELECT,
  });
}

export async function findInventoryItemById(id: string, businessId: string) {
  return prisma.inventoryItem.findFirst({
    where: { id, business_id: businessId },
    include: INVENTORY_ITEM_INCLUDE,
  });
}

export async function createInventoryItemRecord(data: {
  businessId: string;
  itemData: {
    name: string;
    unit: UnitType;
    category_id?: string;
    supplier_id?: string;
    units_per_case?: number;
    default_cost?: number;
    par_level?: number;
  };
  normalizedBarcodes: string[];
  aliases?: string[];
}) {
  return prisma.inventoryItem.create({
    data: {
      business_id: data.businessId,
      ...data.itemData,
      barcodes: data.normalizedBarcodes.length
        ? {
            create: data.normalizedBarcodes.map((barcode) => ({
              barcode,
              business_id: data.businessId,
            })),
          }
        : undefined,
      aliases: data.aliases?.length
        ? { create: data.aliases.map((alias) => ({ alias_text: alias })) }
        : undefined,
    },
    include: INVENTORY_ITEM_INCLUDE,
  });
}

export async function updateInventoryItemForBusiness(
  id: string,
  businessId: string,
  data: {
    name?: string;
    unit?: UnitType;
    category_id?: string | null;
    supplier_id?: string | null;
    units_per_case?: number | null;
    default_cost?: number | null;
    par_level?: number | null;
    is_active?: boolean;
  },
) {
  return prisma.inventoryItem.updateMany({
    where: { id, business_id: businessId },
    data,
  });
}

export async function findInventoryItemIdOnly(id: string, businessId: string) {
  return prisma.inventoryItem.findFirst({
    where: { id, business_id: businessId },
    select: { id: true },
  });
}

export async function createItemBarcode(data: {
  inventoryItemId: string;
  businessId: string;
  barcode: string;
}) {
  return prisma.itemBarcode.create({
    data: {
      inventory_item_id: data.inventoryItemId,
      business_id: data.businessId,
      barcode: data.barcode,
    } as never,
  });
}

export async function deleteItemBarcodeForBusiness(barcodeId: string, businessId: string) {
  return prisma.itemBarcode.deleteMany({
    where: { id: barcodeId, business_id: businessId },
  });
}

export async function findInventoryItemByBarcode(barcode: string, businessId: string) {
  return prisma.itemBarcode.findFirst({
    where: { barcode, business_id: businessId },
    include: {
      inventory_item: {
        include: INVENTORY_ITEM_INCLUDE,
      },
    },
  });
}

export async function createItemAlias(data: {
  inventoryItemId: string;
  aliasText: string;
  source?: "barcode" | "photo" | "manual" | "receipt";
}) {
  return prisma.itemAlias.create({
    data: {
      inventory_item_id: data.inventoryItemId,
      alias_text: data.aliasText,
      source: data.source ?? null,
    },
  });
}

export async function deleteItemAliasForBusiness(aliasId: string, businessId: string) {
  return prisma.itemAlias.deleteMany({
    where: {
      id: aliasId,
      inventory_item: { business_id: businessId },
    },
  });
}

// ---- Enrichment candidate source queries --------------------------------

/**
 * Find recent receipt line items with suggested/unresolved status for a business.
 * These indicate receipt matching gaps that may need enrichment follow-up.
 */
export async function findRecentUnresolvedReceiptLines(
  businessId: string,
  opts?: { daysBack?: number; limit?: number },
) {
  const daysBack = opts?.daysBack ?? 30;
  const limit = opts?.limit ?? 100;
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  return prisma.receiptLineItem.findMany({
    where: {
      receipt: {
        business_id: businessId,
        status: { in: ["review", "committed"] },
      },
      status: { in: ["suggested", "unresolved"] },
      created_at: { gte: cutoff },
    },
    select: {
      id: true,
      raw_text: true,
      parsed_name: true,
      status: true,
      confidence: true,
      matched_item_id: true,
      created_at: true,
      receipt: {
        select: {
          id: true,
          supplier_id: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

/**
 * Find recent receipt line items explicitly marked "resolve later" for purchase confirmation.
 * These represent unresolved purchase-confirmation decisions from receipt review flow.
 */
export async function findReceiptPurchaseConfirmationsToResolve(
  businessId: string,
  opts?: { daysBack?: number; limit?: number },
) {
  const daysBack = opts?.daysBack ?? 30;
  const limit = opts?.limit ?? 100;
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  return prisma.receiptLineItem.findMany({
    where: {
      receipt: {
        business_id: businessId,
        status: { in: ["review", "committed"] },
      },
      inventory_decision: "resolve_later",
      matched_item_id: { not: null },
      created_at: { gte: cutoff },
    },
    select: {
      id: true,
      raw_text: true,
      parsed_name: true,
      status: true,
      matched_item_id: true,
      inventory_decision: true,
      created_at: true,
      receipt: {
        select: {
          id: true,
          supplier_id: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

/**
 * Find shopping session items with unresolved pairing from committed sessions.
 * These indicate items that went through shopping but couldn't be fully resolved.
 */
export async function findUnresolvedShoppingItems(
  businessId: string,
  opts?: { daysBack?: number; limit?: number },
) {
  const daysBack = opts?.daysBack ?? 30;
  const limit = opts?.limit ?? 100;
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  return prisma.shoppingSessionItem.findMany({
    where: {
      session: {
        business_id: businessId,
        status: "committed",
        created_at: { gte: cutoff },
      },
      OR: [
        // Scanned barcodes that never linked to inventory
        {
          scanned_barcode: { not: null },
          inventory_item_id: null,
        },
        // Staged items missing on receipt
        {
          origin: "staged",
          reconciliation_status: "missing_on_receipt",
        },
        // Receipt-origin items with no staged match
        {
          origin: "receipt",
          reconciliation_status: "extra_on_receipt",
        },
      ],
    },
    select: {
      id: true,
      scanned_barcode: true,
      raw_name: true,
      normalized_name: true,
      origin: true,
      reconciliation_status: true,
      resolution: true,
      inventory_item_id: true,
      created_at: true,
      session: {
        select: {
          id: true,
          store_name: true,
          google_place_id: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

/**
 * Find active inventory items missing a category assignment.
 * Service layer does additional filtering (e.g. short/ambiguous names).
 */
export async function findInventoryItemsMissingCategory(
  businessId: string,
  limit = 100,
) {
  return prisma.inventoryItem.findMany({
    where: {
      business_id: businessId,
      is_active: true,
      category_id: null,
    },
    select: {
      id: true,
      name: true,
      category_id: true,
      updated_at: true,
      barcodes: { select: { barcode: true } },
    },
    orderBy: { updated_at: "desc" },
    take: limit,
  });
}
