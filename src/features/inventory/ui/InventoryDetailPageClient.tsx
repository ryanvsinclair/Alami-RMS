"use client";

import { useState, useEffect, use } from "react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { getInventoryItem } from "@/app/actions/core/inventory";
import { getTransactionsForItem, getInventoryLevel } from "@/app/actions/core/transactions";

interface ItemDetail {
  id: string;
  name: string;
  unit: string;
  default_cost: number | string | null;
  par_level: number | string | null;
  is_active: boolean;
  category: { name: string } | null;
  supplier: { name: string } | null;
  barcodes: { id: string; barcode: string }[];
  aliases: { id: string; alias_text: string; source: string | null }[];
}

interface Transaction {
  id: string;
  transaction_type: string;
  quantity: number | string;
  unit: string;
  unit_cost: number | string | null;
  input_method: string;
  source: string | null;
  created_at: string;
}

const methodColors: Record<string, "info" | "success" | "warning" | "default"> = {
  barcode: "info",
  receipt: "success",
  photo: "warning",
  manual: "default",
  shopping: "info",
};

export default function InventoryDetailPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [level, setLevel] = useState<{ current_quantity: number; transaction_count: number } | null>(
    null
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [itemData, levelData, txData] = await Promise.all([
        getInventoryItem(id),
        getInventoryLevel(id),
        getTransactionsForItem(id, 20),
      ]);
      setItem(itemData as ItemDetail);
      setLevel(levelData);
      setTransactions(txData as Transaction[]);
      setLoading(false);
    }
    fetch();
  }, [id]);

  if (loading) {
    return <div className="p-4 text-center text-muted text-sm">Loading item...</div>;
  }

  if (!item) {
    return <div className="p-4 text-center text-muted text-sm">Item not found</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="text-center">
          <p className="text-3xl font-bold">{level?.current_quantity ?? 0}</p>
          <p className="text-muted text-sm">{item.unit} in stock</p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Category</span>
            <span>{item.category?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Supplier</span>
            <span>{item.supplier?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Default Cost</span>
            <span>{item.default_cost ? `$${Number(item.default_cost).toFixed(2)}` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Par Level</span>
            <span>{item.par_level ? `${item.par_level} ${item.unit}` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Status</span>
            <Badge variant={item.is_active ? "success" : "danger"}>
              {item.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </Card>

      {item.barcodes.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
            Barcodes
          </h3>
          <div className="flex flex-wrap gap-1">
            {item.barcodes.map((b) => (
              <Badge key={b.id} variant="info">
                {b.barcode}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {item.aliases.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
            Known Aliases ({item.aliases.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {item.aliases.map((a) => (
              <Badge key={a.id}>
                {a.alias_text}
                {a.source && <span className="ml-1 opacity-60">({a.source})</span>}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
          Recent Transactions ({level?.transaction_count ?? 0} total)
        </h3>
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Card key={tx.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{tx.transaction_type}</span>
                    <Badge variant={methodColors[tx.input_method] ?? "default"}>
                      {tx.input_method}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString()} — {tx.source ?? "unknown source"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      Number(tx.quantity) >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {Number(tx.quantity) >= 0 ? "+" : ""}
                    {Number(tx.quantity)} {tx.unit}
                  </p>
                  {tx.unit_cost && (
                    <p className="text-xs text-muted">${Number(tx.unit_cost).toFixed(2)}/unit</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {transactions.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
