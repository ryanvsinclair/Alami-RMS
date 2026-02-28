"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  createDiningTable,
  deleteDiningTable,
  getDiningTables,
  regenerateDiningTableQrToken,
  updateDiningTable,
} from "@/app/actions/modules/table-service";
import type { TableServiceDiningTableSummary } from "@/features/table-service/shared";

type DiningTable = TableServiceDiningTableSummary;

export default function TableSetupPageClient() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newTableNumber, setNewTableNumber] = useState("");
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableNumber, setEditingTableNumber] = useState("");

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
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

  async function handleRegenerateToken(tableId: string) {
    setSaving(true);
    setError("");
    try {
      await regenerateDiningTableQrToken(tableId);
      await loadTables();
    } catch {
      setError("Failed to regenerate QR token");
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
          Create tables and generate static scan tokens for `/scan/t/[token]`.
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
        <p className="text-sm font-semibold">Dining Tables ({sortedTables.length})</p>

        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : sortedTables.length === 0 ? (
          <p className="text-sm text-muted">No dining tables configured yet.</p>
        ) : (
          sortedTables.map((table) => {
            const scanUrl = origin ? `${origin}/scan/t/${table.qrToken}` : `/scan/t/${table.qrToken}`;
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
                        <p className="text-xs text-muted">Token: {table.qrToken}</p>
                      </div>
                      <div className="flex gap-2">
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
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRegenerateToken(table.id)}
                        loading={saving}
                      >
                        Regenerate Token
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
