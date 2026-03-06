"use client";

// Transitional wrapper during app-structure refactor.
// State + logic extracted to: src/features/shopping/ui/use-shopping-session.ts
// Types extracted to: src/features/shopping/ui/contracts.ts
// The JSX remains here (Route page must stay in app/) but delegates all state to the hook.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { ItemNotFound } from "@/components/flows/item-not-found";
import { useShoppingSession } from "@/features/shopping/ui/use-shopping-session";
import { ItemImage } from "@/shared/ui/item-image";
import { BarcodeCameraScanner } from "@/shared/ui/barcode-camera-scanner";
import { RECEIVE_UNIT_OPTIONS_COMPACT } from "@/features/receiving/shared/unit-options";
import {
  asNumber,
  formatMoney,
  displayShoppingItemName,
  getItemBarcodeBadgeValue,
  type ShoppingBarcodeLookup,
  type ShoppingBarcodePhotoDraft,
} from "@/features/shopping/ui/contracts";

const SHOPPING_HOST_SURFACE_CLASS = "design-glass-surface p-5";
const SHOPPING_HOST_SUBSURFACE_CLASS = "rounded-xl border border-border bg-foreground/[0.03] p-3";
const ITEM_PLU_SUFFIX_REGEX = /\(PLU\s*(\d{3,6})\)\s*$/i;

function splitItemNameAndPlu(rawName: string): {
  displayName: string;
  pluCode: string | null;
} {
  const displayName = displayShoppingItemName(rawName);
  const match = displayName.match(ITEM_PLU_SUFFIX_REGEX);
  if (!match) {
    return { displayName, pluCode: null };
  }

  const withoutPlu = displayName.replace(ITEM_PLU_SUFFIX_REGEX, "").trim();
  return {
    displayName: withoutPlu || displayName,
    pluCode: match[1] ?? null,
  };
}

