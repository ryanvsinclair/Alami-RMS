/**
 * Inventory feature server barrel export.
 * Canonical entry point for inventory services/repositories.
 */

export type {
  CreateInventoryItemInput,
  EnrichmentDismissalMap,
  EnrichmentQueueObservability,
  EnrichmentTaskAction,
  EnrichmentTaskDismissal,
  GetInventoryItemsOptions,
  InventoryAliasSource,
  InventoryEnrichmentQueueItem,
  InventoryEnrichmentQueueResult,
  InventoryEnrichmentTaskType,
  UpdateInventoryItemInput,
} from "./inventory.service";

export { ENRICHMENT_SNOOZE_HOURS } from "./inventory.service";

export {
  getInventoryItems,
  getInventoryEnrichmentQueue,
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
