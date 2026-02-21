"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ingestManual } from "@/app/actions/ingestion";
import { getInventoryItems } from "@/app/actions/inventory";
import type { UnitType } from "@/lib/generated/prisma/client";

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

interface ItemOption {
  id: string;
  name: string;
  unit: string;
  category?: { name: string } | null;
}

type Step = "search" | "form" | "success";

export default function ManualEntryPage() {
  const [step, setStep] = useState<Step>("search");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  // Form fields
  const [newItemName, setNewItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<string>("each");
  const [unitCost, setUnitCost] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchItems() {
      const result = await getInventoryItems({
        search: search || undefined,
        activeOnly: true,
      });
      setItems(result as ItemOption[]);
    }
    const timeout = setTimeout(fetchItems, 200);
    return () => clearTimeout(timeout);
  }, [search]);

  function selectExistingItem(item: ItemOption) {
    setSelectedItem(item);
    setUnit(item.unit);
    setIsNewItem(false);
    setStep("form");
  }

  function createNew() {
    setSelectedItem(null);
    setNewItemName(search);
    setIsNewItem(true);
    setStep("form");
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const result = await ingestManual({
        inventory_item_id: isNewItem ? undefined : selectedItem?.id,
        new_item: isNewItem
          ? { name: newItemName, unit: unit as UnitType }
          : undefined,
        quantity: parseFloat(quantity),
        unit: unit as UnitType,
        unit_cost: unitCost ? parseFloat(unitCost) : undefined,
        source: source || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        setStep("success");
      } else {
        setError("Failed to add inventory");
      }
    } catch {
      setError("Failed to record transaction");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("search");
    setSearch("");
    setSelectedItem(null);
    setIsNewItem(false);
    setNewItemName("");
    setQuantity("1");
    setUnit("each");
    setUnitCost("");
    setSource("");
    setNotes("");
    setError("");
  }

  return (
    <>
      <PageHeader title="Manual Entry" backHref="/receive" />
      <div className="p-4 space-y-4">
        {step === "search" && (
          <>
            <Input
              label="Search Items"
              placeholder="Type to search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            <div className="space-y-2">
              {items.map((item) => (
                <Card key={item.id} onClick={() => selectExistingItem(item)}>
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

              {items.length === 0 && search && (
                <p className="text-sm text-muted text-center py-4">No items found</p>
              )}
            </div>

            <Button variant="secondary" onClick={createNew} className="w-full">
              + Create New Item
            </Button>
          </>
        )}

        {step === "form" && (
          <>
            {isNewItem ? (
              <Card>
                <p className="text-xs text-muted uppercase tracking-wide">New Item</p>
                <Input
                  label="Item Name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  autoFocus
                />
              </Card>
            ) : (
              <Card>
                <p className="text-xs text-muted uppercase tracking-wide">Selected Item</p>
                <p className="font-semibold text-lg">{selectedItem?.name}</p>
                <Badge variant="info">{selectedItem?.unit}</Badge>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0.01"
                step="any"
              />
              <Select
                label="Unit"
                options={UNIT_OPTIONS}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>

            <Input
              label="Unit Cost (optional)"
              type="number"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              min="0"
              step="0.01"
            />

            <Input
              label="Source (optional)"
              placeholder="e.g., Costco, Sysco"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />

            <Input
              label="Notes (optional)"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button onClick={handleSubmit} loading={loading} className="w-full" size="lg">
              Add to Inventory
            </Button>
            <Button variant="ghost" onClick={() => setStep("search")} className="w-full">
              Back to Search
            </Button>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {isNewItem ? newItemName : selectedItem?.name}
              </h3>
              <p className="text-muted">+{quantity} {unit} added</p>
            </div>
            <Button onClick={reset} className="w-full" size="lg">
              Add More
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
