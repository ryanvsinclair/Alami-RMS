"use client";

import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { ItemNotFound } from "@/shared/components/flows/item-not-found";
import type {
  ReceiveInventoryItemOption,
  ReceiveReceiptReviewLineItem,
} from "@/features/receiving/shared/contracts";

const matchConfidenceBadge: Record<
  string,
  { variant: "success" | "warning" | "danger" | "default"; label: string }
> = {
  high: { variant: "success", label: "Match high" },
  medium: { variant: "warning", label: "Match med" },
  low: { variant: "danger", label: "Match low" },
  none: { variant: "default", label: "No match" },
};

const parseConfidenceBadge: Record<
  string,
  { variant: "success" | "warning" | "danger" | "default"; label: string }
> = {
  high: { variant: "success", label: "Parse high" },
  medium: { variant: "warning", label: "Parse med" },
  low: { variant: "danger", label: "Parse low" },
  none: { variant: "default", label: "Parse n/a" },
};

export function ReceiptLineItemRow({
  lineItem,
  onConfirm,
  onSkip,
  onNewItem,
}: {
  lineItem: ReceiveReceiptReviewLineItem;
  onConfirm: (matchedItemId: string) => void;
  onSkip: () => void;
  onNewItem: (lineItemId: string, item: Pick<ReceiveInventoryItemOption, "id" | "name">) => void;
}) {
  const [showNotFound, setShowNotFound] = useState(false);
  const isResolved = lineItem.status === "confirmed" || lineItem.status === "skipped";
  const matchBadge = matchConfidenceBadge[lineItem.confidence] ?? matchConfidenceBadge.none;
  const parseBand = lineItem.parse_confidence_band ?? "none";
  const parseBadge = parseConfidenceBadge[parseBand] ?? parseConfidenceBadge.none;

  if (showNotFound) {
    return (
      <div className="rounded-lg border border-amber-400/35 p-3 space-y-2 bg-amber-500/10">
        <p className="text-xs text-muted font-medium">
          Resolving: <span className="font-mono">{lineItem.parsed_name ?? lineItem.raw_text}</span>
        </p>
        <ItemNotFound
          detectedText={lineItem.parsed_name ?? lineItem.raw_text}
          onItemSelected={(item) => {
            onNewItem(lineItem.id, item);
            setShowNotFound(false);
          }}
          onCancel={() => setShowNotFound(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-lg border p-3 space-y-2 transition-opacity
        ${isResolved ? "opacity-60 border-border" : "border-border bg-white/6"}
        ${lineItem.status === "skipped" ? "line-through" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{lineItem.parsed_name ?? lineItem.raw_text}</p>
          {lineItem.parsed_name && lineItem.parsed_name !== lineItem.raw_text && (
            <p className="text-xs text-muted truncate">{lineItem.raw_text}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={parseBadge.variant}>{parseBadge.label}</Badge>
          <Badge variant={matchBadge.variant}>{matchBadge.label}</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted">
        <span>Qty: {lineItem.quantity ?? "?"} {lineItem.unit ?? ""}</span>
        {lineItem.line_cost && <span>${Number(lineItem.line_cost).toFixed(2)}</span>}
      </div>
      {(lineItem.parse_confidence_band === "low" || lineItem.parse_confidence_band === "medium") &&
        lineItem.parse_flags &&
        lineItem.parse_flags.length > 0 && (
          <p className="text-xs text-amber-300/90 truncate">
            Parse flags: {lineItem.parse_flags.slice(0, 3).join(", ")}
          </p>
        )}

      {!isResolved && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {lineItem.matched_item ? (
                <p className="text-sm text-primary font-medium truncate">
                  &rarr; {lineItem.matched_item.name}
                </p>
              ) : (
                <p className="text-sm text-muted italic">No match found</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {lineItem.matched_item && (
                <button
                  onClick={() => onConfirm(lineItem.matched_item!.id)}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-success/12 text-success hover:bg-success/18"
                >
                  Confirm
                </button>
              )}
              <button
                onClick={onSkip}
                className="px-3 py-1 text-xs font-medium rounded-md bg-white/10 text-white/70 hover:bg-white/16"
              >
                Skip
              </button>
            </div>
          </div>

          {!lineItem.matched_item && (
            <button
              onClick={() => setShowNotFound(true)}
              className="w-full py-1.5 text-xs font-medium rounded-md border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
            >
              + Add as new item or search inventory
            </button>
          )}
        </div>
      )}

      {lineItem.status === "confirmed" && (
        <p className="text-xs text-success font-medium">Confirmed</p>
      )}
      {lineItem.status === "skipped" && (
        <p className="text-xs text-muted font-medium">Skipped</p>
      )}
    </div>
  );
}
