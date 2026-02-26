"use client";

import { useState, useRef } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { ItemNotFound } from "@/shared/components/flows/item-not-found";
import { ingestByBarcode } from "@/app/actions/core/ingestion";
import { resolveBarcode } from "@/app/actions/core/barcode-resolver";
import { createTransaction } from "@/app/actions/core/transactions";
import type { ReceiveInventoryItemOption } from "@/features/receiving/shared/contracts";

type Step = "scan" | "quantity" | "not_found" | "external_found" | "success";

interface ExternalMatch {
  name: string;
  brand: string | null;
  size_text: string | null;
  category_hint: string | null;
  image_url: string | null;
  source: string;
  confidence: string;
}

export default function BarcodeReceivePageClient() {
  const [step, setStep] = useState<Step>("scan");
  const [barcode, setBarcode] = useState("");
  const [foundItem, setFoundItem] = useState<ReceiveInventoryItemOption | null>(null);
  const [externalMatch, setExternalMatch] = useState<ExternalMatch | null>(null);
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
      const resolution = await resolveBarcode({ barcode: barcode.trim() });
      if (resolution.status === "resolved") {
        setFoundItem(resolution.item as ReceiveInventoryItemOption);
        setStep("quantity");
      } else if (resolution.status === "resolved_external") {
        setExternalMatch({
          ...resolution.metadata,
          source: resolution.source,
          confidence: resolution.confidence,
        });
        setStep("external_found");
      } else {
        setStep("not_found");
      }
    } catch {
      setError("Failed to look up barcode");
    } finally {
      setLoading(false);
    }
  }

  function handleNewItemSelected(item: ReceiveInventoryItemOption) {
    setFoundItem(item);
    setStep("quantity");
  }

  async function handleSubmit() {
    if (!foundItem) return;
    setLoading(true);

    try {
      const result = await ingestByBarcode({
        barcode: barcode.trim(),
        quantity: parseFloat(quantity),
        unit_cost: unitCost ? parseFloat(unitCost) : undefined,
      });

      if (result.success) {
        setStep("success");
      } else {
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

  function handleExternalItemCreated(item: ReceiveInventoryItemOption) {
    setFoundItem(item);
    setExternalMatch(null);
    setStep("quantity");
  }

  function reset() {
    setStep("scan");
    setBarcode("");
    setFoundItem(null);
    setExternalMatch(null);
    setQuantity("1");
    setUnitCost("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div className="p-4 space-y-4">
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

      {step === "not_found" && (
        <ItemNotFound
          detectedText=""
          barcode={barcode}
          onItemSelected={handleNewItemSelected}
          onCancel={reset}
        />
      )}

      {step === "external_found" && externalMatch && (
        <>
          <Card>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                {externalMatch.image_url && (
                  <img
                    src={externalMatch.image_url}
                    alt={externalMatch.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                )}
                <div className="space-y-1 min-w-0">
                  <h3 className="font-semibold text-lg leading-tight">{externalMatch.name}</h3>
                  {externalMatch.brand && (
                    <p className="text-sm text-muted">{externalMatch.brand}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {externalMatch.size_text && (
                      <Badge>{externalMatch.size_text}</Badge>
                    )}
                    {externalMatch.category_hint && (
                      <Badge variant="info">{externalMatch.category_hint}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted">
                Found via {externalMatch.source.replace(/_/g, " ")} ({externalMatch.confidence} confidence)
              </p>
              <p className="text-xs text-muted">Barcode: {barcode}</p>
            </div>
          </Card>

          <p className="text-sm text-muted text-center">
            This product was found in an external database but is not in your inventory yet.
          </p>

          <ItemNotFound
            detectedText={externalMatch.name}
            barcode={barcode}
            onItemSelected={handleExternalItemCreated}
            onCancel={reset}
            suggestedName={externalMatch.name}
          />
        </>
      )}

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

      {step === "success" && (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/12 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
  );
}
