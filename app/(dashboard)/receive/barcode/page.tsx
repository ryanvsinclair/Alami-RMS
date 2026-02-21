"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ItemNotFound } from "@/components/flows/item-not-found";
import { ingestByBarcode } from "@/app/actions/ingestion";
import { lookupBarcode } from "@/app/actions/inventory";
import { createTransaction } from "@/app/actions/transactions";

type Step = "scan" | "quantity" | "not_found" | "success";

interface FoundItem {
  id: string;
  name: string;
  unit: string;
  category?: { name: string } | null;
}

export default function BarcodeScanPage() {
  const [step, setStep] = useState<Step>("scan");
  const [barcode, setBarcode] = useState("");
  const [foundItem, setFoundItem] = useState<FoundItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleBarcodeScan() {
    if (!barcode.trim()) return;
    setLoading(true);
    setError("");

    try {
      const item = await lookupBarcode(barcode.trim());
      if (item) {
        setFoundItem(item as FoundItem);
        setStep("quantity");
      } else {
        setStep("not_found");
      }
    } catch {
      setError("Failed to look up barcode");
    } finally {
      setLoading(false);
    }
  }

  function handleNewItemSelected(item: { id: string; name: string; unit: string; category?: { name: string } | null }) {
    setFoundItem(item);
    setStep("quantity");
  }

  async function handleSubmit() {
    if (!foundItem) return;
    setLoading(true);

    try {
      // If item came from ItemNotFound (barcode already linked), use createTransaction directly
      const result = await ingestByBarcode({
        barcode: barcode.trim(),
        quantity: parseFloat(quantity),
        unit_cost: unitCost ? parseFloat(unitCost) : undefined,
      });

      if (result.success) {
        setStep("success");
      } else {
        // Barcode might not be linked yet if item was from search (not create).
        // Fall back to direct transaction.
        await createTransaction({
          inventory_item_id: foundItem.id,
          quantity: parseFloat(quantity),
          unit: foundItem.unit as never,
          unit_cost: unitCost ? parseFloat(unitCost) : undefined,
          total_cost: unitCost ? parseFloat(unitCost) * parseFloat(quantity) : undefined,
          input_method: "barcode",
        });
        setStep("success");
      }
    } catch {
      setError("Failed to record transaction");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("scan");
    setBarcode("");
    setFoundItem(null);
    setQuantity("1");
    setUnitCost("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <>
      <PageHeader title="Scan Barcode" backHref="/receive" />
      <div className="p-4 space-y-4">

        {/* ── STEP: Scan ── */}
        {step === "scan" && (
          <>
            <p className="text-sm text-muted">
              Scan a barcode or type it manually.
            </p>
            <Input
              ref={inputRef}
              label="Barcode"
              placeholder="Scan or type barcode..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeScan()}
              autoFocus
              inputMode="numeric"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button onClick={handleBarcodeScan} loading={loading} className="w-full" size="lg">
              Look Up
            </Button>
          </>
        )}

        {/* ── STEP: Not Found → Create or Search ── */}
        {step === "not_found" && (
          <ItemNotFound
            detectedText=""
            barcode={barcode}
            onItemSelected={handleNewItemSelected}
            onCancel={reset}
          />
        )}

        {/* ── STEP: Quantity ── */}
        {step === "quantity" && foundItem && (
          <>
            <Card>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{foundItem.name}</h3>
                <div className="flex gap-2">
                  <Badge variant="info">{foundItem.unit}</Badge>
                  {foundItem.category && (
                    <Badge>{foundItem.category.name}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">Barcode: {barcode}</p>
              </div>
            </Card>

            <Input
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.01"
              step="any"
              autoFocus
            />
            <Input
              label="Unit Cost (optional)"
              type="number"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              min="0"
              step="0.01"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button onClick={handleSubmit} loading={loading} className="w-full" size="lg">
              Add to Inventory
            </Button>
            <Button variant="ghost" onClick={reset} className="w-full">
              Scan Another
            </Button>
          </>
        )}

        {/* ── STEP: Success ── */}
        {step === "success" && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{foundItem?.name}</h3>
              <p className="text-muted">+{quantity} {foundItem?.unit} added</p>
            </div>
            <Button onClick={reset} className="w-full" size="lg">
              Scan Another
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
