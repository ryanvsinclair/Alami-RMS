"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  finalizeReceiptReview,
  processReceiptImage,
  processReceiptText,
  setReceiptProduceDecision,
  updateLineItemMatch,
} from "@/app/actions/modules/receipts";
import { compressImage } from "@/shared/utils/compress-image";
import { ReceiptLineItemRow } from "@/features/receiving/receipt/ui/ReceiptLineItemRow";
import type {
  ReceiveReceiptReviewData,
  ReceiveReceiptReviewLineItem,
} from "@/features/receiving/shared/contracts";

type Step = "input" | "review" | "success";
type InputMode = "camera" | "text";
type ProduceDecision = "add_to_inventory" | "expense_only" | "resolve_later";

const PRODUCE_PARSE_FLAGS = new Set([
  "produce_lookup_plu_match",
  "produce_lookup_name_fuzzy_match",
]);

function hasProduceSignal(line: ReceiveReceiptReviewLineItem): boolean {
  if (line.plu_code != null) return true;
  const flags = line.parse_flags ?? [];
  return flags.some((flag) => PRODUCE_PARSE_FLAGS.has(flag));
}

function getProduceDecision(line: ReceiveReceiptReviewLineItem): ProduceDecision | "pending" {
  const decision = line.inventory_decision;
  if (!decision) return "pending";
  if (
    decision === "add_to_inventory" ||
    decision === "expense_only" ||
    decision === "resolve_later"
  ) {
    return decision;
  }
  return "pending";
}

function getDecisionStatus(decision: ProduceDecision): "confirmed" | "skipped" | "unresolved" {
  switch (decision) {
    case "add_to_inventory":
      return "confirmed";
    case "expense_only":
      return "skipped";
    case "resolve_later":
      return "unresolved";
  }
}

function pickNextPendingProduceId(
  lines: ReceiveReceiptReviewLineItem[],
  currentLineId: string | null,
): string | null {
  const candidates = lines.filter((line) => hasProduceSignal(line));
  const pending = candidates.filter((line) => getProduceDecision(line) === "pending");
  if (pending.length === 0) return null;
  if (!currentLineId) return pending[0]?.id ?? null;

  const currentIndex = pending.findIndex((line) => line.id === currentLineId);
  if (currentIndex >= 0 && currentIndex + 1 < pending.length) {
    return pending[currentIndex + 1]?.id ?? pending[0]?.id ?? null;
  }
  return pending[0]?.id ?? null;
}