export default function ShoppingPage() {
  const router = useRouter();

  // Refs must live in the component (React Compiler rule: no ref access during render from hooks)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barcodePhotoInputRef = useRef<HTMLInputElement>(null);
  const fallbackPhotoInputRef = useRef<HTMLInputElement>(null);
  const scanFileRef = useRef<HTMLInputElement>(null);

  const s = useShoppingSession({
    fileInputRef,
    fallbackPhotoInputRef,
    scanFileRef,
  });

  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeScannerStartSignal, setBarcodeScannerStartSignal] = useState(0);
  const [barcodeStep, setBarcodeStep] = useState<"scanner" | "result" | "photo">("scanner");
  const [barcodeLookup, setBarcodeLookup] = useState<ShoppingBarcodeLookup | null>(null);
  const [barcodePhotoDraft, setBarcodePhotoDraft] = useState<ShoppingBarcodePhotoDraft | null>(null);
  const [barcodeNameDraft, setBarcodeNameDraft] = useState("");
  const [barcodeUnitDraft, setBarcodeUnitDraft] = useState("each");
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  if (s.loading) {
    return (
      <main className="py-4 md:py-6">
        <DashboardPageContainer variant="standard">
          <div className="p-2 text-sm text-muted">Loading Shopping Mode...</div>
        </DashboardPageContainer>
      </main>
    );
  }

  if (!s.session) {
    return (
      <main className="py-4 md:py-6">
        <DashboardPageContainer variant="standard">
          <div className="space-y-4">
            <section className={SHOPPING_HOST_SURFACE_CLASS}>
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
              <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
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
          </section>

          {s.selectedStore && (
            <section className={SHOPPING_HOST_SURFACE_CLASS}>
              <p className="text-xs text-muted normal-case tracking-normal">Confirm Store</p>
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
            </section>
          )}

          {s.error && <p className="text-sm text-danger">{s.error}</p>}

          <button
            onClick={() => router.push("/shopping/orders")}
            className="w-full text-sm text-primary font-medium py-2 text-center"
          >
            View Past Orders
          </button>
          </div>
        </DashboardPageContainer>
      </main>
    );
  }

  const session = s.session;

  async function handleCheckout() {
    const committedSessionId = await s.handleCommit();
    if (!committedSessionId) return;
    router.push(`/shopping/orders/${committedSessionId}`);
  }

  function openBarcodeModal() {
    setBarcodeLookup(null);
    setBarcodePhotoDraft(null);
    setBarcodeNameDraft("");
    setBarcodeUnitDraft("each");
    setLastScannedBarcode(null);
    setBarcodeStep("scanner");
    setBarcodeModalOpen(true);
    setBarcodeScannerStartSignal((prev) => prev + 1);
  }

  function closeBarcodeModal() {
    setBarcodeModalOpen(false);
    setBarcodeStep("scanner");
    setBarcodeLookup(null);
    setBarcodePhotoDraft(null);
    setBarcodeNameDraft("");
    setBarcodeUnitDraft("each");
  }

  function scanAgain() {
    setBarcodeLookup(null);
    setBarcodePhotoDraft(null);
    setBarcodeNameDraft("");
    setBarcodeStep("scanner");
    setBarcodeScannerStartSignal((prev) => prev + 1);
  }

  async function handleDetectedBarcode(barcode: string) {
    setLastScannedBarcode(barcode);
    const lookup = await s.lookupBarcodeForCheckout(barcode);
    if (!lookup) return;
    setBarcodeLookup(lookup);
    setBarcodeStep("result");
  }

  async function handleConfirmResolvedAdd() {
    if (!barcodeLookup || barcodeLookup.status !== "resolved") return;
    const saved = await s.addResolvedBarcodeLookupToSession(barcodeLookup);
    if (!saved) return;
    closeBarcodeModal();
  }

  async function handleBarcodePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const barcodeHint = barcodeLookup?.normalized_barcode ?? lastScannedBarcode ?? null;
    const draft = await s.analyzeMissingBarcodePhoto(file, barcodeHint);
    if (barcodePhotoInputRef.current) {
      barcodePhotoInputRef.current.value = "";
    }
    if (!draft) return;

    setBarcodePhotoDraft(draft);
    setBarcodeNameDraft(draft.suggested_name);
    setBarcodeUnitDraft(draft.suggested_unit || "each");
    setBarcodeStep("photo");
  }

  async function handleCreateFromPhoto() {
    if (!barcodePhotoDraft) return;
    const barcodeToPersist =
      barcodePhotoDraft.inferred_barcode ??
      barcodeLookup?.normalized_barcode ??
      lastScannedBarcode;
    const saved = await s.createPhotoFallbackItemAndAddToSession({
      name: barcodeNameDraft,
      unit: barcodeUnitDraft,
      raw_text: barcodePhotoDraft.raw_text,
      barcode: barcodeToPersist,
    });
    if (!saved) return;
    closeBarcodeModal();
  }

  const commitSummaryCard = (
    <div className="design-glass-surface space-y-3 p-4 text-foreground">
      <div>
        <p className="text-xs text-muted">Basket Total</p>
        <p className="text-xl font-bold">{formatMoney(s.basketTotal)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleCheckout}
          loading={s.commitLoading || s.receiptScanning}
        >
          Checkout
        </Button>
        <Button
          variant="secondary"
          onClick={openBarcodeModal}
          disabled={s.commitLoading || s.receiptScanning || s.barcodeLookupLoading || s.barcodeCreateLoading}
        >
          Barcode
        </Button>
      </div>
      {session.receipt_id && (
        <p className="mt-2 text-xs text-muted">
          Receipt total: {formatMoney(session.receipt_total)}{" "}
          <span className="text-muted/60">|</span>{" "}
          Selected + tax: {formatMoney(s.selectedTotalWithTax)}
        </p>
      )}
      {s.receiptScanIncomplete && !s.receiptScanning && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold text-amber-300">
            Receipt scan incomplete
          </p>
          <p className="mt-1 text-xs text-amber-200/90">
            {s.receiptTotalMismatch
              ? (
                  s.receiptTotalMissing
                    ? "We could not read the receipt total from this scan. Scan the receipt again from Checkout."
                    : `Selected items + tax = ${formatMoney(s.selectedTotalWithTax)}, but scanned receipt total = ${formatMoney(session.receipt_total)}. Scan the receipt again from Checkout.`
                )
              : "This receipt scan was not 100% successful. Scan the receipt again from Checkout."}
          </p>
          {s.receiptTotalMismatch && s.receiptSubtotalMismatch && session.receipt_subtotal != null && (
            <p className="mt-1 text-xs text-amber-200/80">
              Selected subtotal = {formatMoney(s.basketTotal)}; scanned subtotal = {formatMoney(session.receipt_subtotal)}.
            </p>
          )}
        </div>
      )}
      <Button
        variant="danger"
        className="w-full"
        onClick={s.handleCancelSession}
        loading={s.cancelLoading}
      >
        Cancel Session
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={s.handleReceiptScan}
        className="hidden"
      />
    </div>
  );

  return (
    <>
      <main className="py-4 md:py-6">
        <DashboardPageContainer variant="full">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
            <div className="space-y-4 pb-52 md:pb-0">
        <section className={SHOPPING_HOST_SURFACE_CLASS}>
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
            <div className="mt-2 overflow-hidden rounded-xl border border-border bg-foreground/[0.02]">
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
            <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted">or</span></div>
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
        </section>

        {/* Shelf Label Scan Flow */}
        {s.scanStep !== "idle" && (
          <section className={SHOPPING_HOST_SURFACE_CLASS}>
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
                <div className={`${SHOPPING_HOST_SUBSURFACE_CLASS} mb-3`}>
                  <p className="text-xs text-muted">Detected</p>
                  <p className="font-medium">{s.scanParsed.product_name ?? s.scanParsed.raw_text}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {s.scanParsed.size_descriptor && <Badge variant="info">{s.scanParsed.size_descriptor}</Badge>}
                    <p className="text-xs text-muted">
                      {s.scanParsed.unit_price != null ? formatMoney(s.scanParsed.unit_price) : ""}
                      {s.scanParsed.quantity > 1 ? ` x${s.scanParsed.quantity}` : ""}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted mb-2">Select the matching item:</p>
                <div className="space-y-2">
                  {s.scanMatches.map((match) => (
                    <Card
                      key={match.inventory_item_id}
                      className="border-border bg-foreground/[0.03] p-3"
                      onClick={() => s.handleConfirmScanMatch(match)}
                    >
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
                  <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted">not listed?</span></div>
                </div>
                <Button variant="secondary" className="w-full mt-3" onClick={() => s.resetScan()}>
                  None of these - add new item
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
          </section>
        )}

        <div className="design-glass-surface p-4">
          {s.items.map((item, index) => {
            const { displayName, pluCode } = splitItemNameAndPlu(item.raw_name);
            return (
              <div
                key={item.id}
                className={`py-3 ${index !== s.items.length - 1 ? "border-b border-border/60" : ""}`}
              >
              <div className="flex items-center gap-3">
                <ItemImage
                  src={item.inventory_item?.image_url ?? null}
                  name={displayName}
                  category={item.inventory_item?.category?.name ?? null}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">
                    {displayName}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {formatMoney(
                      item.staged_line_total != null
                        ? item.staged_line_total
                        : item.staged_unit_price
                    )}
                  </p>
                  {pluCode && (
                    <p className="mt-0.5 text-xs text-muted">PLU {pluCode}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-full border border-border bg-foreground/[0.03] p-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-full px-0"
                    onClick={() =>
                      s.handleUpdateItem(item, {
                        quantity: Math.max(1, (asNumber(item.quantity) || 1) - 1),
                      })
                    }
                    aria-label="Decrease quantity"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M4.5 10h11"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Button>
                  <span className="w-7 text-center text-sm font-semibold text-foreground">
                    {asNumber(item.quantity) || 1}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-full px-0"
                    onClick={() =>
                      s.handleUpdateItem(item, {
                        quantity: (asNumber(item.quantity) || 1) + 1,
                      })
                    }
                    aria-label="Increase quantity"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M10 4.5v11M4.5 10h11"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 rounded-full px-0 text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => s.handleRemoveItem(item.id)}
                  aria-label="Remove item"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M5.8 6.2h8.4l-.5 9a1.2 1.2 0 0 1-1.2 1.1H7.5a1.2 1.2 0 0 1-1.2-1.1l-.5-9ZM7.8 6.2V5.1c0-.6.5-1.1 1.1-1.1h2.2c.6 0 1.1.5 1.1 1.1v1.1M4.8 6.2h10.4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
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
                  <div className="mt-3 grid grid-cols-3 gap-1">
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
              </div>
            );
          })}
          {s.items.length === 0 && (
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
          <section className={SHOPPING_HOST_SURFACE_CLASS}>
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
                    className={SHOPPING_HOST_SUBSURFACE_CLASS}
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
                      <span className="text-xs text-muted">Scanned barcode</span>
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
                      <div className={`mt-3 ${SHOPPING_HOST_SUBSURFACE_CLASS}`}>
                        <p className="text-xs font-semibold normal-case tracking-normal text-muted">
                          Photo Hints
                        </p>
                        <p className="mt-1 text-sm">
                          {s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.product_name &&
                          s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.product_name !== "Unknown Product"
                            ? s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.product_name
                            : "OCR captured item text"}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          {[
                            s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.brand,
                            s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.quantity_description,
                            s.photoFallbackAnalysisByItemId[barcodeItem.id].product_info?.weight,
                          ].filter(Boolean).join(" - ")}
                        </p>
                      </div>
                    )}

                    {s.webFallbackSuggestionByItemId[barcodeItem.id] && (
                      <div className={`mt-3 ${SHOPPING_HOST_SUBSURFACE_CLASS}`}>
                        <p className="text-xs font-semibold normal-case tracking-normal text-muted">
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
                        {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result && (
                          <>
                            <p className="mt-2 text-sm font-semibold">
                              {s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.canonical_name}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className="text-xs text-muted">
                                {[
                                  s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.brand,
                                  s.webFallbackSuggestionByItemId[barcodeItem.id].web_result?.structured.size,
                                ].filter(Boolean).join(" - ")}
                              </p>
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
          </section>
        )}


        {s.notice && <p className="text-sm text-primary">{s.notice}</p>}
        {s.error && <p className="text-sm text-danger">{s.error}</p>}
            </div>

            <aside className="hidden md:block">
              <div className="sticky top-4">
                {commitSummaryCard}
              </div>
            </aside>
          </div>
        </DashboardPageContainer>
      </main>

      <div className="fixed left-0 right-0 bottom-0 z-40 px-3 pb-3 md:hidden">
        <div className="mx-auto max-w-lg">
          {commitSummaryCard}
        </div>
      </div>

      <input
        ref={barcodePhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleBarcodePhotoCapture}
        className="hidden"
      />

      {barcodeModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-[540px] rounded-2xl border border-border bg-card p-4 shadow-[var(--surface-card-shadow)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {barcodeStep === "scanner"
                  ? "Scan Barcode"
                  : barcodeStep === "result"
                    ? "Review Scan"
                    : "Create Item From Photo"}
              </p>
              <Button variant="ghost" size="sm" onClick={closeBarcodeModal}>
                Close
              </Button>
            </div>

            {barcodeStep === "scanner" && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted">
                  Point the camera at the barcode. If decode fails, use photo fallback.
                </p>
                <BarcodeCameraScanner
                  showTrigger={false}
                  startSignal={barcodeScannerStartSignal}
                  disabled={s.barcodeLookupLoading || s.barcodePhotoAnalyzeLoading || s.barcodeCreateLoading}
                  onDetected={(detectedBarcode) => {
                    void handleDetectedBarcode(detectedBarcode);
                  }}
                  helperText="The scanner auto-detects UPC/EAN and moves to review."
                  cancelLabel="Stop Scanner"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => barcodePhotoInputRef.current?.click()}
                    loading={s.barcodePhotoAnalyzeLoading}
                  >
                    Take Item Photo
                  </Button>
                  <Button variant="ghost" onClick={closeBarcodeModal}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {barcodeStep === "result" && barcodeLookup?.status === "resolved" && (
              <div className="mt-3 space-y-3">
                <div className={SHOPPING_HOST_SUBSURFACE_CLASS}>
                  <div className="flex items-start gap-3">
                    <ItemImage
                      src={barcodeLookup.item.image_url}
                      name={barcodeLookup.item.name}
                      category={barcodeLookup.item.category?.name ?? null}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{barcodeLookup.item.name}</p>
                      <p className="text-xs text-muted">UPC {barcodeLookup.normalized_barcode}</p>
                      <p className="text-xs text-muted">
                        Source {barcodeLookup.source.replace(/_/g, " ")} • {barcodeLookup.confidence} confidence
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => void handleConfirmResolvedAdd()} loading={s.barcodeCreateLoading}>
                    Confirm &amp; Add
                  </Button>
                  <Button variant="secondary" onClick={scanAgain}>
                    Scan Again
                  </Button>
                </div>
              </div>
            )}

            {barcodeStep === "result" && barcodeLookup && barcodeLookup.status !== "resolved" && (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/12 p-3">
                  <p className="text-sm font-semibold text-amber-200">Item not found in your inventory</p>
                  <p className="mt-1 text-xs text-amber-100/90">
                    {barcodeLookup.status === "resolved_external"
                      ? "We found external metadata, but this barcode is not mapped to your items yet."
                      : "No internal item mapping was found for this scan."}
                  </p>
                  {barcodeLookup.normalized_barcode && (
                    <p className="mt-1 text-xs text-amber-100/90">UPC {barcodeLookup.normalized_barcode}</p>
                  )}
                </div>

                {barcodeLookup.status === "resolved_external" && (
                  <div className={SHOPPING_HOST_SUBSURFACE_CLASS}>
                    <div className="flex items-start gap-3">
                      <ItemImage
                        src={barcodeLookup.metadata.image_url}
                        name={barcodeLookup.metadata.name}
                        category={barcodeLookup.metadata.category_hint}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{barcodeLookup.metadata.name}</p>
                        <p className="text-xs text-muted">
                          {[barcodeLookup.metadata.brand, barcodeLookup.metadata.size_text]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => barcodePhotoInputRef.current?.click()}
                    loading={s.barcodePhotoAnalyzeLoading}
                  >
                    Take Item Photo
                  </Button>
                  <Button variant="secondary" onClick={scanAgain}>
                    Scan Again
                  </Button>
                </div>
              </div>
            )}

            {barcodeStep === "photo" && barcodePhotoDraft && (
              <div className="mt-3 space-y-3">
                <div className={SHOPPING_HOST_SUBSURFACE_CLASS}>
                  <p className="text-xs text-muted">Detected from photo</p>
                  <p className="text-sm font-semibold text-foreground">{barcodeNameDraft || "New Item"}</p>
                  <p className="mt-1 text-xs text-muted">
                    {barcodePhotoDraft.inferred_barcode
                      ? `Barcode to save: ${barcodePhotoDraft.inferred_barcode}`
                      : "No barcode detected from image; item will be created without barcode mapping."}
                  </p>
                </div>

                <Input
                  label="Item Name"
                  value={barcodeNameDraft}
                  onChange={(e) => setBarcodeNameDraft(e.target.value)}
                  placeholder="Enter item name"
                />
                <Select
                  label="Unit"
                  value={barcodeUnitDraft}
                  onChange={(e) => setBarcodeUnitDraft(e.target.value)}
                  options={RECEIVE_UNIT_OPTIONS_COMPACT.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />

                {barcodePhotoDraft.product_info && (
                  <p className="text-xs text-muted">
                    {[barcodePhotoDraft.product_info.brand, barcodePhotoDraft.product_info.quantity_description, barcodePhotoDraft.product_info.weight]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => void handleCreateFromPhoto()}
                    loading={s.barcodeCreateLoading}
                    disabled={!barcodeNameDraft.trim()}
                  >
                    Save &amp; Add
                  </Button>
                  <Button variant="secondary" onClick={scanAgain}>
                    Scan Again
                  </Button>
                </div>
              </div>
            )}

            {s.error && <p className="mt-3 text-sm text-danger">{s.error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

