"use client";

/**
 * Client-side persistent enrichment task dismissal hook.
 *
 * Uses localStorage to persist complete/defer/snooze decisions per queue item+task.
 * Schema-light: no DB table or migration required.
 * Server still derives the full queue; this hook filters out dismissed items client-side.
 */

import { useCallback, useMemo, useState } from "react";
import type {
  EnrichmentDismissalMap,
  EnrichmentTaskAction,
  EnrichmentTaskDismissal,
  InventoryEnrichmentQueueItem,
  InventoryEnrichmentQueueResult,
  InventoryEnrichmentTaskType,
} from "@/features/inventory/shared/enrichment-queue.contracts";
import { ENRICHMENT_SNOOZE_HOURS } from "@/features/inventory/shared/enrichment-queue.contracts";

// ---- LocalStorage helpers -----------------------------------------------

const STORAGE_KEY_PREFIX = "enrichment_dismissals";

function storageKey(businessId: string): string {
  return `${STORAGE_KEY_PREFIX}_${businessId}`;
}

function loadDismissals(businessId: string): EnrichmentDismissalMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    return raw ? (JSON.parse(raw) as EnrichmentDismissalMap) : {};
  } catch {
    return {};
  }
}

function saveDismissals(businessId: string, map: EnrichmentDismissalMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(businessId), JSON.stringify(map));
  } catch {
    // localStorage quota exceeded or unavailable -- fail silently
  }
}

function dismissalKey(
  inventoryItemId: string,
  taskType: InventoryEnrichmentTaskType,
): string {
  return `${inventoryItemId}:${taskType}`;
}

// ---- Active dismissal check ---------------------------------------------

function isDismissalActive(d: EnrichmentTaskDismissal): boolean {
  if (d.action === "complete" || d.action === "defer") return true;
  if (d.action === "snooze" && d.snooze_until) {
    return new Date(d.snooze_until).getTime() > Date.now();
  }
  return false;
}

// ---- Queue filtering ----------------------------------------------------

function filterQueueByDismissals(
  queue: InventoryEnrichmentQueueResult,
  dismissals: EnrichmentDismissalMap,
): InventoryEnrichmentQueueResult {
  const filteredItems: InventoryEnrichmentQueueItem[] = [];

  for (const item of queue.items) {
    const remainingTasks = item.task_types.filter((taskType) => {
      const key = dismissalKey(item.inventory_item_id, taskType);
      const d = dismissals[key];
      return !d || !isDismissalActive(d);
    });

    if (remainingTasks.length > 0) {
      const remainingReasons = item.reasons.filter((_, idx) => {
        // Reasons correspond 1:1 with task_types when lengths match
        if (idx < item.task_types.length) {
          const taskType = item.task_types[idx];
          const key = dismissalKey(item.inventory_item_id, taskType);
          const d = dismissals[key];
          return !d || !isDismissalActive(d);
        }
        return true;
      });

      filteredItems.push({
        ...item,
        task_types: remainingTasks,
        reasons:
          remainingReasons.length > 0 ? remainingReasons : [item.reasons[0]],
      });
    }
  }

  // Recompute summary counts from filtered items
  const taskTypeCounts = { ...queue.summary.task_type_counts };
  // Reset and recount from filtered
  for (const key of Object.keys(taskTypeCounts) as InventoryEnrichmentTaskType[]) {
    taskTypeCounts[key] = 0;
  }
  let highPriority = 0;
  let mediumPriority = 0;
  let lowPriority = 0;
  for (const item of filteredItems) {
    if (item.priority === "high") highPriority++;
    else if (item.priority === "medium") mediumPriority++;
    else lowPriority++;
    for (const t of item.task_types) {
      taskTypeCounts[t]++;
    }
  }

  return {
    summary: {
      ...queue.summary,
      total_pending: filteredItems.length,
      high_priority: highPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority,
      task_type_counts: taskTypeCounts,
    },
    items: filteredItems,
    observability: queue.observability,
  };
}

// ---- Hook ----------------------------------------------------------------

