"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getKitchenQueue,
  updateKitchenOrderItemStatus,
} from "@/app/actions/modules/table-service";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Select } from "@/shared/ui/select";
import {
  KITCHEN_ORDER_ITEM_STATUSES,
  type KitchenOrderItemStatusContract,
  type TableServiceKitchenQueueEntry,
} from "@/features/table-service/shared";
import { ExitServiceModeButton } from "./ExitServiceModeButton";

interface KitchenQueuePageClientProps {
  initialQueue: TableServiceKitchenQueueEntry[];
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString();
}

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

function toStatusLabel(status: KitchenOrderItemStatusContract) {
  return status.replace(/_/g, " ");
}

export default function KitchenQueuePageClient({ initialQueue }: KitchenQueuePageClientProps) {
  const [queue, setQueue] = useState<TableServiceKitchenQueueEntry[]>(initialQueue);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const statusOptions = useMemo(
    () =>
      KITCHEN_ORDER_ITEM_STATUSES.map((status) => ({
        value: status,
        label: toStatusLabel(status),
      })),
    [],
  );

  async function reloadQueue() {
    setRefreshing(true);
    try {
      const nextQueue = (await getKitchenQueue()) as TableServiceKitchenQueueEntry[];
      setQueue(nextQueue ?? []);
    } catch {
      setError("Failed to refresh kitchen queue.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleStatusChange(
    kitchenOrderItemId: string,
    nextStatus: KitchenOrderItemStatusContract,
  ) {
    setError("");
    setUpdatingItemId(kitchenOrderItemId);
    try {
      await updateKitchenOrderItemStatus({
        kitchenOrderItemId,
        status: nextStatus,
      });
      await reloadQueue();
    } catch {
      setError("Failed to update item status.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-4 pt-8 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted">Kitchen Workspace</p>
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
        <h1 className="mt-1 text-xl font-bold text-foreground">Kitchen Queue</h1>
        <p className="mt-2 text-sm text-muted">
          FIFO by confirmation time. Orders are rendered oldest confirmed first.
        </p>
      </Card>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Active Queue ({queue.length})</p>
          <Button size="sm" variant="secondary" onClick={() => void reloadQueue()} loading={refreshing}>
            Refresh
          </Button>
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-muted">No confirmed orders in queue.</p>
        ) : (
          queue.map((entry, index) => {
            const overdueLabel = getOverdueMinutesLabel(entry.dueAt);

            return (
              <div
                key={entry.orderId}
                className={`rounded-2xl border p-4 space-y-3 ${
                  overdueLabel ? "border-danger/40 bg-danger/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">
                      Queue Position {index + 1}
                    </p>
                    <p className="text-lg font-semibold text-foreground">{entry.tableNumber}</p>
                    <p className="text-xs text-muted">Order ID: {entry.orderId}</p>
                  </div>
                  <div className="text-right text-xs text-muted space-y-1">
                    <p>Confirmed: {formatDateTime(entry.confirmedAt)}</p>
                    <p>Due: {formatDateTime(entry.dueAt)}</p>
                    {overdueLabel && <p className="font-semibold text-danger">{overdueLabel}</p>}
                    <p>Items: {entry.itemCount}</p>
                  </div>
                </div>

                {entry.orderNotes && (
                  <p className="text-sm text-muted">Notes: {entry.orderNotes}</p>
                )}

                <div className="rounded-2xl border border-border bg-foreground/[0.03] px-4 py-3 text-sm text-muted space-y-3">
                  {entry.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/80 bg-card/30 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {item.menuItemName} x{item.quantity}
                          </p>
                          <p className="text-xs text-muted">
                            Current status: {toStatusLabel(item.status)}
                          </p>
                          {item.notes && <p className="text-xs text-muted">Notes: {item.notes}</p>}
                        </div>
                      </div>
                      <Select
                        label="Set status"
                        options={statusOptions}
                        value={item.status}
                        onChange={(event) =>
                          void handleStatusChange(
                            item.id,
                            event.target.value as KitchenOrderItemStatusContract,
                          )
                        }
                        disabled={updatingItemId === item.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </main>
  );
}
