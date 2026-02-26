"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { getAllInventoryLevels } from "@/app/actions/core/transactions";

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

export default function InventoryListPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryLevel[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const data = await getAllInventoryLevels();
      setItems(data as InventoryLevel[]);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
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
