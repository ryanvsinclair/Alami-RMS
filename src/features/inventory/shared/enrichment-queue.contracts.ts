/**
 * Client-safe/shared contracts for the Inventory "Fix Later" enrichment queue.
 * These types/constants are used by both server derivation code and client UI hooks.
 */

export type InventoryEnrichmentTaskType =
  | "review_barcode_resolution"
  | "add_product_photo"
  | "confirm_size"
  | "confirm_category"
  | "confirm_brand_title_cleanup"
  | "review_receipt_match"
  | "review_purchase_confirmation"
  | "resolve_shopping_pairing";

/** Actions a user can take on a queue item/task. */
export type EnrichmentTaskAction = "complete" | "defer" | "snooze";

/**
 * Client-side persistent dismissal record for a single enrichment task.
 * Stored in localStorage keyed by `enrichment_dismissals_<businessId>`.
 * No schema/migration required.
 */
export interface EnrichmentTaskDismissal {
  inventory_item_id: string;
  task_type: InventoryEnrichmentTaskType;
  action: EnrichmentTaskAction;
  /** ISO timestamp when the action was taken */
  dismissed_at: string;
  /** For snooze: ISO timestamp when the snooze expires */
  snooze_until?: string;
}

/**
 * Serializable dismissal map stored in localStorage.
 * Key format: `<inventory_item_id>:<task_type>`
 */
export type EnrichmentDismissalMap = Record<string, EnrichmentTaskDismissal>;

/** Snooze duration presets (in hours) */
export const ENRICHMENT_SNOOZE_HOURS = {
  short: 24,
  medium: 72,
  long: 168, // 1 week
} as const;

export interface InventoryEnrichmentQueueItem {
  inventory_item_id: string;
  inventory_item_name: string;
  category_name: string | null;
  priority: "high" | "medium" | "low";
  task_types: InventoryEnrichmentTaskType[];
  reasons: string[];
  barcodes: string[];
  linked_catalog_count: number;
  updated_at: Date;
  last_catalog_update_at: Date | null;
}

/** Observability stats for the enrichment queue -- sources and throughput context. */
export interface EnrichmentQueueObservability {
  /** Number of candidate sources that contributed to the queue */
  candidate_sources: {
    barcode_metadata: number;
    receipt_matching: number;
    purchase_confirmations: number;
    shopping_pairing: number;
    normalization_gaps: number;
  };
  /** Summary stats for queue health */
  queue_health: {
    /** Total unique inventory items across all candidate sources */
    total_unique_items: number;
    /** Items appearing in multiple candidate sources */
    multi_source_items: number;
    /** Oldest unresolved candidate age in days (null if none) */
    oldest_candidate_days: number | null;
  };
}

export interface InventoryEnrichmentQueueResult {
  summary: {
    total_pending: number;
    high_priority: number;
    medium_priority: number;
    low_priority: number;
    task_type_counts: Record<InventoryEnrichmentTaskType, number>;
    scanned_items: number;
    items_with_barcodes: number;
    linked_catalog_rows: number;
  };
  items: InventoryEnrichmentQueueItem[];
  observability: EnrichmentQueueObservability;
}
