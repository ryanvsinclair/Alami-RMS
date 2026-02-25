"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createInventoryItem, addBarcode, getInventoryItems } from "@/app/actions/core/inventory";

const UNIT_OPTIONS = [
  { value: "each", label: "Each" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "lb", label: "Pounds (lb)" },
  { value: "oz", label: "Ounces (oz)" },
  { value: "l", label: "Litres (L)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "gal", label: "Gallons" },
  { value: "case_unit", label: "Case" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
  { value: "dozen", label: "Dozen" },
];

interface ItemResult {
  id: string;
  name: string;
  unit: string;
  category?: { name: string } | null;
}

type Mode = "prompt" | "create" | "search";

export function ItemNotFound({
  detectedText,
  barcode,
  onItemSelected,
  onCancel,
  suggestedName,
}: {
  detectedText: string;
  barcode?: string;
  onItemSelected: (item: ItemResult) => void;
  onCancel: () => void;
  suggestedName?: string;
}) {
  const [mode, setMode] = useState<Mode>("prompt");
  const [newName, setNewName] = useState(suggestedName ?? detectedText);
  const [newUnit, setNewUnit] = useState("each");
  const [search, setSearch] = useState(suggestedName ?? detectedText);
  const [searchResults, setSearchResults] = useState<ItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    setError("");

    try {
      const item = await createInventoryItem({
        name: newName.trim(),
        unit: newUnit as never,
        barcodes: barcode ? [barcode] : undefined,
        aliases: detectedText ? [detectedText.toLowerCase().trim()] : undefined,
      });

      onItemSelected({
        id: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
      });
    } catch {
      setError("Failed to create item");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(query: string) {
    setSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await getInventoryItems({ search: query, activeOnly: true });
      setSearchResults(results as unknown as ItemResult[]);
    } catch {
      // silently fail search
    }
  }

  async function handleSelectExisting(item: ItemResult) {
    // If there's a barcode, link it to this item
    if (barcode) {
      try {
        await addBarcode(item.id, barcode);
      } catch {
        // barcode might already exist, that's fine
      }
    }
    onItemSelected(item);
  }

  return (
    <div className="space-y-4">
      {mode === "prompt" && (
        <>
          {/* Alert card */}
          <Card className="border-amber-400/35 bg-amber-500/12">
            <div className="flex gap-3">
              <div className="shrink-0">
                <svg className="w-6 h-6 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-amber-200">Item not in inventory</h3>
                <p className="text-sm text-amber-100/80 mt-0.5">
                  {detectedText ? (
                    <>
                      &ldquo;{detectedText}&rdquo; doesn&apos;t match any existing items.
                    </>
                  ) : (
                    <>This barcode isn&apos;t linked to any item yet.</>
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Button onClick={() => setMode("create")} className="w-full" size="lg">
            Add as New Item
          </Button>
          <Button variant="secondary" onClick={() => setMode("search")} className="w-full">
            Search Existing Items
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </>
      )}

      {mode === "create" && (
        <>
          <Card className="bg-white/5">
            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-2">New Inventory Item</p>
            <div className="space-y-3">
              <Input
                label="Item Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <Select
                label="Unit"
                options={UNIT_OPTIONS}
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              />
            </div>
          </Card>

          {barcode && (
            <p className="text-xs text-muted">
              Barcode <span className="font-mono">{barcode}</span> will be linked to this item.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button onClick={handleCreate} loading={loading} className="w-full" size="lg">
            Create &amp; Continue
          </Button>
          <Button variant="ghost" onClick={() => setMode("prompt")} className="w-full">
            Back
          </Button>
        </>
      )}

      {mode === "search" && (
        <>
          <Input
            label="Search Inventory"
            placeholder="Type to search..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {searchResults.map((item) => (
              <Card key={item.id} onClick={() => handleSelectExisting(item)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <div className="flex gap-1 mt-0.5">
                      <Badge variant="info">{item.unit}</Badge>
                      {item.category && <Badge>{item.category.name}</Badge>}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Card>
            ))}

            {search && searchResults.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No items found</p>
            )}
          </div>

          <Button variant="ghost" onClick={() => setMode("prompt")} className="w-full">
            Back
          </Button>
        </>
      )}
    </div>
  );
}
