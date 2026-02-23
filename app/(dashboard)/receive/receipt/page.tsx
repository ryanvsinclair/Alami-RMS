"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { processReceiptText, processReceiptImage, updateLineItemMatch } from "@/app/actions/receipts";
import { commitReceiptTransactions } from "@/app/actions/transactions";
import { compressImage } from "@/lib/utils/compress-image";
import { ReceiptLineItemRow } from "./line-item-row";

type Step = "input" | "review" | "success";
type InputMode = "camera" | "text";

interface LineItem {
  id: string;
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | string | null;
  unit: string | null;
  line_cost: number | string | null;
  unit_cost: number | string | null;
  confidence: string;
  status: string;
  matched_item: {
    id: string;
    name: string;
    unit: string;
  } | null;
}

interface ReceiptData {
  id: string;
  line_items: LineItem[];
}

export default function ReceiptPage() {
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("camera");
  const [rawText, setRawText] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setError("");

    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);
      const result = await processReceiptImage(base64);

      if (result.success && "receipt" in result && result.receipt) {
        setReceipt(result.receipt as ReceiptData);
        setStep("review");
      } else {
        setError("error" in result ? (result.error ?? "Scan failed") : "Scan failed. Try pasting text manually.");
        setInputMode("text");
      }
    } catch {
      setError("Failed to scan receipt. Try pasting text manually.");
      setInputMode("text");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleParse() {
    if (!rawText.trim()) return;
    setLoading(true);
    setError("");

    try {
      const result = await processReceiptText(rawText.trim());
      if (result) {
        setReceipt(result as ReceiptData);
        setStep("review");
      }
    } catch {
      setError("Failed to parse receipt");
    } finally {
      setLoading(false);
    }
  }

  async function handleLineItemUpdate(
    lineItemId: string,
    matchedItemId: string | null,
    status: "confirmed" | "skipped"
  ) {
    try {
      await updateLineItemMatch(lineItemId, {
        matched_item_id: matchedItemId,
        status,
      });
      if (receipt) {
        setReceipt({
          ...receipt,
          line_items: receipt.line_items.map((li) =>
            li.id === lineItemId ? { ...li, status } : li
          ),
        });
      }
    } catch {
      setError("Failed to update line item");
    }
  }

  async function handleNewItemForLine(
    lineItemId: string,
    item: { id: string; name: string }
  ) {
    try {
      await updateLineItemMatch(lineItemId, {
        matched_item_id: item.id,
        status: "confirmed",
      });
      if (receipt) {
        setReceipt({
          ...receipt,
          line_items: receipt.line_items.map((li) =>
            li.id === lineItemId
              ? {
                  ...li,
                  matched_item: { id: item.id, name: item.name, unit: "each" },
                  status: "confirmed",
                  confidence: "high",
                }
              : li
          ),
        });
      }
    } catch {
      setError("Failed to link item");
    }
  }

  async function handleCommitAll() {
    if (!receipt) return;
    setCommitting(true);

    const confirmedLines = receipt.line_items.filter(
      (li) => (li.status === "confirmed" || li.status === "matched") && li.matched_item
    );

    if (confirmedLines.length === 0) {
      setError("No confirmed items to commit");
      setCommitting(false);
      return;
    }

    try {
      await commitReceiptTransactions(
        receipt.id,
        confirmedLines.map((li) => ({
          inventory_item_id: li.matched_item!.id,
          receipt_line_item_id: li.id,
          quantity: Number(li.quantity) || 1,
          unit: (li.matched_item!.unit || li.unit || "each") as never,
          unit_cost: li.unit_cost ? Number(li.unit_cost) : undefined,
          total_cost: li.line_cost ? Number(li.line_cost) : undefined,
        }))
      );
      setStep("success");
    } catch {
      setError("Failed to commit transactions");
    } finally {
      setCommitting(false);
    }
  }

  const confirmedCount = receipt?.line_items.filter(
    (li) => li.status === "confirmed" || li.status === "matched"
  ).length ?? 0;
  const totalCount = receipt?.line_items.length ?? 0;

  function reset() {
    setStep("input");
    setInputMode("camera");
    setRawText("");
    setReceipt(null);
    setError("");
  }

  return (
    <>
      <PageHeader title="Scan Receipt" backHref="/receive" />
      <div className="p-4 space-y-4">
        {step === "input" && (
          <>
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setInputMode("camera")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  inputMode === "camera" ? "bg-primary text-white" : "text-muted hover:bg-white/8"
                }`}
              >
                Camera / Upload
              </button>
              <button
                onClick={() => setInputMode("text")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  inputMode === "text" ? "bg-primary text-white" : "text-muted hover:bg-white/8"
                }`}
              >
                Paste Text
              </button>
            </div>

            {inputMode === "camera" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageCapture}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                  className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3 hover:border-primary/50 transition-colors"
                >
                  {scanning ? (
                    <>
                      <svg className="animate-spin w-10 h-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-sm text-primary font-medium">Scanning receipt...</p>
                      <p className="text-xs text-muted animate-pulse">This may take a few seconds</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-muted mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                      </svg>
                      <p className="text-sm text-muted">Tap to take photo or upload receipt image</p>
                    </>
                  )}
                </button>
              </>
            )}

            {inputMode === "text" && (
              <>
                <textarea
                  className="w-full rounded-lg border border-border bg-white/6 px-3 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[200px] text-sm font-mono"
                  placeholder={"2x Chicken Breast 2kg   $15.98\n1x BBQ Sauce 1L          $4.99\n3x Napkins 200pk         $8.97\n..."}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  autoFocus
                />
                <Button
                  onClick={handleParse}
                  loading={loading}
                  disabled={!rawText.trim()}
                  className="w-full"
                  size="lg"
                >
                  Parse Receipt
                </Button>
              </>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}

        {step === "review" && receipt && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{totalCount} items parsed</p>
                <p className="text-xs text-muted">{confirmedCount} matched</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="success">{receipt.line_items.filter((l) => l.confidence === "high").length} high</Badge>
                <Badge variant="warning">{receipt.line_items.filter((l) => l.confidence === "medium").length} med</Badge>
                <Badge variant="danger">{receipt.line_items.filter((l) => l.confidence === "low" || l.confidence === "none").length} low</Badge>
              </div>
            </div>

            <div className="space-y-2">
              {receipt.line_items.map((li) => (
                <ReceiptLineItemRow
                  key={li.id}
                  lineItem={li}
                  onConfirm={(matchedItemId) =>
                    handleLineItemUpdate(li.id, matchedItemId, "confirmed")
                  }
                  onSkip={() => handleLineItemUpdate(li.id, null, "skipped")}
                  onNewItem={handleNewItemForLine}
                />
              ))}
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="sticky bottom-20 bg-[#080d14]/95 border-t border-border pt-3 -mx-4 px-4 backdrop-blur">
              <Button
                onClick={handleCommitAll}
                loading={committing}
                className="w-full"
                size="lg"
              >
                Add All ({confirmedCount} items)
              </Button>
            </div>
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
              <h3 className="font-semibold text-lg">Receipt Committed</h3>
              <p className="text-muted">{confirmedCount} items added to inventory</p>
            </div>
            <Button onClick={reset} className="w-full" size="lg">
              Scan Another Receipt
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
