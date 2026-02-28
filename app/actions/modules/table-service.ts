// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/table-service/server/*

"use server";

import {
  createMenuCategory as _createMenuCategory,
  createMenuItem as _createMenuItem,
  deleteMenuCategory as _deleteMenuCategory,
  deleteMenuItem as _deleteMenuItem,
  getMenuSetupData as _getMenuSetupData,
  importMenuItemsFromCsv as _importMenuItemsFromCsv,
  requireTableServiceAccess,
  updateMenuCategory as _updateMenuCategory,
  updateMenuItem as _updateMenuItem,
} from "@/features/table-service/server";
import type {
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
