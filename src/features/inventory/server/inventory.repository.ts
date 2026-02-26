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
