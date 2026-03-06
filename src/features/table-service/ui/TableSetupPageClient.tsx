"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { BarcodeCameraScanner } from "@/shared/ui/barcode-camera-scanner";
import {
  createDiningTable,
  deleteDiningTable,
  getDiningTables,
  getKitchenQueue,
} from "@/app/actions/modules/table-service";
import type {
  TableServiceDiningTableSummary,
  TableServiceKitchenQueueEntry,
} from "@/features/table-service/shared";
import { TableQrModal } from "./TableQrModal";

type DiningTable = TableServiceDiningTableSummary;
const TABLE_QR_LOCAL_NETWORK_ORIGIN = "http://192.168.2.59:3000";

function resolveTableQrOrigin() {
  if (typeof window === "undefined") return TABLE_QR_LOCAL_NETWORK_ORIGIN;

  try {
    const currentOrigin = window.location.origin;
    const { hostname } = new URL(currentOrigin);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return TABLE_QR_LOCAL_NETWORK_ORIGIN;
    }
    return currentOrigin;
  } catch {
    return TABLE_QR_LOCAL_NETWORK_ORIGIN;
  }
}

function normalizeComparableTableNumber(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function resolveTableNumberFromScanValue(rawScanValue: string) {
  const value = rawScanValue.trim();
  if (!value) return null;

  const prefixedTableNumber = value.match(/^table\s*[:=]\s*(.+)$/i)?.[1]?.trim();
  if (prefixedTableNumber) {
    return prefixedTableNumber;
  }

  if (value.startsWith("/scan/t/") || value.startsWith("scan/t/")) {
    return null;
  }

  try {
    const parsed = new URL(
      value,
      typeof window !== "undefined" ? window.location.origin : TABLE_QR_LOCAL_NETWORK_ORIGIN,
    );
    const tableNumber =
      parsed.searchParams.get("table") ??
      parsed.searchParams.get("tableNumber") ??
      parsed.searchParams.get("t");

    if (tableNumber?.trim()) {
      return tableNumber.trim();
    }
  } catch {
    return value;
  }

  return value;
}

function getNumericTableSequence(tableNumber: string): number | null {
  const matches = tableNumber.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  const candidate = Number.parseInt(matches[matches.length - 1] ?? "", 10);
  if (!Number.isFinite(candidate) || candidate <= 0) return null;
  return candidate;
}

function resolveNextTableSequenceNumber(tables: DiningTable[]) {
  const highestNumericTable = tables.reduce((max, table) => {
    const numeric = getNumericTableSequence(table.tableNumber);
    if (numeric == null) return max;
    return Math.max(max, numeric);
  }, 0);

  const existing = new Set(
    tables.map((table) => normalizeComparableTableNumber(table.tableNumber)),
  );

  let next = highestNumericTable > 0 ? highestNumericTable + 1 : 1;
  while (existing.has(normalizeComparableTableNumber(`Table ${next}`))) {
    next += 1;
  }

  return next;
}

type QueueItemsByCategoryGroup = {
  key: string;
  label: string;
  items: TableServiceKitchenQueueEntry["items"];
};

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

    groups.set(categoryKey, {
      key: categoryKey,
      label: categoryLabel,
      items: [item],
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

export default function TableSetupPageClient() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [kitchenQueue, setKitchenQueue] = useState<TableServiceKitchenQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);

  const [qrScanError, setQrScanError] = useState("");
  const [takeOrderScanSignal, setTakeOrderScanSignal] = useState(0);
  const [startingFromScan, setStartingFromScan] = useState(false);

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(resolveTableQrOrigin());
  }, []);

  async function loadTables() {
    setLoading(true);
    try {
      const [rows, queueRows] = await Promise.all([
        getDiningTables(),
        getKitchenQueue(),
      ]);
      setTables((rows as DiningTable[]) ?? []);
      setKitchenQueue((queueRows as TableServiceKitchenQueueEntry[]) ?? []);
    } catch {
      setError("Failed to load dining tables");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTables();
  }, []);

  function openHostOrderForTable(tableId: string) {
    if (typeof window === "undefined") return;
    window.location.assign(`/service/host?table=${encodeURIComponent(tableId)}`);
  }

  function startHostOrderFromScanValue(rawScanValue: string) {
    const scannedTableNumber = resolveTableNumberFromScanValue(rawScanValue);
    if (!scannedTableNumber) {
      setQrScanError("QR payload is missing a table number. Regenerate this table QR code.");
      return;
    }

    const normalizedScannedTableNumber = normalizeComparableTableNumber(scannedTableNumber);
    const matchedTable =
      tables.find(
        (table) => normalizeComparableTableNumber(table.tableNumber) === normalizedScannedTableNumber,
      ) ?? null;

    if (!matchedTable) {
      setQrScanError(`No configured table matches "${scannedTableNumber}".`);
      return;
    }

    setQrScanError("");
    setStartingFromScan(true);
    openHostOrderForTable(matchedTable.id);
  }

  async function handleAddNextTable() {
    setSaving(true);
    setError("");
    try {
      const nextTableNumber = resolveNextTableSequenceNumber(tables);
      await createDiningTable({ tableNumber: `Table ${nextTableNumber}` });
      await loadTables();
    } catch {
      setError("Failed to add dining table");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tableId: string) {
    const activeQueueEntry = queueByTableId.get(tableId);
    if (activeQueueEntry) {
      setError("Cannot delete a table with an active confirmed order. Close the order first.");
      return;
    }

    const table = tables.find((entry) => entry.id === tableId);
    const confirmed = window.confirm(
      `Delete ${table?.tableNumber ?? "this table"}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await deleteDiningTable(tableId);
      await loadTables();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete dining table",
      );
    } finally {
      setSaving(false);
    }
  }

  const sortedTables = useMemo(
    () =>
      [...tables].sort((a, b) =>
        a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }),
      ),
    [tables],
  );

  const nextTableSequence = useMemo(
    () => resolveNextTableSequenceNumber(tables),
    [tables],
  );

  const queueByTableId = useMemo(() => {
    const next = new Map<string, TableServiceKitchenQueueEntry>();
    for (const entry of kitchenQueue) {
      next.set(entry.tableId, entry);
    }
    return next;
  }, [kitchenQueue]);

  return (
    <div className="min-h-screen py-4 md:py-6">
      <div className="mx-auto max-w-7xl space-y-4 px-4 md:px-6">
        <header className="design-glass-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Table Service</p>
              <h1 className="mt-1 text-xl font-bold text-foreground">Dining Table Setup</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setQrScanError("");
                  setTakeOrderScanSignal((current) => current + 1);
                }}
                disabled={loading || saving}
                className="design-glass-ghost-button px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Scan QR
              </button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddNextTable}
                loading={saving}
                disabled={loading || saving}
              >
                Add Table #{nextTableSequence}
              </Button>
              <Link href="/service/menu" className="text-xs font-semibold text-primary hover:underline">
                Manage Menu
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="max-w-xl">
          <BarcodeCameraScanner
            showTrigger={false}
            startSignal={takeOrderScanSignal}
            disabled={saving || loading || startingFromScan}
            formats={["qr_code"]}
            helperText="Point your camera at a table QR code. We will read the table number and start host ordering."
            cancelLabel="Cancel QR Scanner"
            onDetected={(detectedValue) => {
              startHostOrderFromScanValue(detectedValue);
            }}
          />
          {qrScanError && <p className="mt-2 text-sm text-danger">{qrScanError}</p>}
        </div>

        <section className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Dining Tables ({sortedTables.length})</p>

          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : sortedTables.length === 0 ? (
            <div className="design-glass-surface p-5">
              <p className="text-sm text-muted">No dining tables configured yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedTables.map((table) => {
                const queueEntry = queueByTableId.get(table.id) ?? null;
                const hasConfirmedOrder = Boolean(queueEntry);
                const groupedQueueItems =
                  queueEntry && queueEntry.items.length > 0
                    ? groupQueueItemsByCategory(queueEntry.items)
                    : [];

                return (
                  <div key={table.id} className="design-glass-surface space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{table.tableNumber}</p>
                      {hasConfirmedOrder ? (
                        <span
                          title="Order confirmed"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openHostOrderForTable(table.id)}
                        >
                          Take Order
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted">Order List</p>
                      {groupedQueueItems.length > 0 ? (
                        <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2">
                          {groupedQueueItems.map((group) => (
                            <div key={`${table.id}-${group.key}`} className="space-y-1.5">
                              <p className="px-1 text-[11px] font-semibold text-muted">
                                {group.label}
                              </p>
                              {group.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs"
                                >
                                  <span className="truncate text-foreground">{item.menuItemName}</span>
                                  <span className="shrink-0 text-muted">×{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-xs text-muted">
                          No confirmed order yet.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label="View QR"
                        title="View QR"
                        onClick={() => setQrTable(table)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-foreground transition-colors hover:bg-white/10"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm12 0h4m-4 4h4m-4-8v2m4 6v2" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Edit Order"
                        title={hasConfirmedOrder ? "Edit/append confirmed order" : "No confirmed order to edit"}
                        onClick={() => {
                          if (!hasConfirmedOrder) return;
                          openHostOrderForTable(table.id);
                        }}
                        disabled={!hasConfirmedOrder}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-foreground transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7V3Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 16l5-5 2 2-5 5H9v-2Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete Table"
                        title={hasConfirmedOrder ? "Cannot delete table with active confirmed order" : "Delete table"}
                        onClick={() => void handleDelete(table.id)}
                        disabled={hasConfirmedOrder || saving}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-danger/40 bg-danger/15 text-danger transition-colors hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5h6v2m-8 0 1 12h8l1-12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {qrTable && origin && (
          <TableQrModal
            tableNumber={qrTable.tableNumber}
            scanUrl={`${origin}/r/${encodeURIComponent(qrTable.businessId)}?table=${encodeURIComponent(
              qrTable.tableNumber,
            )}`}
            onClose={() => setQrTable(null)}
          />
        )}
      </div>
    </div>
  );
}
