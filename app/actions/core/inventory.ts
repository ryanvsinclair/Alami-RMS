"use server";

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { normalizeBarcode } from "@/core/utils/barcode";
import type { UnitType } from "@/lib/generated/prisma/client";
import { requireBusinessId } from "@/core/auth/tenant";

// ============================================================
// Inventory Item CRUD
// ============================================================

export async function getInventoryItems(opts?: {
  activeOnly?: boolean;
  categoryId?: string;
  search?: string;
}) {
  const businessId = await requireBusinessId();
  const where: Record<string, unknown> = {};
  where.business_id = businessId;

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
  const businessId = await requireBusinessId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id, business_id: businessId },
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
  const businessId = await requireBusinessId();
  const { barcodes, aliases, ...itemData } = data;
  const normalizedBarcodes = Array.from(
    new Set((barcodes ?? []).map((b) => normalizeBarcode(b)).filter(Boolean))
  );

  const item = await prisma.inventoryItem.create({
    data: {
      business_id: businessId,
      ...itemData,
      barcodes: normalizedBarcodes.length
        ? {
            create: normalizedBarcodes.map((b) => ({
              barcode: b,
              business_id: businessId,
            })),
          }
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
  const businessId = await requireBusinessId();
  const item = await prisma.inventoryItem.updateMany({
    where: { id, business_id: businessId },
    data,
  });
  if (item.count === 0) {
    throw new Error("Inventory item not found");
  }
  const updated = await prisma.inventoryItem.findFirstOrThrow({
    where: { id, business_id: businessId },
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
  const businessId = await requireBusinessId();
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) {
    throw new Error("Barcode is required");
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, business_id: businessId },
    select: { id: true },
  });
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const barcode_ = await prisma.itemBarcode.create({
    data: {
      inventory_item_id: inventoryItemId,
      business_id: businessId,
      barcode: normalizedBarcode,
    } as never,
  });
  return serialize(barcode_);
}

export async function removeBarcode(barcodeId: string) {
  const businessId = await requireBusinessId();
  const result = await prisma.itemBarcode.deleteMany({
    where: { id: barcodeId, business_id: businessId },
  });
  return serialize(result);
}

export async function lookupBarcode(barcode: string) {
  const businessId = await requireBusinessId();
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) return null;

  const result = await prisma.itemBarcode.findFirst({
    where: { barcode: normalizedBarcode, business_id: businessId },
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
  const businessId = await requireBusinessId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, business_id: businessId },
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
  const businessId = await requireBusinessId();
  const result = await prisma.itemAlias.deleteMany({
    where: {
      id: aliasId,
      inventory_item: { business_id: businessId },
    },
  });
  return serialize(result);
}
