"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { BarcodeCameraScanner } from "@/shared/ui/barcode-camera-scanner";
import {
  createDiningTable,
  deleteDiningTable,
  getDiningTables,
  updateDiningTable,
} from "@/app/actions/modules/table-service";
import type { TableServiceDiningTableSummary } from "@/features/table-service/shared";
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

export default function TableSetupPageClient() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newTableNumber, setNewTableNumber] = useState("");
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableNumber, setEditingTableNumber] = useState("");
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);
  const [qrScanValue, setQrScanValue] = useState("");
  const [qrScanError, setQrScanError] = useState("");
  const [startingFromScan, setStartingFromScan] = useState(false);

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(resolveTableQrOrigin());
  }, []);

  async function loadTables() {
    setLoading(true);
    try {
      const rows = (await getDiningTables()) as DiningTable[];
      setTables(rows ?? []);
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

  async function handleCreate() {
    if (!newTableNumber.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createDiningTable({ tableNumber: newTableNumber });
      setNewTableNumber("");
      await loadTables();
    } catch {
      setError("Failed to create dining table");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(tableId: string) {
    if (!editingTableNumber.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateDiningTable(tableId, { tableNumber: editingTableNumber });
      setEditingTableId(null);
      setEditingTableNumber("");
      await loadTables();
    } catch {
      setError("Failed to update dining table");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tableId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteDiningTable(tableId);
      await loadTables();
    } catch {
      setError("Failed to delete dining table");
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

  return (
    <div className="space-y-4 p-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted">Table Service</p>
          <Link href="/service/menu" className="text-xs font-semibold text-primary hover:underline">
            Manage Menu
          </Link>
        </div>
        <h1 className="mt-1 text-xl font-bold text-foreground">Dining Table Setup</h1>
        <p className="mt-2 text-sm text-muted">
          Create tables and generate QR codes for diners. Host scanners read the table number and open order-taking directly.
        </p>
      </Card>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Add Dining Table</p>
        <Input
          label="Table number"
          placeholder="Table 12"
          value={newTableNumber}
          onChange={(event) => setNewTableNumber(event.target.value)}
        />
        <Button onClick={handleCreate} loading={saving} disabled={!newTableNumber.trim()}>
          Add Table
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Scan Table QR (Built In)</p>
        <p className="text-sm text-muted">
          Use this device camera to read the table number and jump straight into host order-taking.
        </p>
        <BarcodeCameraScanner
          disabled={saving || loading || startingFromScan}
          triggerLabel="Scan Table QR With Camera"
          formats={["qr_code"]}
          helperText="Point your camera at a table QR code. We will read the table number and start host ordering."
          cancelLabel="Cancel QR Scanner"
          onDetected={(detectedValue) => {
            setQrScanValue(detectedValue);
            startHostOrderFromScanValue(detectedValue);
          }}
        />
        <Input
          label="Manual QR payload"
          placeholder="/r/[business]?table=Table 12"
          value={qrScanValue}
          onChange={(event) => {
            setQrScanValue(event.target.value);
            if (qrScanError) setQrScanError("");
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => startHostOrderFromScanValue(qrScanValue)}
          disabled={!qrScanValue.trim() || loading || startingFromScan}
          loading={startingFromScan}
        >
          Start Host Order
        </Button>
        {qrScanError && <p className="text-sm text-danger">{qrScanError}</p>}
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Dining Tables ({sortedTables.length})</p>

        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : sortedTables.length === 0 ? (
          <p className="text-sm text-muted">No dining tables configured yet.</p>
        ) : (
          sortedTables.map((table) => {
            const scanUrl = origin
              ? `${origin}/r/${encodeURIComponent(table.businessId)}?table=${encodeURIComponent(table.tableNumber)}`
              : `/r/${encodeURIComponent(table.businessId)}?table=${encodeURIComponent(table.tableNumber)}`;
            return (
              <div key={table.id} className="rounded-2xl border border-border p-3 space-y-2">
                {editingTableId === table.id ? (
                  <>
                    <Input
                      label="Table number"
                      value={editingTableNumber}
                      onChange={(event) => setEditingTableNumber(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(table.id)} loading={saving}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingTableId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{table.tableNumber}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => openHostOrderForTable(table.id)}
                        >
                          Take Order
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setQrTable(table)}
                        >
                          View QR
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingTableId(table.id);
                            setEditingTableNumber(table.tableNumber);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(table.id)}
                          loading={saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-xs text-muted">
                      {scanUrl}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(scanUrl);
                          } catch {
                            setError("Failed to copy scan URL");
                          }
                        }}
                      >
                        Copy Scan URL
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </Card>

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
  );
}
