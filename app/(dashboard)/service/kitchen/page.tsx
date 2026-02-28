import Link from "next/link";
import { Card } from "@/shared/ui/card";
import {
  getKitchenQueue,
  requireTableServiceAccess,
} from "@/features/table-service/server";
import type { TableServiceKitchenQueueEntry } from "@/features/table-service/shared";

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString();
}

export default async function TableServiceKitchenPage() {
  const { businessId } = await requireTableServiceAccess();
  const queue = (await getKitchenQueue(businessId)) as TableServiceKitchenQueueEntry[];

  return (
    <main className="mx-auto max-w-4xl p-4 pt-8 space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted">Kitchen Workspace</p>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <Link href="/service/host" className="text-primary hover:underline">
              Host Workspace
            </Link>
            <Link href="/service/tables" className="text-primary hover:underline">
              Table Setup
            </Link>
          </div>
        </div>
        <h1 className="mt-1 text-xl font-bold text-foreground">Kitchen Queue</h1>
        <p className="mt-2 text-sm text-muted">
          FIFO by confirmation time. Orders are rendered oldest confirmed first.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Active Queue ({queue.length})</p>
        {queue.length === 0 ? (
          <p className="text-sm text-muted">No confirmed orders in queue.</p>
        ) : (
          queue.map((entry, index) => (
            <div key={entry.orderId} className="rounded-2xl border border-border p-4 space-y-3">
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
                  <p>Items: {entry.itemCount}</p>
                </div>
              </div>

              {entry.orderNotes && (
                <p className="text-sm text-muted">Notes: {entry.orderNotes}</p>
              )}

              <div className="rounded-2xl border border-border bg-foreground/[0.03] px-4 py-3 text-sm text-muted space-y-1">
                {entry.items.map((item) => (
                  <p key={item.id}>
                    {item.menuItemName} x{item.quantity} ({item.status})
                    {item.notes ? ` - ${item.notes}` : ""}
                  </p>
                ))}
              </div>
            </div>
          ))
        )}
      </Card>
    </main>
  );
}
