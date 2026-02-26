// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/inventory/server/*

"use server";

import { requireBusinessId } from "@/core/auth/tenant";
import type {
  CreateInventoryItemInput,
  GetInventoryItemsOptions,
  InventoryAliasSource,
  UpdateInventoryItemInput,
} from "@/features/inventory/server";
import {
  addAlias as _addAlias,
  addBarcode as _addBarcode,
  createInventoryItem as _createInventoryItem,
  getInventoryItem as _getInventoryItem,
  getInventoryItems as _getInventoryItems,
  lookupBarcode as _lookupBarcode,
  removeAlias as _removeAlias,
  removeBarcode as _removeBarcode,
  updateInventoryItem as _updateInventoryItem,
} from "@/features/inventory/server";

// ============================================================
// Inventory Item CRUD
// ============================================================

export async function getInventoryItems(opts?: GetInventoryItemsOptions) {
  const businessId = await requireBusinessId();
  return _getInventoryItems(businessId, opts);
}

export async function getInventoryItem(id: string) {
  const businessId = await requireBusinessId();
  return _getInventoryItem(businessId, id);
}

export async function createInventoryItem(data: CreateInventoryItemInput) {
  const businessId = await requireBusinessId();
  return _createInventoryItem(businessId, data);
}

export async function updateInventoryItem(id: string, data: UpdateInventoryItemInput) {
  const businessId = await requireBusinessId();
  return _updateInventoryItem(businessId, id, data);
}

// ============================================================
// Barcodes
// ============================================================

export async function addBarcode(inventoryItemId: string, barcode: string) {
  const businessId = await requireBusinessId();
  return _addBarcode(businessId, inventoryItemId, barcode);
}

export async function removeBarcode(barcodeId: string) {
  const businessId = await requireBusinessId();
  return _removeBarcode(businessId, barcodeId);
}

export async function lookupBarcode(barcode: string) {
  const businessId = await requireBusinessId();
  return _lookupBarcode(businessId, barcode);
}

// ============================================================
// Aliases
// ============================================================

export async function addAlias(
  inventoryItemId: string,
  aliasText: string,
  source?: InventoryAliasSource,
) {
  const businessId = await requireBusinessId();
  return _addAlias(businessId, inventoryItemId, aliasText, source);
}

export async function removeAlias(aliasId: string) {
  const businessId = await requireBusinessId();
  return _removeAlias(businessId, aliasId);
}
