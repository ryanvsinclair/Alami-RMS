"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getKitchenQueue,
  updateKitchenOrderItemStatus,
} from "@/app/actions/modules/table-service";
import {
  type KitchenOrderItemStatusContract,
  type TableServiceKitchenQueueEntry,
} from "@/features/table-service/shared";
import { ExitServiceModeButton } from "./ExitServiceModeButton";

interface KitchenQueuePageClientProps {
  initialQueue: TableServiceKitchenQueueEntry[];
}

type QueueItemsByCategoryGroup = {
  key: string;
  label: string;
  items: TableServiceKitchenQueueEntry["items"];
};

type KitchenQueueView = "active" | "completed";

function parseDateMs(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function getOverdueMinutesLabel(dueAt: string | null) {
  const dueAtMs = parseDateMs(dueAt);
  if (dueAtMs == null) return null;
  const diffMs = Date.now() - dueAtMs;
  if (diffMs <= 0) return null;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  return `${minutes}m overdue`;
}

function isCompletedKitchenOrder(entry: TableServiceKitchenQueueEntry) {
  if (entry.items.length === 0) return false;
  return entry.items.every((item) => item.status === "ready_to_serve");
}

// Kitchen-only cycle: preparing -> ready_to_serve -> cancelled -> preparing
const KITCHEN_CYCLE: KitchenOrderItemStatusContract[] = [
  "preparing",
  "ready_to_serve",
  "cancelled",
];

function cycleKitchenStatus(
  current: KitchenOrderItemStatusContract,
): KitchenOrderItemStatusContract {
  const idx = KITCHEN_CYCLE.indexOf(current);
  if (idx === -1) return "preparing";
  return KITCHEN_CYCLE[(idx + 1) % KITCHEN_CYCLE.length]!;
}

function itemRowClasses(
  status: KitchenOrderItemStatusContract,
  isUpdating: boolean,
  isReadOnly: boolean,
): string {
  const base = "w-full rounded-lg border px-3 py-2.5 transition-colors text-left";
  const interaction = isReadOnly
    ? " cursor-not-allowed pointer-events-none"
    : " cursor-pointer select-none";
  const updating = isUpdating ? " opacity-50 pointer-events-none" : "";
  if (status === "preparing") return `${base} border-amber-500/40 bg-amber-500/10${interaction}${updating}`;
  if (status === "ready_to_serve") return `${base} border-emerald-500/40 bg-emerald-500/10${interaction}${updating}`;
  if (status === "cancelled") return `${base} border-danger/40 bg-danger/10${interaction}${updating}`;
  return `${base} border-white/10 bg-white/5${interaction}${updating}`;
}

function itemStatusDot(status: KitchenOrderItemStatusContract): string {
  if (status === "preparing") return "bg-amber-400";
  if (status === "ready_to_serve") return "bg-emerald-400";
  if (status === "cancelled") return "bg-red-400";
  return "bg-white/30";
}

function itemStatusLabel(status: KitchenOrderItemStatusContract): string {
  if (status === "preparing") return "Preparing";
  if (status === "ready_to_serve") return "Ready";
  if (status === "cancelled") return "Cancelled";
  if (status === "pending") return "Pending";
  if (status === "served") return "Served";
  return status;
}

function groupQueueItemsByCategory(
  items: TableServiceKitchenQueueEntry["items"],
): QueueItemsByCategoryGroup[] {
  const groups = new Map<string, QueueItemsByCategoryGroup>();

  for (const item of items) {
    const categoryLabel = item.categoryName?.trim() || "No Category";
    const categoryKey = item.categoryId
      ? `id:${item.categoryId}`
      : `name:${categoryLabel.toLowerCase()}`;
    const existingGroup = groups.get(categoryKey);
    if (existingGroup) {
      existingGroup.items.push(item);
      continue;
    }
    groups.set(categoryKey, { key: categoryKey, label: categoryLabel, items: [item] });
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

export default function KitchenQueuePageClient({ initialQueue }: KitchenQueuePageClientProps) {
  const [queue, setQueue] = useState<TableServiceKitchenQueueEntry[]>(initialQueue);
  const [view, setView] = useState<KitchenQueueView>("active");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const activeQueue = useMemo(
    () => queue.filter((entry) => !isCompletedKitchenOrder(entry)),
    [queue],
  );
  const completedQueue = useMemo(
    () => queue.filter((entry) => isCompletedKitchenOrder(entry)),
    [queue],
  );
  const visibleQueue = view === "active" ? activeQueue : completedQueue;

  async function reloadQueue() {
    setRefreshing(true);
    try {
      const nextQueue = (await getKitchenQueue()) as TableServiceKitchenQueueEntry[];
      setQueue(nextQueue ?? []);
    } catch {
      alert("Failed to refresh kitchen queue.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleItemClick(
    kitchenOrderItemId: string,
    currentStatus: KitchenOrderItemStatusContract,
    options?: { readOnly?: boolean },
  ) {
    if (options?.readOnly) return;
    const nextStatus = cycleKitchenStatus(currentStatus);
    setUpdatingItemId(kitchenOrderItemId);
    try {
      await updateKitchenOrderItemStatus({ kitchenOrderItemId, status: nextStatus });
      await reloadQueue();
    } catch {
      alert("Failed to update item status.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <div className="design-glass-surface p-5 shrink-0 mx-4 mt-4 mb-4 md:mx-6 md:mt-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <Link href="/service/host" className="text-primary hover:underline">
                Host Workspace
              </Link>
              <Link href="/service/tables" className="text-primary hover:underline">
                Table Setup
              </Link>
            </div>
            <ExitServiceModeButton />
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Kitchen Queue</h1>
          </div>
          <button
            type="button"
            onClick={() => void reloadQueue()}
            disabled={refreshing}
            className="design-glass-ghost-button px-4 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`px-3 py-1.5 text-xs font-semibold ${
              view === "active" ? "design-glass-chip design-glass-chip-active" : "design-glass-chip"
            }`}
          >
            Active Queue ({activeQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setView("completed")}
            className={`px-3 py-1.5 text-xs font-semibold ${
              view === "completed"
                ? "design-glass-chip design-glass-chip-active"
                : "design-glass-chip"
            }`}
          >
            Completed Orders ({completedQueue.length})
          </button>
        </div>
      </div>

      {visibleQueue.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-4 md:px-6">
          <p className="text-sm text-muted px-1">
            {view === "active"
              ? "No active orders in queue."
              : "No completed ready-to-serve orders yet."}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full w-max min-w-full items-stretch gap-4 px-4 pt-2 pb-6 md:px-6">
            {visibleQueue.map((entry, index) => {
              const overdueLabel = getOverdueMinutesLabel(entry.dueAt);
              const groupedItems = groupQueueItemsByCategory(entry.items);
              const position = index + 1;
              const isReadOnlyOrder = view === "completed";

              return (
                <div
                  key={entry.orderId}
                  className="flex-none w-72 flex flex-col design-glass-surface [box-shadow:0_10px_28px_rgba(0,0,0,0.14)]"
                  style={{ height: "100%", overflow: "visible" }}
                >
                  <div className="px-4 pt-4 pb-3 border-b border-white/10">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                          #{position}
                        </p>
                        <p className="text-base font-bold text-foreground leading-tight mt-0.5">
                          {entry.tableNumber}
                        </p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] text-muted">{entry.itemCount} items</p>
                        {view === "active" && overdueLabel && (
                          <p className="text-[10px] font-semibold text-danger">{overdueLabel}</p>
                        )}
                      </div>
                    </div>
                    {entry.orderNotes && (
                      <p className="mt-2 text-[11px] text-muted italic">&ldquo;{entry.orderNotes}&rdquo;</p>
                    )}
                  </div>

                  <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
                    {groupedItems.map((group) => (
                      <div key={group.key} className="space-y-1.5">
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                          {group.label}
                        </p>
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              void handleItemClick(item.id, item.status, {
                                readOnly: isReadOnlyOrder,
                              })
                            }
                            disabled={updatingItemId === item.id || isReadOnlyOrder}
                            className={itemRowClasses(
                              item.status,
                              updatingItemId === item.id,
                              isReadOnlyOrder,
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm text-foreground truncate">
                                {item.menuItemName} x{item.quantity}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${itemStatusDot(item.status)}`} />
                                <span className="text-[10px] text-muted">{itemStatusLabel(item.status)}</span>
                              </span>
                            </div>
                            {item.notes && (
                              <p className="mt-1 text-[10px] text-muted">Note: {item.notes}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2 border-t border-dashed border-white/10">
                    <p className="text-[9px] uppercase tracking-widest text-muted/50 text-center">
                      {isReadOnlyOrder
                        ? "status locked in completed orders (update from host)"
                        : "tap item to cycle status"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