export default function ReceiptReceivePageClient() {
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("camera");
  const [rawText, setRawText] = useState("");
  const [receipt, setReceipt] = useState<ReceiveReceiptReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [decisionSavingLineId, setDecisionSavingLineId] = useState<string | null>(null);
  const [bulkDecisionSaving, setBulkDecisionSaving] = useState(false);
  const [activeProduceLineId, setActiveProduceLineId] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState(0);
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
        const nextReceipt = result.receipt as ReceiveReceiptReviewData;
        setReceipt(nextReceipt);
        setActiveProduceLineId(pickNextPendingProduceId(nextReceipt.line_items, null));
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
        const nextReceipt = result as ReceiveReceiptReviewData;
        setReceipt(nextReceipt);
        setActiveProduceLineId(pickNextPendingProduceId(nextReceipt.line_items, null));
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
      const existingLine = receipt?.line_items.find((line) => line.id === lineItemId) ?? null;
      const produceDecision =
        existingLine && hasProduceSignal(existingLine)
          ? status === "confirmed"
            ? "add_to_inventory"
            : "expense_only"
          : undefined;
      await updateLineItemMatch(lineItemId, {
        matched_item_id: matchedItemId,
        status,
        inventory_decision: produceDecision,
      });
      if (receipt) {
        const nextLines = receipt.line_items.map((li) =>
          li.id === lineItemId
            ? {
                ...li,
                status,
                matched_item: matchedItemId
                  ? li.matched_item
                  : null,
                inventory_decision:
                  produceDecision ?? li.inventory_decision,
              }
            : li
        );
        setReceipt({
          ...receipt,
          line_items: nextLines,
        });
        setActiveProduceLineId(
          pickNextPendingProduceId(nextLines, lineItemId),
        );
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
        inventory_decision: "add_to_inventory",
      });
      if (receipt) {
        const nextLines = receipt.line_items.map((li) =>
          li.id === lineItemId
            ? {
                ...li,
                matched_item: { id: item.id, name: item.name, unit: "each" },
                status: "confirmed",
                confidence: "high",
                inventory_decision: hasProduceSignal(li)
                  ? "add_to_inventory"
                  : li.inventory_decision,
              }
            : li
        );
        setReceipt({
          ...receipt,
          line_items: nextLines,
        });
        setActiveProduceLineId(
          pickNextPendingProduceId(nextLines, lineItemId),
        );
      }
    } catch {
      setError("Failed to link item");
    }
  }

  async function handleProduceDecision(lineItemId: string, decision: ProduceDecision) {
    if (!receipt) return;
    setError("");
    setDecisionSavingLineId(lineItemId);
    try {
      await setReceiptProduceDecision(lineItemId, decision);
      const nextStatus = getDecisionStatus(decision);
      const nextLines = receipt.line_items.map((line) =>
        line.id === lineItemId
          ? {
              ...line,
              status: nextStatus,
              inventory_decision: decision,
              inventory_decided_at: new Date().toISOString(),
            }
          : line,
      );
      setReceipt({
        ...receipt,
        line_items: nextLines,
      });
      setActiveProduceLineId(
        pickNextPendingProduceId(nextLines, lineItemId),
      );
    } catch {
      setError("Failed to save produce decision");
    } finally {
      setDecisionSavingLineId(null);
    }
  }

  async function handleSelectAllProduce(decision: Exclude<ProduceDecision, "resolve_later">) {
    if (!receipt) return;
    setError("");
    const pendingProduceLines = receipt.line_items.filter(
      (line) => hasProduceSignal(line) && getProduceDecision(line) === "pending",
    );
    if (pendingProduceLines.length === 0) return;

    setBulkDecisionSaving(true);
    try {
      await Promise.all(
        pendingProduceLines.map((line) => setReceiptProduceDecision(line.id, decision)),
      );

      const nextStatus = getDecisionStatus(decision);
      const nowIso = new Date().toISOString();
      const pendingIds = new Set(pendingProduceLines.map((line) => line.id));
      const nextLines = receipt.line_items.map((line) =>
        pendingIds.has(line.id)
          ? {
              ...line,
              status: nextStatus,
              inventory_decision: decision,
              inventory_decided_at: nowIso,
            }
          : line,
      );
      setReceipt({
        ...receipt,
        line_items: nextLines,
      });
      setActiveProduceLineId(pickNextPendingProduceId(nextLines, null));
    } catch {
      setError("Failed to apply produce decision to all items");
    } finally {
      setBulkDecisionSaving(false);
    }
  }

  async function handleCommitAll() {
    if (!receipt) return;
    const pendingProduceCount = receipt.line_items.filter(
      (line) => hasProduceSignal(line) && getProduceDecision(line) === "pending",
    ).length;
    if (pendingProduceCount > 0) {
      setError("Resolve produce checklist decisions before committing this receipt");
      return;
    }

    setCommitting(true);

    try {
      const result = (await finalizeReceiptReview(receipt.id)) as {
        committed_count?: number;
      } | null;
      setCommittedCount(result?.committed_count ?? 0);
      setStep("success");
    } catch {
      setError("Failed to commit transactions");
    } finally {
      setCommitting(false);
    }
  }

  const produceCandidates = useMemo(
    () => receipt?.line_items.filter((line) => hasProduceSignal(line)) ?? [],
    [receipt],
  );

  const pendingProduceCount = produceCandidates.filter(
    (line) => getProduceDecision(line) === "pending",
  ).length;

  const eligibleInventoryCount = receipt?.line_items.filter((line) => {
    const hasMatched = Boolean(line.matched_item);
    const committableStatus = line.status === "confirmed" || line.status === "matched";
    if (!hasMatched || !committableStatus) return false;
    if (!hasProduceSignal(line)) return true;
    return getProduceDecision(line) === "add_to_inventory";
  }).length ?? 0;

  const confirmedCount = receipt?.line_items.filter(
    (li) => li.status === "confirmed" || li.status === "matched"
  ).length ?? 0;
  const totalCount = receipt?.line_items.length ?? 0;
  const parseHighCount = receipt?.line_items.filter(
    (li) => li.parse_confidence_band === "high"
  ).length ?? 0;
  const parseMediumCount = receipt?.line_items.filter(
    (li) => li.parse_confidence_band === "medium"
  ).length ?? 0;
  const parseLowCount = receipt?.line_items.filter(
    (li) => li.parse_confidence_band === "low" || li.parse_confidence_band === "none"
  ).length ?? 0;

  function reset() {
    setStep("input");
    setInputMode("camera");
    setRawText("");
    setReceipt(null);
    setActiveProduceLineId(null);
    setDecisionSavingLineId(null);
    setBulkDecisionSaving(false);
    setCommittedCount(0);
    setError("");
  }

  return (
    <div className="p-4 space-y-4">
      {step === "input" && (
        <>
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
              <Badge variant="success">{parseHighCount} parse high</Badge>
              <Badge variant="warning">{parseMediumCount} parse med</Badge>
              <Badge variant="danger">{parseLowCount} parse low</Badge>
            </div>
          </div>

          {produceCandidates.length > 0 && (
            <div className="rounded-lg border border-border bg-white/6 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Parsed Produce Checklist</p>
                  <p className="text-xs text-muted">
                    {pendingProduceCount} pending decision{pendingProduceCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSelectAllProduce("add_to_inventory")}
                    disabled={bulkDecisionSaving || pendingProduceCount === 0}
                    className="px-2 py-1 text-xs rounded-md bg-success/12 text-success disabled:opacity-50"
                  >
                    Select All Yes
                  </button>
                  <button
                    onClick={() => handleSelectAllProduce("expense_only")}
                    disabled={bulkDecisionSaving || pendingProduceCount === 0}
                    className="px-2 py-1 text-xs rounded-md bg-white/10 text-white/70 disabled:opacity-50"
                  >
                    Select All No
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {produceCandidates.map((line) => {
                  const decision = getProduceDecision(line);
                  const isPending = decision === "pending";
                  const isActive = line.id === activeProduceLineId;
                  return (
                    <div
                      key={line.id}
                      className={`rounded-md border p-2 ${
                        isActive ? "border-primary" : "border-border"
                      } ${isPending ? "bg-white/6" : "bg-white/4"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {line.parsed_name ?? line.raw_text}
                          </p>
                          <p className="text-xs text-muted">
                            {line.quantity ?? "?"} {line.unit ?? "each"}
                            {line.line_cost ? ` • $${Number(line.line_cost).toFixed(2)}` : ""}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted">
                          {decision === "pending"
                            ? "Pending"
                            : decision === "add_to_inventory"
                            ? "Yes"
                            : decision === "expense_only"
                            ? "No"
                            : "Resolve later"}
                        </span>
                      </div>

                      <div className="mt-2 flex gap-1">
                        <button
                          onClick={() => handleProduceDecision(line.id, "add_to_inventory")}
                          disabled={
                            decisionSavingLineId === line.id ||
                            bulkDecisionSaving ||
                            !line.matched_item
                          }
                          className="px-2 py-1 text-xs rounded-md bg-success/12 text-success disabled:opacity-50"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleProduceDecision(line.id, "expense_only")}
                          disabled={decisionSavingLineId === line.id || bulkDecisionSaving}
                          className="px-2 py-1 text-xs rounded-md bg-white/10 text-white/70 disabled:opacity-50"
                        >
                          No
                        </button>
                        <button
                          onClick={() => handleProduceDecision(line.id, "resolve_later")}
                          disabled={decisionSavingLineId === line.id || bulkDecisionSaving}
                          className="px-2 py-1 text-xs rounded-md bg-amber-500/12 text-amber-300 disabled:opacity-50"
                        >
                          Resolve Later
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {receipt.line_items.map((li) => (
              <ReceiptLineItemRow
                key={li.id}
                lineItem={li as ReceiveReceiptReviewLineItem}
                onConfirm={(matchedItemId) =>
                  handleLineItemUpdate(li.id, matchedItemId, "confirmed")
                }
                onSkip={() =>
                  handleLineItemUpdate(
                    li.id,
                    hasProduceSignal(li as ReceiveReceiptReviewLineItem)
                      ? li.matched_item?.id ?? null
                      : null,
                    "skipped",
                  )
                }
                onNewItem={handleNewItemForLine}
              />
            ))}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="sticky bottom-20 bg-[#080d14]/95 border-t border-border pt-3 -mx-4 px-4 backdrop-blur">
            <Button
              onClick={handleCommitAll}
              loading={committing}
              disabled={pendingProduceCount > 0}
              className="w-full"
              size="lg"
            >
              Finalize Receipt ({eligibleInventoryCount} inventory items)
            </Button>
          </div>
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
            <h3 className="font-semibold text-lg">Receipt Committed</h3>
            <p className="text-muted">{committedCount} items added to inventory</p>
          </div>
          {receipt && (
            <Link
              href={`/receive/receipt/${receipt.id}`}
              className="block w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              View Receipt
            </Link>
          )}
          <Button onClick={reset} className="w-full" size="lg">
            Scan Another Receipt
          </Button>
        </div>
      )}
    </div>
  );
}
