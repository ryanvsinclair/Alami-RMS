"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ItemNotFound } from "@/components/flows/item-not-found";
import { ingestByPhoto } from "@/app/actions/ingestion";
import { ocrImage } from "@/app/actions/ocr";
import type { MatchResult } from "@/lib/matching/engine";
import type { UnitType } from "@/lib/generated/prisma/client";

const UNIT_OPTIONS = [
  { value: "each", label: "Each" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "lb", label: "lb" },
  { value: "oz", label: "oz" },
  { value: "l", label: "L" },
  { value: "ml", label: "ml" },
  { value: "case_unit", label: "Case" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
];

type Step = "capture" | "match" | "not_found" | "quantity" | "success";

interface SelectedItem {
  id: string;
  name: string;
  unit: string;
}

export default function PhotoScanPage() {
  const [step, setStep] = useState<Step>("capture");
  const [parsedText, setParsedText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setError("");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await ocrImage(base64);
      if (result.success && result.raw_text) {
        setParsedText(result.raw_text);
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
    if (!parsedText.trim()) return;
    setLoading(true);
    setError("");

    try {
      const result = await ingestByPhoto({
        parsed_text: parsedText.trim(),
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

  function handleNewItemSelected(item: { id: string; name: string; unit: string }) {
    setSelectedItem(item);
    setStep("quantity");
  }

  async function handleSubmit() {
    if (!selectedItem) return;
    setLoading(true);

    try {
      const result = await ingestByPhoto({
        parsed_text: parsedText.trim(),
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
    setParsedText("");
    setSuggestions([]);
    setSelectedItem(null);
    setQuantity("1");
    setUnit("each");
    setUnitCost("");
    setError("");
  }

  return (
    <>
      <PageHeader title="Photo Scan" backHref="/receive" />
      <div className="p-4 space-y-4">

        {/* ── STEP: Capture ── */}
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

            {!parsedText ? (
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
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted uppercase tracking-wide font-medium">Detected Text</p>
                  <button onClick={() => { setParsedText(""); setError(""); }} className="text-xs text-primary">
                    Clear
                  </button>
                </div>
                <pre className="text-sm font-mono whitespace-pre-wrap text-foreground max-h-32 overflow-y-auto">
                  {parsedText}
                </pre>
              </Card>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted">or type manually</span></div>
            </div>

            <Input
              placeholder="e.g., Chicken Breast Boneless 2kg"
              value={parsedText}
              onChange={(e) => setParsedText(e.target.value)}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button onClick={handleAnalyze} loading={loading} disabled={!parsedText.trim()} className="w-full" size="lg">
              Analyze Product
            </Button>
          </>
        )}

        {/* ── STEP: Match suggestions ── */}
        {step === "match" && (
          <>
            <Card className="bg-gray-50">
              <p className="text-xs text-muted">Detected</p>
              <p className="font-medium">{parsedText}</p>
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
              <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted">not what you&apos;re looking for?</span></div>
            </div>

            <Button variant="secondary" onClick={() => setStep("not_found")} className="w-full">
              None of these — add new item
            </Button>
          </>
        )}

        {/* ── STEP: Item not found ── */}
        {step === "not_found" && (
          <ItemNotFound
            detectedText={parsedText}
            onItemSelected={handleNewItemSelected}
            onCancel={reset}
          />
        )}

        {/* ── STEP: Quantity ── */}
        {step === "quantity" && selectedItem && (
          <>
            <Card>
              <p className="text-xs text-muted">Adding inventory for</p>
              <p className="font-semibold text-lg">{selectedItem.name}</p>
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

            {error && <p className="text-sm text-danger">{error}</p>}
            <Button onClick={handleSubmit} loading={loading} className="w-full" size="lg">
              Add to Inventory
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
    </>
  );
}
