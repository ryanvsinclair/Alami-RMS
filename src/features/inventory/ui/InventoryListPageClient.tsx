"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { getAllInventoryLevels } from "@/app/actions/core/transactions";
import { getInventoryEnrichmentQueue } from "@/app/actions/core/inventory";
import type {
  InventoryEnrichmentQueueItem,
  InventoryEnrichmentQueueResult,
  InventoryEnrichmentTaskType,
} from "@/features/inventory/shared/enrichment-queue.contracts";
import { useEnrichmentDismissals } from "./use-enrichment-dismissals";

interface InventoryLevel {
  id: string;
  name: string;
  unit: string;
  category: { name: string } | null;
  supplier: { name: string } | null;
  current_quantity: number;
  transaction_count: number;
  last_transaction_at: Date | null;
}

const enrichmentTaskLabel: Record<InventoryEnrichmentTaskType, string> = {
  review_barcode_resolution: "Review barcode",
  add_product_photo: "Add photo",
  confirm_size: "Confirm size",
  confirm_category: "Confirm category",
  confirm_brand_title_cleanup: "Title/brand cleanup",
  review_receipt_match: "Review receipt match",
  resolve_shopping_pairing: "Shopping pairing",
};

export default function InventoryListPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryLevel[]>([]);
  const [rawQueue, setRawQueue] = useState<InventoryEnrichmentQueueResult | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const {
    filteredQueue: enrichmentQueue,
    dismissTask,
    dismissAllTasks,
    undoDismissal,
    dismissedCount,
    resetAll,
  } = useEnrichmentDismissals("default", rawQueue);

  // Track the last dismissed item for undo toast
  const [lastDismissed, setLastDismissed] = useState<{
    inventoryItemId: string;
    taskType: InventoryEnrichmentTaskType;
    itemName: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [inventoryLevels, queue] = await Promise.all([
        getAllInventoryLevels(),
        getInventoryEnrichmentQueue({ resultLimit: 10 }),
      ]);
      setItems(inventoryLevels as InventoryLevel[]);
      setRawQueue(queue as InventoryEnrichmentQueueResult);
      setLoading(false);
    }
    load();
  }, []);

  const handleDismissTask = useCallback(
    (candidate: InventoryEnrichmentQueueItem, taskType: InventoryEnrichmentTaskType, action: "complete" | "defer" | "snooze") => {
      dismissTask(candidate.inventory_item_id, taskType, action, action === "snooze" ? "short" : undefined);
      setLastDismissed({
        inventoryItemId: candidate.inventory_item_id,
        taskType,
        itemName: candidate.inventory_item_name,
      });
      // Auto-clear undo toast after 5s
      setTimeout(() => setLastDismissed(null), 5000);
    },
    [dismissTask],
  );

  const handleDismissAll = useCallback(
    (candidate: InventoryEnrichmentQueueItem, action: "complete" | "defer" | "snooze") => {
      dismissAllTasks(
        candidate.inventory_item_id,
        candidate.task_types,
        action,
        action === "snooze" ? "short" : undefined,
      );
      setExpandedItemId(null);
    },
    [dismissAllTasks],
  );

  const handleUndo = useCallback(() => {
    if (lastDismissed) {
      undoDismissal(lastDismissed.inventoryItemId, lastDismissed.taskType);
      setLastDismissed(null);
    }
  }, [lastDismissed, undoDismissal]);

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      {/* Fix Later Queue Card */}
      {enrichmentQueue && enrichmentQueue.summary.total_pending > 0 && (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Fix Later Queue</p>
              <p className="text-xs text-muted mt-1">
                Optional metadata cleanup suggestions. Intake stays non-blocking.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {dismissedCount > 0 && (
                <button
                  onClick={resetAll}
                  className="text-xs text-blue-600 underline"
                  type="button"
                >
                  Show {dismissedCount} dismissed
                </button>
              )}
              <Badge variant={enrichmentQueue.summary.high_priority > 0 ? "warning" : "default"}>
                {enrichmentQueue.summary.total_pending} pending
              </Badge>
            </div>
          </div>

          {/* Task type summary badges */}
          <div className="flex flex-wrap gap-1 mt-3">
            {enrichmentQueue.summary.high_priority > 0 && (
              <Badge variant="danger">{enrichmentQueue.summary.high_priority} high</Badge>
            )}
            {enrichmentQueue.summary.task_type_counts.add_product_photo > 0 && (
              <Badge variant="info">
                {enrichmentQueue.summary.task_type_counts.add_product_photo} photo
              </Badge>
            )}
            {enrichmentQueue.summary.task_type_counts.confirm_size > 0 && (
              <Badge variant="warning">
                {enrichmentQueue.summary.task_type_counts.confirm_size} size
              </Badge>
            )}
            {enrichmentQueue.summary.task_type_counts.confirm_category > 0 && (
              <Badge>
                {enrichmentQueue.summary.task_type_counts.confirm_category} category
              </Badge>
            )}
            {enrichmentQueue.summary.task_type_counts.review_receipt_match > 0 && (
              <Badge variant="warning">
                {enrichmentQueue.summary.task_type_counts.review_receipt_match} receipt
              </Badge>
            )}
            {enrichmentQueue.summary.task_type_counts.resolve_shopping_pairing > 0 && (
              <Badge variant="danger">
                {enrichmentQueue.summary.task_type_counts.resolve_shopping_pairing} shopping
              </Badge>
            )}
          </div>

          {/* Observability stats (collapsible) */}
          {enrichmentQueue.observability && (
            <div className="mt-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="text-xs text-muted underline"
                type="button"
              >
                {showStats ? "Hide stats" : "Queue stats"}
              </button>
              {showStats && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
                  <span>Barcode sources:</span>
                  <span>{enrichmentQueue.observability.candidate_sources.barcode_metadata}</span>
                  <span>Receipt sources:</span>
                  <span>{enrichmentQueue.observability.candidate_sources.receipt_matching}</span>
                  <span>Shopping sources:</span>
                  <span>{enrichmentQueue.observability.candidate_sources.shopping_pairing}</span>
                  <span>Normalization gaps:</span>
                  <span>{enrichmentQueue.observability.candidate_sources.normalization_gaps}</span>
                  <span>Unique items:</span>
                  <span>{enrichmentQueue.observability.queue_health.total_unique_items}</span>
                  <span>Multi-source items:</span>
                  <span>{enrichmentQueue.observability.queue_health.multi_source_items}</span>
                  {enrichmentQueue.observability.queue_health.oldest_candidate_days != null && (
                    <>
                      <span>Oldest candidate:</span>
                      <span>{enrichmentQueue.observability.queue_health.oldest_candidate_days}d ago</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Queue items with action controls */}
          <div className="mt-3 space-y-2">
            {enrichmentQueue.items.map((candidate) => {
              const isExpanded = expandedItemId === candidate.inventory_item_id;
              return (
                <Card key={candidate.inventory_item_id}>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => router.push(`/inventory/${candidate.inventory_item_id}`)}
                    >
                      <p className="font-medium truncate">{candidate.inventory_item_name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {candidate.category_name && <Badge>{candidate.category_name}</Badge>}
                        {candidate.task_types.slice(0, 3).map((taskType) => (
                          <Badge key={taskType} variant="info">
                            {enrichmentTaskLabel[taskType]}
                          </Badge>
                        ))}
                        {candidate.task_types.length > 3 && (
                          <Badge variant="default">+{candidate.task_types.length - 3}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1 truncate">
                        {candidate.reasons[0]}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant={
                          candidate.priority === "high"
                            ? "danger"
                            : candidate.priority === "medium"
                              ? "warning"
                              : "default"
                        }
                      >
                        {candidate.priority}
                      </Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedItemId(isExpanded ? null : candidate.inventory_item_id);
                        }}
                        className="text-xs text-blue-600 underline mt-1"
                        type="button"
                      >
                        {isExpanded ? "Hide actions" : "Actions"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded action panel */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {/* Per-task actions */}
                      {candidate.task_types.length > 1 && (
                        <div className="space-y-2 mb-3">
                          <p className="text-xs font-medium text-muted">Per-task actions:</p>
                          {candidate.task_types.map((taskType) => (
                            <div key={taskType} className="flex items-center justify-between gap-2">
                              <span className="text-xs truncate">{enrichmentTaskLabel[taskType]}</span>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleDismissTask(candidate, taskType, "complete")}
                                >
                                  Done
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismissTask(candidate, taskType, "snooze")}
                                >
                                  Snooze
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismissTask(candidate, taskType, "defer")}
                                >
                                  Skip
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bulk actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleDismissAll(candidate, "complete")}
                        >
                          Mark all done
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDismissAll(candidate, "snooze")}
                        >
                          Snooze all (24h)
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismissAll(candidate, "defer")}
                        >
                          Skip all
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      {/* Undo toast */}
      {lastDismissed && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
          <span className="truncate max-w-[200px]">
            Dismissed task for {lastDismissed.itemName}
          </span>
          <button
            onClick={handleUndo}
            className="text-blue-300 underline shrink-0"
            type="button"
          >
            Undo
          </button>
        </div>
      )}

      <Input
        placeholder="Search inventory..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-center py-8 text-muted text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm">
          {items.length === 0 ? "No inventory items yet" : "No items match your search"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id} onClick={() => router.push(`/inventory/${item.id}`)}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {item.category && <Badge>{item.category.name}</Badge>}
                    {item.supplier && <Badge variant="info">{item.supplier.name}</Badge>}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-lg font-semibold">{item.current_quantity}</p>
                  <p className="text-xs text-muted">{item.unit}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
