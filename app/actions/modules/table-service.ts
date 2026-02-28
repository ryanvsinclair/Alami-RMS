// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/table-service/server/*

"use server";

import {
  appendKitchenOrderItems as _appendKitchenOrderItems,
  closeKitchenOrderAndSession as _closeKitchenOrderAndSession,
  confirmKitchenOrder as _confirmKitchenOrder,
  createMenuCategory as _createMenuCategory,
  createMenuItem as _createMenuItem,
  createDiningTable as _createDiningTable,
  deleteMenuCategory as _deleteMenuCategory,
  deleteDiningTable as _deleteDiningTable,
  deleteMenuItem as _deleteMenuItem,
  getDiningTables as _getDiningTables,
  getKitchenQueue as _getKitchenQueue,
  getKitchenOrderForSession as _getKitchenOrderForSession,
  getMenuSetupData as _getMenuSetupData,
  importMenuItemsFromCsv as _importMenuItemsFromCsv,
  regenerateDiningTableQrToken as _regenerateDiningTableQrToken,
  requireTableServiceAccess,
  updateDiningTable as _updateDiningTable,
  updateKitchenOrderItemStatus as _updateKitchenOrderItemStatus,
  updateMenuCategory as _updateMenuCategory,
  updateMenuItem as _updateMenuItem,
} from "@/features/table-service/server";
import type {
  AppendKitchenOrderItemsInput,
  CloseKitchenOrderInput,
  ConfirmKitchenOrderInput,
  UpdateKitchenOrderItemStatusInput,
  UpsertMenuCategoryInput,
  UpsertMenuItemInput,
} from "@/features/table-service/shared";

export async function getMenuSetupData() {
  const { businessId } = await requireTableServiceAccess();
  return _getMenuSetupData(businessId);
}

export async function createMenuCategory(input: UpsertMenuCategoryInput) {
  const { businessId } = await requireTableServiceAccess();
  return _createMenuCategory(businessId, input);
}

export async function updateMenuCategory(
  categoryId: string,
  input: UpsertMenuCategoryInput,
) {
  const { businessId } = await requireTableServiceAccess();
  return _updateMenuCategory(businessId, categoryId, input);
}

export async function deleteMenuCategory(categoryId: string) {
  const { businessId } = await requireTableServiceAccess();
  return _deleteMenuCategory(businessId, categoryId);
}

export async function createMenuItem(input: UpsertMenuItemInput) {
  const { businessId } = await requireTableServiceAccess();
  return _createMenuItem(businessId, input);
}

export async function updateMenuItem(
  menuItemId: string,
  input: UpsertMenuItemInput,
) {
  const { businessId } = await requireTableServiceAccess();
  return _updateMenuItem(businessId, menuItemId, input);
}

export async function deleteMenuItem(menuItemId: string) {
  const { businessId } = await requireTableServiceAccess();
  return _deleteMenuItem(businessId, menuItemId);
}

export async function importMenuItemsFromCsv(csvText: string) {
  const { businessId } = await requireTableServiceAccess();
  return _importMenuItemsFromCsv(businessId, csvText);
}

export async function getDiningTables() {
  const { businessId } = await requireTableServiceAccess();
  return _getDiningTables(businessId);
}

export async function createDiningTable(input: { tableNumber: string }) {
  const { businessId } = await requireTableServiceAccess();
  return _createDiningTable(businessId, input);
}

export async function updateDiningTable(
  tableId: string,
  input: { tableNumber: string },
) {
  const { businessId } = await requireTableServiceAccess();
  return _updateDiningTable(businessId, tableId, input);
}

export async function deleteDiningTable(tableId: string) {
  const { businessId } = await requireTableServiceAccess();
  return _deleteDiningTable(businessId, tableId);
}

export async function regenerateDiningTableQrToken(tableId: string) {
  const { businessId } = await requireTableServiceAccess();
  return _regenerateDiningTableQrToken(businessId, tableId);
}

export async function getKitchenOrderForSession(tableSessionId: string) {
  const { businessId } = await requireTableServiceAccess();
  return _getKitchenOrderForSession(businessId, tableSessionId);
}

export async function getKitchenQueue() {
  const { businessId } = await requireTableServiceAccess();
  return _getKitchenQueue(businessId);
}

export async function confirmKitchenOrder(input: ConfirmKitchenOrderInput) {
  const { businessId } = await requireTableServiceAccess();
  return _confirmKitchenOrder(businessId, input);
}

export async function appendKitchenOrderItems(input: AppendKitchenOrderItemsInput) {
  const { businessId } = await requireTableServiceAccess();
  return _appendKitchenOrderItems(businessId, input);
}

export async function closeKitchenOrderAndSession(input: CloseKitchenOrderInput) {
  const { businessId } = await requireTableServiceAccess();
  return _closeKitchenOrderAndSession(businessId, input);
}

export async function updateKitchenOrderItemStatus(
  input: UpdateKitchenOrderItemStatusInput,
) {
  const { businessId } = await requireTableServiceAccess();
  return _updateKitchenOrderItemStatus(businessId, input);
}