export interface UseEnrichmentDismissalsResult {
  /** Queue filtered by active dismissals (expired snoozes reappear) */
  filteredQueue: InventoryEnrichmentQueueResult | null;
  /** Dismiss a specific task on a specific item */
  dismissTask: (
    inventoryItemId: string,
    taskType: InventoryEnrichmentTaskType,
    action: EnrichmentTaskAction,
    snoozeHoursPreset?: keyof typeof ENRICHMENT_SNOOZE_HOURS,
  ) => void;
  /** Dismiss all tasks on an item at once */
  dismissAllTasks: (
    inventoryItemId: string,
    taskTypes: InventoryEnrichmentTaskType[],
    action: EnrichmentTaskAction,
    snoozeHoursPreset?: keyof typeof ENRICHMENT_SNOOZE_HOURS,
  ) => void;
  /** Undo a dismissal (restore a task) */
  undoDismissal: (
    inventoryItemId: string,
    taskType: InventoryEnrichmentTaskType,
  ) => void;
  /** Number of active dismissals */
  dismissedCount: number;
  /** Reset all dismissals (clear localStorage) */
  resetAll: () => void;
}

export function useEnrichmentDismissals(
  businessId: string | null,
  rawQueue: InventoryEnrichmentQueueResult | null,
): UseEnrichmentDismissalsResult {
  const [dismissals, setDismissals] = useState<EnrichmentDismissalMap>(() =>
    businessId ? loadDismissals(businessId) : {},
  );

  const persist = useCallback(
    (next: EnrichmentDismissalMap) => {
      setDismissals(next);
      if (businessId) saveDismissals(businessId, next);
    },
    [businessId],
  );

  const dismissTask = useCallback(
    (
      inventoryItemId: string,
      taskType: InventoryEnrichmentTaskType,
      action: EnrichmentTaskAction,
      snoozeHoursPreset?: keyof typeof ENRICHMENT_SNOOZE_HOURS,
    ) => {
      const key = dismissalKey(inventoryItemId, taskType);
      const now = new Date().toISOString();
      const snoozeUntil =
        action === "snooze" && snoozeHoursPreset
          ? new Date(
              Date.now() +
                ENRICHMENT_SNOOZE_HOURS[snoozeHoursPreset] * 60 * 60 * 1000,
            ).toISOString()
          : undefined;

      const entry: EnrichmentTaskDismissal = {
        inventory_item_id: inventoryItemId,
        task_type: taskType,
        action,
        dismissed_at: now,
        snooze_until: snoozeUntil,
      };

      const next = { ...dismissals, [key]: entry };
      persist(next);
    },
    [dismissals, persist],
  );

  const dismissAllTasks = useCallback(
    (
      inventoryItemId: string,
      taskTypes: InventoryEnrichmentTaskType[],
      action: EnrichmentTaskAction,
      snoozeHoursPreset?: keyof typeof ENRICHMENT_SNOOZE_HOURS,
    ) => {
      const now = new Date().toISOString();
      const snoozeUntil =
        action === "snooze" && snoozeHoursPreset
          ? new Date(
              Date.now() +
                ENRICHMENT_SNOOZE_HOURS[snoozeHoursPreset] * 60 * 60 * 1000,
            ).toISOString()
          : undefined;

      const next = { ...dismissals };
      for (const taskType of taskTypes) {
        const key = dismissalKey(inventoryItemId, taskType);
        next[key] = {
          inventory_item_id: inventoryItemId,
          task_type: taskType,
          action,
          dismissed_at: now,
          snooze_until: snoozeUntil,
        };
      }
      persist(next);
    },
    [dismissals, persist],
  );

  const undoDismissal = useCallback(
    (
      inventoryItemId: string,
      taskType: InventoryEnrichmentTaskType,
    ) => {
      const key = dismissalKey(inventoryItemId, taskType);
      const next = { ...dismissals };
      delete next[key];
      persist(next);
    },
    [dismissals, persist],
  );

  const resetAll = useCallback(() => {
    persist({});
  }, [persist]);

  const filteredQueue = useMemo(
    () => (rawQueue ? filterQueueByDismissals(rawQueue, dismissals) : null),
    [rawQueue, dismissals],
  );

  const dismissedCount = useMemo(
    () => Object.values(dismissals).filter(isDismissalActive).length,
    [dismissals],
  );

  return {
    filteredQueue,
    dismissTask,
    dismissAllTasks,
    undoDismissal,
    dismissedCount,
    resetAll,
  };
}
