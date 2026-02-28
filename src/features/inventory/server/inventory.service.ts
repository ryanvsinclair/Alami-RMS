/**
 * Inventory service layer.
 * Preserves action behavior while isolating persistence concerns in a repository.
 */

import { normalizeBarcode } from "@/domain/barcode/normalize";
import { serialize } from "@/domain/shared/serialize";
import {
  type EnrichmentQueueObservability,
  type InventoryEnrichmentQueueItem,
  type InventoryEnrichmentQueueResult,
  type InventoryEnrichmentTaskType,
} from "../shared/enrichment-queue.contracts";
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
  findInventoryItemsForEnrichmentQueue,
  findGlobalBarcodeCatalogByBarcodes,
  findInventoryItemsMissingCategory,
  findReceiptPurchaseConfirmationsToResolve,
  findRecentUnresolvedReceiptLines,
  findUnresolvedShoppingItems,
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
export {
  ENRICHMENT_SNOOZE_HOURS,
  type EnrichmentDismissalMap,
  type EnrichmentQueueObservability,
  type EnrichmentTaskAction,
  type EnrichmentTaskDismissal,
  type InventoryEnrichmentQueueItem,
  type InventoryEnrichmentQueueResult,
  type InventoryEnrichmentTaskType,
} from "../shared/enrichment-queue.contracts";

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

function buildEmptyEnrichmentTaskCounts(): Record<InventoryEnrichmentTaskType, number> {
  return {
    review_barcode_resolution: 0,
    add_product_photo: 0,
    confirm_size: 0,
    confirm_category: 0,
    confirm_brand_title_cleanup: 0,
    review_receipt_match: 0,
    review_purchase_confirmation: 0,
    resolve_shopping_pairing: 0,
  };
}

