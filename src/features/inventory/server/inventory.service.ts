/**
 * Inventory service layer.
 * Preserves action behavior while isolating persistence concerns in a repository.
 */

import { normalizeBarcode } from "@/domain/barcode/normalize";
import { serialize } from "@/domain/shared/serialize";
import type { UnitType } from "@/lib/generated/prisma/client";
import {
  buildInventoryItemWhere,
  createInventoryItemRecord,
  createItemAlias,
  createItemBarcode,
  deleteItemAliasForBusiness,
  deleteItemBarcodeForBusiness,
  findInventoryItemByBarcode,
  findInventoryItemById,
  findInventoryItemIdOnly,
  findInventoryItems,
  updateInventoryItemForBusiness,
} from "./inventory.repository";

export interface GetInventoryItemsOptions {
  activeOnly?: boolean;
  categoryId?: string;
  search?: string;
}

export interface CreateInventoryItemInput {
  name: string;
  unit: UnitType;
  category_id?: string;
  supplier_id?: string;
  units_per_case?: number;
  default_cost?: number;
  par_level?: number;
  barcodes?: string[];
  aliases?: string[];
}

export interface UpdateInventoryItemInput {
  name?: string;
  unit?: UnitType;
  category_id?: string | null;
  supplier_id?: string | null;
  units_per_case?: number | null;
  default_cost?: number | null;
  par_level?: number | null;
  is_active?: boolean;
}

export type InventoryAliasSource = "barcode" | "photo" | "manual" | "receipt";

export async function getInventoryItems(businessId: string, opts?: GetInventoryItemsOptions) {
  const items = await findInventoryItems(
    buildInventoryItemWhere({
      businessId,
      activeOnly: opts?.activeOnly,
      categoryId: opts?.categoryId,
      search: opts?.search,
    }),
  );
  return serialize(items);
}

export async function getInventoryItem(businessId: string, id: string) {
  const item = await findInventoryItemById(id, businessId);
  return item ? serialize(item) : null;
}

export async function createInventoryItem(businessId: string, data: CreateInventoryItemInput) {
  const { barcodes, aliases, ...itemData } = data;
  const normalizedBarcodes = Array.from(
    new Set((barcodes ?? []).map((value) => normalizeBarcode(value)).filter(Boolean)),
  );

  const item = await createInventoryItemRecord({
    businessId,
    itemData,
    normalizedBarcodes,
    aliases,
  });
  return serialize(item);
}

export async function updateInventoryItem(
  businessId: string,
  id: string,
  data: UpdateInventoryItemInput,
) {
  const result = await updateInventoryItemForBusiness(id, businessId, data);
  if (result.count === 0) {
    throw new Error("Inventory item not found");
  }

  const updated = await findInventoryItemById(id, businessId);
  if (!updated) {
    throw new Error("Inventory item not found");
  }
  return serialize(updated);
}

export async function addBarcode(
  businessId: string,
  inventoryItemId: string,
  barcode: string,
) {
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) {
    throw new Error("Barcode is required");
  }

  const item = await findInventoryItemIdOnly(inventoryItemId, businessId);
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const created = await createItemBarcode({
    inventoryItemId,
    businessId,
    barcode: normalizedBarcode,
  });
  return serialize(created);
}

export async function removeBarcode(businessId: string, barcodeId: string) {
  const result = await deleteItemBarcodeForBusiness(barcodeId, businessId);
  return serialize(result);
}

export async function lookupBarcode(businessId: string, barcode: string) {
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) return null;

  const result = await findInventoryItemByBarcode(normalizedBarcode, businessId);
  return result?.inventory_item ? serialize(result.inventory_item) : null;
}

export async function addAlias(
  businessId: string,
  inventoryItemId: string,
  aliasText: string,
  source?: InventoryAliasSource,
) {
  const item = await findInventoryItemIdOnly(inventoryItemId, businessId);
  if (!item) {
    throw new Error("Inventory item not found");
  }

  const alias = await createItemAlias({
    inventoryItemId,
    aliasText: aliasText.toLowerCase().trim(),
    source,
  });
  return serialize(alias);
}

export async function removeAlias(businessId: string, aliasId: string) {
  const result = await deleteItemAliasForBusiness(aliasId, businessId);
  return serialize(result);
}
