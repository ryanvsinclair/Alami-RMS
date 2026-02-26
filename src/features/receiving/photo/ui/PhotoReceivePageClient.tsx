"use client";

import { useState, useRef } from "react";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { ItemNotFound } from "@/shared/components/flows/item-not-found";
import { ingestByPhoto } from "@/app/actions/core/ingestion";
import { ocrImage } from "@/app/actions/modules/ocr";
import { compressImage } from "@/shared/utils/compress-image";
import type { ProductInfo } from "@/domain/parsers/product-name";
import type { MatchResult } from "@/domain/matching/engine";
import type { UnitType } from "@/lib/generated/prisma/client";
import type { ReceiveInventoryItemOption } from "@/features/receiving/shared/contracts";
import { RECEIVE_UNIT_OPTIONS_COMPACT } from "@/features/receiving/shared/unit-options";

type Step = "capture" | "match" | "not_found" | "quantity" | "success";

export default function PhotoReceivePageClient() {
  const [step, setStep] = useState<Step>("capture");
  const [rawText, setRawText] = useState("");
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [editableName, setEditableName] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReceiveInventoryItemOption | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchText = editableName || productInfo?.product_name || rawText;

  async function handleImageCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setError("");

    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);
      const result = await ocrImage(base64);

      if (result.success && result.raw_text) {
        setRawText(result.raw_text);
        if (result.product_info) {
          setProductInfo(result.product_info);
          setEditableName(result.product_info.product_name);
        }
      } else {
        setError(result.error ?? "OCR failed. Try typing the product text manually.");
      }
    } catch {
      setError("Failed to process image. Try typing the product text manually.");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAnalyze() {
    if (!matchText.trim()) return;
    setLoading(true);
    setError("");

    try {
      const result = await ingestByPhoto({
        parsed_text: matchText.trim(),
        quantity: 1,
        unit: "each",
      });

      if (result.success) {
        setStep("success");
      } else if ("suggestions" in result && result.suggestions) {
        const matches = result.suggestions as MatchResult[];
        if (matches.length > 0) {
          setSuggestions(matches);
          setStep("match");
        } else {
          setStep("not_found");
        }
      }
    } catch {
      setError("Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectMatch(match: MatchResult) {
    setSelectedItem({
      id: match.inventory_item_id,
      name: match.item_name,
      unit: "each",
    });
    setStep("quantity");
  }

  function handleNewItemSelected(item: ReceiveInventoryItemOption) {
    setSelectedItem(item);
    setStep("quantity");
  }

  async function handleSubmit() {
    if (!selectedItem) return;
    setLoading(true);

    try {
      const result = await ingestByPhoto({
        parsed_text: matchText.trim(),
        quantity: parseFloat(quantity),
        unit: unit as UnitType,
        unit_cost: unitCost ? parseFloat(unitCost) : undefined,
        confirmed_item_id: selectedItem.id,
      });

      if (result.success) {
        setStep("success");
      }
    } catch {
      setError("Failed to record");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("capture");
    setRawText("");
    setProductInfo(null);
    setEditableName("");
    setSuggestions([]);
    setSelectedItem(null);
    setQuantity("1");
    setUnit("each");
    setUnitCost("");
    setError("");
  }

  return (
    <div className="p-4 space-y-4">
      {step === "capture" && (
        <>
          <p className="text-sm text-muted">
            Take a photo of the product or type the label text.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageCapture}
            className="hidden"
          />

          {!rawText ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3 hover:border-primary/50 transition-colors"
            >
              {ocrLoading ? (
                <>
                  <svg className="animate-spin w-10 h-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-primary font-medium">Reading product label...</p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                  <p className="text-sm text-muted">Tap to take photo of product</p>
                </>
              )}
            </button>
          ) : (
            <>
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted uppercase tracking-wide font-medium">Detected Product</p>
                  <button onClick={() => { setRawText(""); setProductInfo(null); setEditableName(""); setError(""); }} className="text-xs text-primary">
                    Clear
                  </button>
                </div>

                {productInfo && productInfo.product_name !== "Unknown Product" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted font-medium">Product Name</label>
                      <Input
                        value={editableName}
                        onChange={(e) => setEditableName(e.target.value)}
                        placeholder="Edit product name..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {productInfo.brand && (
                        <div>
                          <p className="text-xs text-muted">Brand</p>
                          <p className="font-medium">{productInfo.brand}</p>
                        </div>
                      )}
                      {productInfo.category && productInfo.category !== "Other" && (
                        <div>
                          <p className="text-xs text-muted">Category</p>
                          <p className="font-medium">{productInfo.category}</p>
                        </div>
                      )}
                      {productInfo.weight && (
                        <div>
                          <p className="text-xs text-muted mb-1">Weight</p>
                          <Badge variant="info">{productInfo.weight}</Badge>
                        </div>
                      )}
                      {productInfo.quantity_description && (
                        <div>
                          <p className="text-xs text-muted mb-1">Pack Size</p>
                          <Badge>{productInfo.quantity_description}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted italic">Could not detect product info. Type the name below.</p>
                )}
              </Card>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="w-full text-sm text-primary font-medium py-2"
              >
                Retake Photo
              </button>
            </>
          )}

          {!productInfo && rawText && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-[#080d14] px-2 text-xs text-muted">or type manually</span></div>
              </div>
              <Input
                placeholder="e.g., Chicken Breast Boneless 2kg"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
              />
            </>
          )}

          {!rawText && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-[#080d14] px-2 text-xs text-muted">or type manually</span></div>
              </div>
              <Input
                placeholder="e.g., Chicken Breast Boneless 2kg"
                value={editableName}
                onChange={(e) => { setEditableName(e.target.value); setRawText(e.target.value); }}
              />
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button onClick={handleAnalyze} loading={loading} disabled={!matchText.trim()} className="w-full" size="lg">
            Analyze Product
          </Button>
        </>
      )}

      {step === "match" && (
        <>
          <Card className="bg-white/5">
            <p className="text-xs text-muted">Detected</p>
            <p className="font-medium">{matchText}</p>
            {productInfo?.brand && (
              <p className="text-xs text-muted mt-0.5">by {productInfo.brand}</p>
            )}
          </Card>

          <p className="text-sm text-muted">Select the matching item:</p>

          <div className="space-y-2">
            {suggestions.map((match) => (
              <Card key={match.inventory_item_id} onClick={() => handleSelectMatch(match)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{match.item_name}</p>
                    <div className="flex gap-1 mt-0.5">
                      <Badge
                        variant={
                          match.confidence === "high" ? "success" :
                          match.confidence === "medium" ? "warning" : "danger"
                        }
                      >
                        {Math.round(match.score * 100)}% match
                      </Badge>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Card>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-[#080d14] px-2 text-xs text-muted">not what you&apos;re looking for?</span></div>
          </div>

          <Button variant="secondary" onClick={() => setStep("not_found")} className="w-full">
            None of these - add new item
          </Button>
        </>
      )}

      {step === "not_found" && (
        <ItemNotFound
          detectedText={matchText}
          onItemSelected={handleNewItemSelected}
          onCancel={reset}
        />
      )}

      {step === "quantity" && selectedItem && (
        <>
          <Card>
            <p className="text-xs text-muted">Adding inventory for</p>
            <p className="font-semibold text-lg">{selectedItem.name}</p>
            {productInfo?.brand && (
              <p className="text-sm text-muted">{productInfo.brand}</p>
            )}
            <div className="flex gap-2 mt-1">
              {productInfo?.weight && <Badge variant="info">{productInfo.weight}</Badge>}
              {productInfo?.quantity_description && <Badge>{productInfo.quantity_description}</Badge>}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.01"
              step="any"
              autoFocus
            />
            <Select
              label="Unit"
              options={RECEIVE_UNIT_OPTIONS_COMPACT}
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

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleSubmit} loading={loading} className="w-full" size="lg">
            Add to Inventory
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
            <h3 className="font-semibold text-lg">Item Added</h3>
            <p className="text-muted">
              {selectedItem ? `+${quantity} ${unit} of ${selectedItem.name}` : "Added successfully"}
            </p>
          </div>
          <Button onClick={reset} className="w-full" size="lg">
            Scan Another
          </Button>
        </div>
      )}
    </div>
  );
}