export async function getInventoryEnrichmentQueue(
  businessId: string,
  opts?: {
    inventoryScanLimit?: number;
    resultLimit?: number;
  },
) {
  // -- Source 1: barcode metadata gaps (existing logic) -----------------------
  const [
    scannedItems,
    unresolvedReceiptLines,
    unresolvedPurchaseConfirmations,
    unresolvedShoppingItems,
    itemsMissingCategory,
  ] =
    await Promise.all([
      findInventoryItemsForEnrichmentQueue(businessId, opts?.inventoryScanLimit ?? 250),
      findRecentUnresolvedReceiptLines(businessId, { daysBack: 30, limit: 100 }),
      findReceiptPurchaseConfirmationsToResolve(businessId, { daysBack: 30, limit: 100 }),
      findUnresolvedShoppingItems(businessId, { daysBack: 30, limit: 100 }),
      findInventoryItemsMissingCategory(businessId, 100),
    ]);

  const uniqueBarcodes = Array.from(
    new Set(scannedItems.flatMap((item) => item.barcodes.map((barcode) => barcode.barcode))),
  );

  const globalCatalogRows = await findGlobalBarcodeCatalogByBarcodes(uniqueBarcodes);
  const globalByBarcode = new Map(globalCatalogRows.map((row) => [row.barcode_normalized, row]));

  // Candidate map keyed by inventory_item_id for deduplication across sources
  const candidateMap = new Map<string, InventoryEnrichmentQueueItem>();

  // Observability counters
  let barcodeMetadataCandidates = 0;
  let receiptMatchingCandidates = 0;
  let purchaseConfirmationCandidates = 0;
  let shoppingPairingCandidates = 0;
  let normalizationGapCandidates = 0;

  // Helper to get-or-create a candidate entry for an inventory item
  function getOrCreateCandidate(
    itemId: string,
    itemName: string,
    categoryName: string | null,
    updatedAt: Date,
    barcodes: string[],
    linkedCatalogCount: number,
    lastCatalogUpdateAt: Date | null,
  ): InventoryEnrichmentQueueItem {
    let entry = candidateMap.get(itemId);
    if (!entry) {
      entry = {
        inventory_item_id: itemId,
        inventory_item_name: itemName,
        category_name: categoryName,
        priority: "low",
        task_types: [],
        reasons: [],
        barcodes,
        linked_catalog_count: linkedCatalogCount,
        updated_at: updatedAt,
        last_catalog_update_at: lastCatalogUpdateAt,
      };
      candidateMap.set(itemId, entry);
    }
    return entry;
  }

  function addTask(
    entry: InventoryEnrichmentQueueItem,
    taskType: InventoryEnrichmentTaskType,
    reason: string,
  ) {
    if (!entry.task_types.includes(taskType)) {
      entry.task_types.push(taskType);
      entry.reasons.push(reason);
    }
  }

  // -- Process source 1: barcode metadata gaps --------------------------------
  for (const item of scannedItems) {
    const itemBarcodes = item.barcodes.map((barcode) => barcode.barcode);
    if (itemBarcodes.length === 0) continue;

    const linkedCatalogRows = itemBarcodes
      .map((barcode) => globalByBarcode.get(barcode))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (linkedCatalogRows.length === 0) continue;

    const lastCatalogUpdateAt =
      linkedCatalogRows
        .map((row) => row.last_seen_at)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const entry = getOrCreateCandidate(
      item.id,
      item.name,
      item.category?.name ?? null,
      item.updated_at,
      itemBarcodes,
      linkedCatalogRows.length,
      lastCatalogUpdateAt,
    );

    let addedFromBarcode = false;

    const hasResolutionReview = linkedCatalogRows.some(
      (row) =>
        row.resolution_status !== "resolved" ||
        row.confidence === "none" ||
        row.confidence === "low",
    );
    if (hasResolutionReview) {
      addTask(entry, "review_barcode_resolution", "Linked barcode metadata is unresolved or low confidence.");
      addedFromBarcode = true;
    }

    const hasMissingImage = linkedCatalogRows.some((row) => !row.image_url);
    if (hasMissingImage) {
      addTask(entry, "add_product_photo", "No product image is available for at least one linked barcode.");
      addedFromBarcode = true;
    }

    const hasMissingSize = linkedCatalogRows.some((row) => !row.size_text);
    if (hasMissingSize) {
      addTask(entry, "confirm_size", "Size/pack details are missing from linked barcode metadata.");
      addedFromBarcode = true;
    }

    const needsCategoryConfirmation =
      !item.category_id ||
      linkedCatalogRows.some((row) => row.category_hint && !item.category_id);
    if (needsCategoryConfirmation) {
      addTask(entry, "confirm_category", "Category is missing or should be confirmed from linked metadata.");
      addedFromBarcode = true;
    }

    const needsBrandOrTitleCleanup = linkedCatalogRows.some(
      (row) =>
        !row.canonical_title ||
        !row.brand ||
        row.canonical_title.trim().length < 3,
    );
    if (needsBrandOrTitleCleanup) {
      addTask(entry, "confirm_brand_title_cleanup", "Brand/title metadata looks incomplete and may need cleanup.");
      addedFromBarcode = true;
    }

    if (addedFromBarcode) barcodeMetadataCandidates++;
  }

  // -- Process source 2: low-confidence receipt outcomes ----------------------
  // Group unresolved receipt lines by their matched_item_id (if any) to create
  // item-level enrichment tasks. Lines with no matched item are counted for
  // observability but can't be attributed to a specific inventory item.
  const receiptLinesByItemId = new Map<string, number>();
  let orphanReceiptLines = 0;
  for (const line of unresolvedReceiptLines) {
    if (line.matched_item_id) {
      receiptLinesByItemId.set(
        line.matched_item_id,
        (receiptLinesByItemId.get(line.matched_item_id) ?? 0) + 1,
      );
    } else {
      orphanReceiptLines++;
    }
  }

  // For receipt lines with a matched item, create/extend enrichment entries
  for (const [itemId, lineCount] of receiptLinesByItemId) {
    // Try to find item info from scannedItems (already loaded)
    const itemInfo = scannedItems.find((i) => i.id === itemId);
    if (!itemInfo) continue; // Item not in active inventory scan window

    const itemBarcodes = itemInfo.barcodes.map((b) => b.barcode);
    const entry = getOrCreateCandidate(
      itemId,
      itemInfo.name,
      itemInfo.category?.name ?? null,
      itemInfo.updated_at,
      itemBarcodes,
      0,
      null,
    );
    addTask(
      entry,
      "review_receipt_match",
      `${lineCount} recent receipt line${lineCount > 1 ? "s" : ""} matched with low confidence or remain unresolved.`,
    );
    receiptMatchingCandidates++;
  }

  // -- Process source 2b: explicit resolve-later purchase confirmations -------
  const purchaseConfirmationsByItemId = new Map<string, number>();
  for (const line of unresolvedPurchaseConfirmations) {
    if (!line.matched_item_id) continue;
    purchaseConfirmationsByItemId.set(
      line.matched_item_id,
      (purchaseConfirmationsByItemId.get(line.matched_item_id) ?? 0) + 1,
    );
  }

  for (const [itemId, lineCount] of purchaseConfirmationsByItemId) {
    const itemInfo = scannedItems.find((i) => i.id === itemId);
    if (!itemInfo) continue;

    const itemBarcodes = itemInfo.barcodes.map((b) => b.barcode);
    const entry = getOrCreateCandidate(
      itemId,
      itemInfo.name,
      itemInfo.category?.name ?? null,
      itemInfo.updated_at,
      itemBarcodes,
      0,
      null,
    );
    addTask(
      entry,
      "review_purchase_confirmation",
      `${lineCount} receipt line${lineCount > 1 ? "s" : ""} marked resolve later for purchase confirmation.`,
    );
    purchaseConfirmationCandidates++;
  }

  // -- Process source 3: unresolved shopping pairing leftovers ----------------
  // Group unresolved shopping items by inventory_item_id (if linked) or by
  // scanned_barcode -> inventory item mapping
  const shoppingIssuesByItemId = new Map<string, { count: number; reasons: string[] }>();
  for (const ssi of unresolvedShoppingItems) {
    // Try to attribute to an inventory item
    let targetItemId = ssi.inventory_item_id;

    // If no direct link but has a barcode, try to find the item via scannedItems
    if (!targetItemId && ssi.scanned_barcode) {
      const itemWithBarcode = scannedItems.find((item) =>
        item.barcodes.some((b) => b.barcode === ssi.scanned_barcode),
      );
      targetItemId = itemWithBarcode?.id ?? null;
    }

    if (!targetItemId) continue; // Cannot attribute to specific inventory item

    const existing = shoppingIssuesByItemId.get(targetItemId) ?? { count: 0, reasons: [] };
    existing.count++;
    const storeName = ssi.session?.store_name ?? "a store";
    if (ssi.scanned_barcode && !ssi.inventory_item_id) {
      existing.reasons.push(`Barcode ${ssi.scanned_barcode} scanned at ${storeName} was never linked to inventory.`);
    } else if (ssi.reconciliation_status === "missing_on_receipt") {
      existing.reasons.push(`Staged item at ${storeName} was not found on the receipt.`);
    } else if (ssi.reconciliation_status === "extra_on_receipt") {
      existing.reasons.push(`Receipt item at ${storeName} had no staged match.`);
    }
    shoppingIssuesByItemId.set(targetItemId, existing);
  }

  for (const [itemId, issue] of shoppingIssuesByItemId) {
    const itemInfo = scannedItems.find((i) => i.id === itemId);
    if (!itemInfo) continue;

    const itemBarcodes = itemInfo.barcodes.map((b) => b.barcode);
    const entry = getOrCreateCandidate(
      itemId,
      itemInfo.name,
      itemInfo.category?.name ?? null,
      itemInfo.updated_at,
      itemBarcodes,
      0,
      null,
    );
    addTask(
      entry,
      "resolve_shopping_pairing",
      issue.reasons[0] ?? `${issue.count} unresolved shopping pairing issue${issue.count > 1 ? "s" : ""}.`,
    );
    shoppingPairingCandidates++;
  }

  // -- Process source 4: normalization gaps (missing category on items without barcodes) --
  for (const item of itemsMissingCategory) {
    // Skip items already covered by barcode-based candidates
    if (candidateMap.has(item.id)) {
      // Already in the queue -- just ensure category task is present
      const entry = candidateMap.get(item.id)!;
      addTask(entry, "confirm_category", "Category is not assigned.");
      continue;
    }

    // Only add items that genuinely lack a category and have short/ambiguous names
    const isShortName = item.name.trim().length < 5;
    const entry = getOrCreateCandidate(
      item.id,
      item.name,
      null,
      item.updated_at,
      item.barcodes.map((b) => b.barcode),
      0,
      null,
    );
    addTask(entry, "confirm_category", "Category is not assigned.");
    if (isShortName) {
      addTask(entry, "confirm_brand_title_cleanup", "Item name is very short and may need clarification.");
    }
    normalizationGapCandidates++;
  }

  // -- Build final candidates list -------------------------------------------
  const candidates = Array.from(candidateMap.values()).filter(
    (c) => c.task_types.length > 0,
  );

  // Assign priority based on task types present
  for (const candidate of candidates) {
    const hasHigh = candidate.task_types.some(
      (t) => t === "review_barcode_resolution" || t === "resolve_shopping_pairing",
    );
    const hasMedium = candidate.task_types.some(
      (t) =>
        t === "add_product_photo" ||
        t === "confirm_size" ||
        t === "review_receipt_match" ||
        t === "review_purchase_confirmation",
    );
    candidate.priority = hasHigh ? "high" : hasMedium ? "medium" : "low";
  }

  const priorityRank: Record<InventoryEnrichmentQueueItem["priority"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  candidates.sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.updated_at.getTime() - a.updated_at.getTime();
  });

  const limitedItems = candidates.slice(0, opts?.resultLimit ?? 20);
  const taskTypeCounts = buildEmptyEnrichmentTaskCounts();

  let highPriority = 0;
  let mediumPriority = 0;
  let lowPriority = 0;
  for (const item of candidates) {
    if (item.priority === "high") highPriority += 1;
    else if (item.priority === "medium") mediumPriority += 1;
    else lowPriority += 1;

    for (const taskType of item.task_types) {
      taskTypeCounts[taskType] += 1;
    }
  }

  // -- Compute observability stats -------------------------------------------
  const allItemIds = new Set(candidates.map((c) => c.inventory_item_id));

  // Count items that appear in multiple candidate source buckets
  let multiSourceItems = 0;
  for (const candidate of candidates) {
    let sourceCount = 0;
    if (candidate.task_types.some((t) =>
      t === "review_barcode_resolution" || t === "add_product_photo" ||
      t === "confirm_size" || t === "confirm_brand_title_cleanup",
    )) sourceCount++;
    if (candidate.task_types.includes("review_receipt_match")) sourceCount++;
    if (candidate.task_types.includes("review_purchase_confirmation")) sourceCount++;
    if (candidate.task_types.includes("resolve_shopping_pairing")) sourceCount++;
    if (sourceCount > 1) multiSourceItems++;
  }

  // Oldest candidate age
  let oldestDate: Date | null = null;
  for (const c of candidates) {
    if (!oldestDate || c.updated_at < oldestDate) oldestDate = c.updated_at;
  }
  const oldestCandidateDays = oldestDate
    ? Math.floor((Date.now() - oldestDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const observability: EnrichmentQueueObservability = {
    candidate_sources: {
      barcode_metadata: barcodeMetadataCandidates,
      receipt_matching: receiptMatchingCandidates + orphanReceiptLines,
      purchase_confirmations: purchaseConfirmationCandidates,
      shopping_pairing: shoppingPairingCandidates,
      normalization_gaps: normalizationGapCandidates,
    },
    queue_health: {
      total_unique_items: allItemIds.size,
      multi_source_items: multiSourceItems,
      oldest_candidate_days: oldestCandidateDays,
    },
  };

  const result: InventoryEnrichmentQueueResult = {
    summary: {
      total_pending: candidates.length,
      high_priority: highPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority,
      task_type_counts: taskTypeCounts,
      scanned_items: scannedItems.length,
      items_with_barcodes: scannedItems.filter((item) => item.barcodes.length > 0).length,
      linked_catalog_rows: globalCatalogRows.length,
    },
    items: limitedItems,
    observability,
  };

  return serialize(result);
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
