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

export type { ResolveItemImageUrlParams } from "./item-image.resolver";

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
  extractCanonicalPluCodeFromBarcode,
  resolveItemImageUrl,
  resolveItemImageUrlFromDb,
} from "./item-image.resolver";

export {
  getImageSignedUrl,
  imageExistsInStorage,
  uploadImageFromBuffer,
  uploadImageFromUrl,
  ImageFetchError,
  ImageStorageError,
} from "./item-image-storage.service";

export {
  findProduceImage,
  listUnenrichedPluCodes,
  upsertProduceImage,
} from "./produce-image.repository";

export {
  buildInventoryItemWhere,
  findInventoryItems,
  findInventoryItemById,
  findInventoryItemIdOnly,
  findInventoryItemByBarcode,
} from "./inventory.repository";
