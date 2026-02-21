"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import type { UnitType } from "@/lib/generated/prisma/client";
import { requireRestaurantId } from "@/lib/auth/tenant";

// ============================================================
// Inventory Item CRUD
// ============================================================

export async function getInventoryItems(opts?: {
  activeOnly?: boolean;
  categoryId?: string;
  search?: string;
}) {
  const restaurantId = await requireRestaurantId();
  const where: Record<string, unknown> = {};
  where.restaurant_id = restaurantId;

  if (opts?.activeOnly !== false) {
    where.is_active = true;
  }
  if (opts?.categoryId) {
    where.category_id = opts.categoryId;
  }
  if (opts?.search) {
    where.name = { contains: opts.search, mode: "insensitive" };
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
    orderBy: { name: "asc" },
  });
  return serialize(items);
}

export async function getInventoryItem(id: string) {
  const restaurantId = await requireRestaurantId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id, restaurant_id: restaurantId },
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
  });
  return item ? serialize(item) : null;
}

export async function createInventoryItem(data: {
  name: string;
  unit: UnitType;
  category_id?: string;
  supplier_id?: string;
  units_per_case?: number;
  default_cost?: number;
  par_level?: number;
  barcodes?: string[];
  aliases?: string[];
}) {
  const restaurantId = await requireRestaurantId();
  const { barcodes, aliases, ...itemData } = data;

  const item = await prisma.inventoryItem.create({
    data: {
      restaurant_id: restaurantId,
      ...itemData,
      barcodes: barcodes?.length
        ? { create: barcodes.map((b) => ({ barcode: b, restaurant_id: restaurantId })) }
        : undefined,
      aliases: aliases?.length
        ? { create: aliases.map((a) => ({ alias_text: a })) }
        : undefined,
    },
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
  });
  return serialize(item);
}

export async function updateInventoryItem(
  id: string,
  data: {
    name?: string;
    unit?: UnitType;
    category_id?: string | null;
    supplier_id?: string | null;
    units_per_case?: number | null;
    default_cost?: number | null;
    par_level?: number | null;
    is_active?: boolean;
  }
) {
  const restaurantId = await requireRestaurantId();
  const item = await prisma.inventoryItem.updateMany({
    where: { id, restaurant_id: restaurantId },
    data,
  });
  if (item.count === 0) {
    throw new Error("Inventory item not found");
  }
  const updated = await prisma.inventoryItem.findFirstOrThrow({
    where: { id, restaurant_id: restaurantId },
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
  });
  return serialize(updated);
}

// ============================================================
// Barcodes
// ============================================================

export async function addBarcode(inventoryItemId: string, barcode: string) {
  const restaurantId = await requireRestaurantId();
  const barcode_ = await prisma.itemBarcode.create({
    data: {
      inventory_item_id: inventoryItemId,
      restaurant_id: restaurantId,
      barcode,
    } as never,
  });
  return serialize(barcode_);
}

export async function removeBarcode(barcodeId: string) {
  const restaurantId = await requireRestaurantId();
  const result = await prisma.itemBarcode.deleteMany({
    where: { id: barcodeId, restaurant_id: restaurantId },
  });
  return serialize(result);
}

export async function lookupBarcode(barcode: string) {
  const restaurantId = await requireRestaurantId();
  const result = await prisma.itemBarcode.findFirst({
    where: { barcode, restaurant_id: restaurantId },
    include: {
      inventory_item: {
        include: {
          category: true,
          supplier: true,
          barcodes: true,
          aliases: true,
        },
      },
    },
  });
  return result?.inventory_item ? serialize(result.inventory_item) : null;
}

// ============================================================
// Aliases
// ============================================================

export async function addAlias(
  inventoryItemId: string,
  aliasText: string,
  source?: "barcode" | "photo" | "manual" | "receipt"
) {
  const restaurantId = await requireRestaurantId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, restaurant_id: restaurantId },
    select: { id: true },
  });
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const alias = await prisma.itemAlias.create({
    data: {
      inventory_item_id: inventoryItemId,
      alias_text: aliasText.toLowerCase().trim(),
      source: source ?? null,
    },
  });
  return serialize(alias);
}

export async function removeAlias(aliasId: string) {
  const restaurantId = await requireRestaurantId();
  const result = await prisma.itemAlias.deleteMany({
    where: {
      id: aliasId,
      inventory_item: { restaurant_id: restaurantId },
    },
  });
  return serialize(result);
}
