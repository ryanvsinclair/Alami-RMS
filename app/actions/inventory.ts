"use server";

import { prisma } from "@/lib/prisma";
import type { UnitType } from "@/lib/generated/prisma/client";

// ============================================================
// Inventory Item CRUD
// ============================================================

export async function getInventoryItems(opts?: {
  activeOnly?: boolean;
  categoryId?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {};

  if (opts?.activeOnly !== false) {
    where.is_active = true;
  }
  if (opts?.categoryId) {
    where.category_id = opts.categoryId;
  }
  if (opts?.search) {
    where.name = { contains: opts.search, mode: "insensitive" };
  }

  return prisma.inventoryItem.findMany({
    where,
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getInventoryItem(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
  });
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
  const { barcodes, aliases, ...itemData } = data;

  return prisma.inventoryItem.create({
    data: {
      ...itemData,
      barcodes: barcodes?.length
        ? { create: barcodes.map((b) => ({ barcode: b })) }
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
  return prisma.inventoryItem.update({
    where: { id },
    data,
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
  });
}

// ============================================================
// Barcodes
// ============================================================

export async function addBarcode(inventoryItemId: string, barcode: string) {
  return prisma.itemBarcode.create({
    data: {
      inventory_item_id: inventoryItemId,
      barcode,
    },
  });
}

export async function removeBarcode(barcodeId: string) {
  return prisma.itemBarcode.delete({ where: { id: barcodeId } });
}

export async function lookupBarcode(barcode: string) {
  const result = await prisma.itemBarcode.findUnique({
    where: { barcode },
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
  return result?.inventory_item ?? null;
}

// ============================================================
// Aliases
// ============================================================

export async function addAlias(
  inventoryItemId: string,
  aliasText: string,
  source?: "barcode" | "photo" | "manual" | "receipt"
) {
  return prisma.itemAlias.create({
    data: {
      inventory_item_id: inventoryItemId,
      alias_text: aliasText.toLowerCase().trim(),
      source: source ?? null,
    },
  });
}

export async function removeAlias(aliasId: string) {
  return prisma.itemAlias.delete({ where: { id: aliasId } });
}
