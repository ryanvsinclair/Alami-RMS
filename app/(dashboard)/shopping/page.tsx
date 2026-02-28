"use client";

// Transitional wrapper during app-structure refactor.
// State + logic extracted to: src/features/shopping/ui/use-shopping-session.ts
// Types extracted to: src/features/shopping/ui/contracts.ts
// The JSX remains here (Route page must stay in app/) but delegates all state to the hook.

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ItemNotFound } from "@/components/flows/item-not-found";
import { useShoppingSession } from "@/features/shopping/ui/use-shopping-session";
import {
  asNumber,
  formatMoney,
  displayShoppingItemName,
  getItemBarcodeBadgeValue,
  reconLabel,
  reconVariant,
} from "@/features/shopping/ui/contracts";

export default function ShoppingPage() {
  const router = useRouter();

  // Refs must live in the component (React Compiler rule: no ref access during render from hooks)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickBarcodeInputRef = useRef<HTMLInputElement>(null);
  const receiptSectionRef = useRef<HTMLDivElement>(null);
  const fallbackPhotoInputRef = useRef<HTMLInputElement>(null);
  const scanFileRef = useRef<HTMLInputElement>(null);

  const s = useShoppingSession({
    fileInputRef,
    quickBarcodeInputRef,
    receiptSectionRef,
    fallbackPhotoInputRef,
    scanFileRef,
  });

  if (s.loading) {
    return (
      <div className="p-6 text-sm text-muted">Loading Shopping Mode...</div>
    );
  }

  if (!s.session) {
    return (
      <div className="p-4 space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold mb-1">Start Shopping Session</p>
            <p className="text-xs text-muted mb-4">
              Use Google Places to choose your store. Free-text stores are disabled.
            </p>
            <Input
              label="Store Search"
              placeholder="Search grocery or supplier store..."
              value={s.storeQuery}
              onChange={(e) => {
                s.setStoreQuery(e.target.value);
                s.setSelectedStore(null);
              }}
            />

            {!s.selectedStore && (s.suggestions.length > 0 || s.placesLoading) && (
              <div className="mt-2 rounded-2xl border border-border bg-card overflow-hidden">
                {s.placesLoading && (
                  <div className="px-4 py-3 text-xs text-muted">Searching stores...</div>
                )}
                {s.suggestions.map((sg) => (
                  <button
                    key={sg.place_id}
                    onClick={() => s.selectSuggestion(sg)}
                    className="w-full px-4 py-3 text-left hover:bg-black/[0.04] transition-colors border-b last:border-b-0 border-border"
                  >
                    <p className="text-sm font-semibold">{sg.primary_text}</p>
                    <p className="text-xs text-muted">{sg.secondary_text || sg.description}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {s.selectedStore && (
            <Card className="p-5">
              <p className="text-xs text-muted uppercase tracking-wide">Confirm Store</p>
              <h3 className="text-xl font-bold mt-1">{s.selectedStore.name}</h3>
              <p className="text-sm text-muted mt-1">{s.selectedStore.formatted_address}</p>
              <div className="mt-3 rounded-xl overflow-hidden border border-border">
                <iframe
                  title="Store location preview"
                  src={`https://www.google.com/maps?q=${s.selectedStore.lat},${s.selectedStore.lng}&z=15&output=embed`}
                  className="w-full h-36"
                  loading="lazy"
                />
              </div>
              <div className="mt-3 text-xs text-muted font-mono">
                Place ID: {s.selectedStore.place_id}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="secondary" onClick={() => s.setSelectedStore(null)}>
                  Change
                </Button>
                <Button onClick={s.confirmStoreAndStart} loading={s.saving}>
                  Start Shopping
                </Button>
              </div>
            </Card>
          )}

          {s.error && <p className="text-sm text-danger">{s.error}</p>}

          <button
            onClick={() => router.push("/shopping/orders")}
            className="w-full text-sm text-primary font-medium py-2 text-center"
          >
            View Past Orders
          </button>
      </div>
    );
  }

  const session = s.session;

  return (
    <>
      <div className="p-4 pb-44 space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Store</p>
              <h2 className="text-xl font-bold">{session.store_name}</h2>
              <p className="text-xs text-muted">{session.store_address}</p>
            </div>
            <Badge variant={session.status === "ready" ? "success" : "warning"}>
              {session.status}
            </Badge>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={s.handleCancelSession}
              loading={s.cancelLoading}
            >
              Cancel Session
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div>
              <p className="text-xs text-muted">Staged</p>
              <p className="font-bold">{formatMoney(session.staged_subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Receipt</p>
              <p className="font-bold">{formatMoney(session.receipt_total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Issues</p>
              <p className="font-bold">{s.blockingIssueCount}</p>
            </div>
          </div>
          {s.receiptScanIncomplete && !s.receiptScanning && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold text-amber-300">
                Receipt scan incomplete
              </p>
              <p className="mt-1 text-xs text-amber-200/90">
                {s.receiptTotalMismatch
                  ? (
                      s.receiptTotalMissing
                        ? "We could not read the receipt total from this scan. Please rescan the receipt before committing."
                        : `Selected items + tax = ${formatMoney(s.selectedTotalWithTax)}, but scanned receipt total = ${formatMoney(session.receipt_total)}. Please rescan the receipt before committing.`
                    )
                  : "This receipt scan was not 100% successful. Please rescan the receipt before committing."}
              </p>
              {s.receiptTotalMismatch && s.receiptSubtotalMismatch && session.receipt_subtotal != null && (
                <p className="mt-1 text-xs text-amber-200/80">
                  Selected subtotal = {formatMoney(s.basketTotal)}; scanned subtotal = {formatMoney(session.receipt_subtotal)}.
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
              >
                Rescan Receipt
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Quick Shop (Barcode)</p>
              <p className="mt-1 text-xs text-muted">
                Scan UPC/EAN, save to cart, scan next item. We check internal barcode mappings first, then the layered barcode provider stack, and defer web/AI fallback until after receipt scan.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={s.handleConcludeQuickShop}
              disabled={s.receiptScanning}
            >
              Conclude Quick Shop
            </Button>
          </div>

          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Input
                ref={quickBarcodeInputRef}
                label="Scan UPC / EAN"
                placeholder="Scan or type barcode..."
                value={s.quickBarcode}
                onChange={(e) => s.setQuickBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!s.quickScanLoading) void s.handleQuickBarcodeAdd();
                }}
              />
            </div>
            <Button onClick={s.handleQuickBarcodeAdd} loading={s.quickScanLoading}>
              Scan & Save
            </Button>
          </div>

          {s.quickScanFeedback && (
            <div
              className={`mt-3 rounded-xl border p-3 ${
                s.quickScanFeedback.status === "resolved_inventory"
                  ? "border-success/25 bg-success/10"
                  : s.quickScanFeedback.status === "resolved_barcode_metadata"
                    ? "border-sky-400/25 bg-sky-500/10"
                  : "border-amber-400/25 bg-amber-500/10"
              }`}
            >
              <p className="text-sm font-semibold">
                {s.quickScanFeedback.status !== "unresolved"
                  ? s.quickScanFeedback.display_name
                  : "Unresolved Item"}
              </p>
              <p className="mt-1 text-xs text-muted">
                UPC {s.quickScanFeedback.normalized_barcode}
              </p>
              <p className="mt-1 text-xs text-muted">
                Source: {s.quickScanFeedback.source} • Confidence: {s.quickScanFeedback.confidence}
              </p>
              {s.quickScanFeedback.deferred_resolution && (
                <p className="mt-1 text-xs text-muted">
                  Added as a provisional cart item. Receipt scan remains the authoritative phase for final matching, unresolved pairing, and any deferred web/AI fallback.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Add To Basket</p>
          <Input
            placeholder="Search or type item name"
            value={s.itemName}
            onChange={(e) => s.setItemName(e.target.value)}
          />
          {s.produceSearchLoading && s.itemName.trim().length >= 2 && (
            <p className="mt-2 text-xs text-muted">Searching produce suggestions...</p>
          )}
          {s.produceSuggestions.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-foreground/[0.02]">
              {s.produceSuggestions.map((suggestion) => (
                <button
                  key={`produce-suggest-${suggestion.plu_code}`}
                  type="button"
                  onClick={() => s.handleAddProduceSuggestion(suggestion)}
                  className="w-full border-b border-border/60 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.04]"
                >
                  <p className="text-sm font-medium">{suggestion.display_name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    PLU {suggestion.plu_code}
                    {suggestion.variety ? ` • ${suggestion.variety}` : ""}
                    {suggestion.commodity ? ` • ${suggestion.commodity}` : ""}
                    {" • "}
                    Add qty {Number(s.qty) > 0 ? Number(s.qty) : 1}
                  </p>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Input
              type="number"
              placeholder="Quantity"
              value={s.qty}
              onChange={(e) => s.setQty(e.target.value)}
              min="0.01"
              step="any"
            />
            <Input
              type="number"
              placeholder="Price per unit"
              value={s.price}
              onChange={(e) => s.setPrice(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <Button className="w-full mt-3" onClick={s.handleAddItem} loading={s.saving}>
            Add Item
          </Button>

          <div className="relative mt-3">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-[#080d14] px-2 text-xs text-muted">or</span></div>
          </div>

          <input
            ref={scanFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={s.handleShelfLabelCapture}
            className="hidden"
          />
          <Button
            variant="secondary"
            className="w-full mt-3"
            onClick={() => scanFileRef.current?.click()}
            loading={s.scanLoading && s.scanStep === "idle"}
          >
            Scan Shelf Label
          </Button>
        </Card>

        {/* Shelf Label Scan Flow */}
        {s.scanStep !== "idle" && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Shelf Label Scan</p>
              <button onClick={s.resetScan} className="text-xs text-primary">Cancel</button>
            </div>

            {s.scanStep === "scanning" && (
              <div className="flex items-center gap-3 py-4">
                <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-muted">Reading shelf label...</p>
              </div>
            )}

            {s.scanStep === "matched" && s.scanParsed && (
              <>
                <Card className="bg-white/5 mb-3">
                  <p className="text-xs text-muted">Detected</p>
                  <p className="font-medium">{s.scanParsed.product_name ?? s.scanParsed.raw_text}</p>
                  <div className="flex gap-2 mt-1">
                    {s.scanParsed.size_descriptor && <Badge variant="info">{s.scanParsed.size_descriptor}</Badge>}
                    {s.scanParsed.unit_price != null && <Badge>{formatMoney(s.scanParsed.unit_price)}</Badge>}
                    {s.scanParsed.quantity > 1 && <Badge>x{s.scanParsed.quantity}</Badge>}
                  </div>
                </Card>

                <p className="text-sm text-muted mb-2">Select the matching item:</p>
                <div className="space-y-2">
                  {s.scanMatches.map((match) => (
                    <Card key={match.inventory_item_id} onClick={() => s.handleConfirmScanMatch(match)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{match.item_name}</p>
                          <Badge
                            variant={
                              match.confidence === "high" ? "success" :
                              match.confidence === "medium" ? "warning" : "danger"
                            }
                          >
                            {Math.round(match.score * 100)}% match
                          </Badge>
                        </div>
                        <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="relative mt-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-[#080d14] px-2 text-xs text-muted">not listed?</span></div>
                </div>
                <Button variant="secondary" className="w-full mt-3" onClick={() => s.resetScan()}>
                  None of these — add new item
                </Button>
              </>
            )}

            {s.scanStep === "not_found" && (
              <ItemNotFound
                detectedText={s.scanParsed?.product_name ?? ""}
                onItemSelected={s.handleScanNewItem}
                onCancel={s.resetScan}
              />
            )}

            {s.scanError && <p className="text-sm text-danger mt-2">{s.scanError}</p>}
          </Card>
        )}

        <div className="space-y-2">
          {(session.items ?? []).map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{displayShoppingItemName(item.raw_name)}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant={item.origin === "staged" ? "info" : "default"}>{item.origin}</Badge>
                    <Badge variant={reconVariant[item.reconciliation_status]}>
                      {reconLabel[item.reconciliation_status]}
                    </Badge>
                    {getItemBarcodeBadgeValue(item) && (
                      <Badge variant="warning">UPC {getItemBarcodeBadgeValue(item)}</Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => s.handleRemoveItem(item.id)}
                  className="text-xs text-danger hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <Input
                  type="number"
                  defaultValue={asNumber(item.quantity)}
                  min="0.01"
                  step="any"
                  onBlur={(e) => s.handleUpdateItem(item, { quantity: Number(e.target.value) || 1 })}
                />
                <Input
                  type="number"
                  defaultValue={item.staged_unit_price != null ? asNumber(item.staged_unit_price) : ""}
                  min="0"
                  step="0.01"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    s.handleUpdateItem(item, { unit_price: val ? Number(val) : null });
                  }}
                />
                <Button variant="secondary" onClick={() => s.handleUpdateItem(item, { name: item.raw_name })}>
                  Save
                </Button>
              </div>

              <div className="mt-2 text-xs text-muted">
                Staged: {formatMoney(item.staged_line_total)} {item.receipt_line_total != null && `• Receipt: ${formatMoney(item.receipt_line_total)}`}
              </div>

              {item.reconciliation_status !== "exact" && item.resolution === "pending" && (
                s.receiptScanIncomplete ? (
                  <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-200/90">
                      Receipt scan is incomplete. Rescan the receipt instead of resolving this item manually.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Rescan Receipt
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    <Button size="sm" variant="secondary" onClick={() => s.handleResolve(item.id, "accept_staged")}>
                      Keep Staged
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => s.handleResolve(item.id, "accept_receipt")}>
                      Use Receipt
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => s.handleResolve(item.id, "skip")}>
                      Skip
                    </Button>
                  </div>
                )
              )}
            </Card>
          ))}
          {session.items.length === 0 && (
            <p className="text-sm text-muted text-center py-6">Your basket is empty</p>
          )}
        </div>

        <input
          ref={fallbackPhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={s.handleFallbackPhotoCapture}
          className="hidden"
        />

        {session.receipt_id && !s.receiptScanIncomplete && s.unresolvedScannedBarcodeItems.length > 0 && (
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Manual Barcode-to-Receipt Pairing</p>
                <p className="mt-1 text-xs text-muted">
                  Use this when automatic pairing could not confidently match scanned barcodes to receipt items. You can optionally add an item photo first to improve web/AI fallback hints before pairing.
                </p>
              </div>
              <Badge variant="warning">
                {s.unresolvedScannedBarcodeItems.length} unresolved barcode{s.unresolvedScannedBarcodeItems.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {s.unmatchedReceiptItems.length === 0 ? (
              <p className="mt-3 text-xs text-muted">
                No unmatched receipt items remain to pair.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {s.unresolvedScannedBarcodeItems.map((barcodeItem) => (
                  <div
                    key={`pair-${barcodeItem.id}`}
                    className="rounded-2xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {displayShoppingItemName(barcodeItem.raw_name)}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          UPC {getItemBarcodeBadgeValue(barcodeItem)}
                          {barcodeItem.staged_line_total != null
                            ? ` • Staged ${formatMoney(barcodeItem.staged_line_total)}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="info">Scanned Barcode</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={s.fallbackPhotoLoadingItemId === barcodeItem.id}
                        onClick={() => s.handleRequestFallbackPhoto(barcodeItem.id)}
                      >
                        Take Item Photo
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={s.webFallbackLoadingItemId === barcodeItem.id}
                        onClick={() => s.handleTryWebFallbackSuggestion(barcodeItem.id)}
                      >
                        Try Web/AI Suggestion
                      </Button>
                    </div>

                    {s.photoFallbackAnalysisByItemId[barcodeItem.id] && (
                      <div className="mt-3 rounded-xl border border-border p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Photo Hints
                        </p>
                        <p className="mt-1 text-sm">
                          {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.product_name &&
                          s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.product_name !== "Unknown Product"
                            ? s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.product_name
                            : "OCR captured item text"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.brand && (
                            <Badge variant="info">
                              {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.brand}
                            </Badge>
                          )}
                          {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.quantity_description && (
                            <Badge>
                              {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.quantity_description}
                            </Badge>
                          )}
                          {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.weight && (
                            <Badge>
                              {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.weight}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {s.webFallbackSuggestionByItemId[barcodeItem.id] && (
                      <div className="mt-3 rounded-xl border border-border p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Web/AI Fallback Suggestion
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {s.webFallbackSuggestionByItemId[barcodeItem.id].rationale}
                        </p>
                        {s.webFallbackSuggestionByItemId[barcodeItem.id].auto_apply_reason && (
                          <p className="mt-1 text-xs text-muted">
                            {s.webFallbackSuggestionByItemId[barcodeItem.id].auto_apply_reason}
                          </p>
                        )}
                        {s.webFallbackSuggestionByItemId[barcodeItem.id].auto_apply_eligible && (
                          <div className="mt-2">
                            <Badge variant="success">Auto-Apply Eligible</Badge>
                          </div>
                        )}

                        {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result && (
                          <>
                            <p className="mt-2 text-sm font-semibold">
                              {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.canonical_name}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.brand && (
                                <Badge variant="info">
                                  {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.brand}
                                </Badge>
                              )}
                              {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.size && (
                                <Badge>
                                  {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.size}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.confidence_label === "high"
                                    ? "success"
                                    : s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.confidence_label === "medium"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                Web {Math.round((s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.confidence_score ?? 0) * 100)}%
                              </Badge>
                            </div>
                          </>
                        )}

                        {s.webFallbackSuggestionByItemId[barcodeItem.id].suggested_receipt_item_id && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                s.handleManualPairBarcodeToReceipt(
                                  barcodeItem.id,
                                  s.webFallbackSuggestionByItemId[barcodeItem.id]
                                    .suggested_receipt_item_id as string,
                                  "web_suggestion_manual"
                                )
                              }
                              loading={s.saving}
                            >
                              Apply Suggested Pair
                            </Button>
                          </div>
                        )}

                        {s.webFallbackSuggestionByItemId[barcodeItem.id].pair_suggestions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {s.webFallbackSuggestionByItemId[barcodeItem.id].pair_suggestions
                              .slice(0, 3)
                              .map((suggestion) => (
                                <Button
                                  key={`web-suggest-${barcodeItem.id}-${suggestion.receipt_item_id}`}
                                  variant="secondary"
                                  size="sm"
                                  className="w-full justify-between"
                                  onClick={() =>
                                    s.handleManualPairBarcodeToReceipt(
                                      barcodeItem.id,
                                      suggestion.receipt_item_id,
                                      "web_suggestion_manual"
                                    )
                                  }
                                  loading={s.saving}
                                >
                                  <span className="truncate text-left">{suggestion.receipt_name}</span>
                                  <span className="ml-2 text-xs opacity-80">
                                    {Math.round(suggestion.score * 100)}%
                                  </span>
                                </Button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 grid gap-2">
                      {s.unmatchedReceiptItems.map((receiptItem) => (
                        <Button
                          key={`pair-choice-${barcodeItem.id}-${receiptItem.id}`}
                          variant="secondary"
                          className="w-full justify-between"
                          loading={s.saving}
                          onClick={() =>
                            s.handleManualPairBarcodeToReceipt(barcodeItem.id, receiptItem.id)
                          }
                        >
                          <span className="truncate text-left">
                            {displayShoppingItemName(receiptItem.raw_name)}
                          </span>
                          <span className="ml-2 text-xs opacity-80">
                            {formatMoney(receiptItem.receipt_line_total ?? receiptItem.staged_line_total)}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <div ref={receiptSectionRef}>
          <Card className="p-5">
          <p className="text-sm font-semibold mb-2">Checkout Receipt</p>
          <p className="text-xs text-muted mb-3">
            Take a photo of your receipt to auto-scan and reconcile items. This is the authoritative phase for final matching and deferred fallback resolution.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={s.handleReceiptScan}
            className="hidden"
          />
          <Button
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            loading={s.receiptScanning}
          >
            {s.receiptScanning ? "Scanning Receipt..." : "Scan Receipt"}
          </Button>
          {s.receiptScanning && (
            <p className="text-xs text-muted text-center mt-2 animate-pulse">
              Processing with TabScanner — this may take a few seconds...
            </p>
          )}
          </Card>
        </div>

        {s.notice && <p className="text-sm text-cyan-300">{s.notice}</p>}
        {s.error && <p className="text-sm text-danger">{s.error}</p>}
      </div>

      <div className="fixed left-0 right-0 bottom-24 z-40 px-3">
        <div className="max-w-lg mx-auto rounded-2xl border border-white/18 bg-[linear-gradient(160deg,rgba(8,24,43,0.9)_0%,rgba(5,17,32,0.86)_55%,rgba(7,18,34,0.9)_100%)] p-3 text-white shadow-[0_18px_42px_rgba(3,8,18,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-white/70">Basket Total</p>
              <p className="text-xl font-bold">{formatMoney(s.basketTotal)}</p>
            </div>
            <Button
              className="min-w-[160px]"
              onClick={s.handleCommit}
              loading={s.commitLoading}
              disabled={session.status !== "ready" || s.receiptTotalMismatch}
            >
              Confirm & Commit
            </Button>
          </div>
          {session.receipt_id && (
            <p className="mt-2 text-xs text-white/65">
              Receipt total: {formatMoney(session.receipt_total)}{" "}
              <span className="text-white/35">|</span>{" "}
              Selected + tax: {formatMoney(s.selectedTotalWithTax)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
