/**
 * Inventory feature server barrel export.
 * Canonical entry point for inventory services/repositories.
 */

export type {
  CreateInventoryItemInput,
  GetInventoryItemsOptions,
  InventoryAliasSource,
  UpdateInventoryItemInput,
} from "./inventory.service";

export {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  addBarcode,
  removeBarcode,
  lookupBarcode,
  addAlias,
  removeAlias,
} from "./inventory.service";

export {
  buildInventoryItemWhere,
  findInventoryItems,
  findInventoryItemById,
  findInventoryItemIdOnly,
  findInventoryItemByBarcode,
} from "./inventory.repository";

