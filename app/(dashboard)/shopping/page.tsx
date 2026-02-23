"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/nav/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addShoppingSessionItem,
  addShelfLabelItem,
  commitShoppingSession,
  getActiveShoppingSession,
  scanAndReconcileReceipt,
  removeShoppingSessionItem,
  resolveShoppingSessionItem,
  scanShelfLabel,
  startShoppingSession,
  updateShoppingSessionItem,
} from "@/app/actions/shopping";
import { ItemNotFound } from "@/components/flows/item-not-found";
import type { ShelfLabelResult } from "@/lib/parsers/shelf-label";
import type { MatchResult } from "@/lib/matching/engine";
import { uploadReceiptImageAction } from "@/app/actions/upload";
import { compressImage } from "@/lib/utils/compress-image";
import {
  autocompletePlaces,
  getPlaceDetails,
  loadGooglePlaces,
  type PlaceDetails,
  type PlacePrediction,
} from "@/lib/google/places";

type SessionStatus = "draft" | "reconciling" | "ready" | "committed" | "cancelled";

interface ShoppingItem {
  id: string;
  origin: "staged" | "receipt";
  raw_name: string;
  quantity: number | string;
  unit: string;
  staged_unit_price: number | string | null;
  staged_line_total: number | string | null;
  receipt_quantity: number | string | null;
  receipt_unit_price: number | string | null;
  receipt_line_total: number | string | null;
  delta_quantity: number | string | null;
  delta_price: number | string | null;
  reconciliation_status:
    | "pending"
    | "exact"
    | "quantity_mismatch"
    | "price_mismatch"
    | "missing_on_receipt"
    | "extra_on_receipt";
  resolution: "pending" | "accept_staged" | "accept_receipt" | "skip";
}

interface ShoppingSession {
  id: string;
  status: SessionStatus;
  store_name: string | null;
  store_address: string | null;
  store_lat: number | string | null;
  store_lng: number | string | null;
  staged_subtotal: number | string | null;
  receipt_total: number | string | null;
  tax_total: number | string | null;
  items: ShoppingItem[];
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const reconLabel: Record<ShoppingItem["reconciliation_status"], string> = {
  pending: "Pending",
  exact: "Verified",
  quantity_mismatch: "Qty mismatch",
  price_mismatch: "Price mismatch",
  missing_on_receipt: "Missing",
  extra_on_receipt: "Extra",
};

const reconVariant: Record<ShoppingItem["reconciliation_status"], "default" | "success" | "warning" | "danger"> = {
  pending: "default",
  exact: "success",
  quantity_mismatch: "warning",
  price_mismatch: "warning",
  missing_on_receipt: "danger",
  extra_on_receipt: "warning",
};

function asNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value) || 0;
}

function formatMoney(value: number | string | null | undefined): string {
  return `$${asNumber(value).toFixed(2)}`;
}

export default function ShoppingPage() {
  const router = useRouter();
  const [session, setSession] = useState<ShoppingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const [receiptScanning, setReceiptScanning] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shelf label scan state
  type ScanStep = "idle" | "scanning" | "matched" | "not_found";
  const [scanStep, setScanStep] = useState<ScanStep>("idle");
  const [scanParsed, setScanParsed] = useState<ShelfLabelResult | null>(null);
  const [scanMatches, setScanMatches] = useState<MatchResult[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const scanFileRef = useRef<HTMLInputElement>(null);

  const [storeQuery, setStoreQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [selectedStore, setSelectedStore] = useState<PlaceDetails | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);

  const unresolvedCount = useMemo(
    () =>
      (session?.items ?? []).filter(
        (item) => item.reconciliation_status !== "exact" && item.resolution === "pending"
      ).length,
    [session]
  );

  const basketTotal = useMemo(() => {
    if (!session) return 0;
    return session.items
      .filter((item) => item.resolution !== "skip")
      .reduce((sum, item) => {
        const receipt = asNumber(item.receipt_line_total);
        if (receipt > 0) return sum + receipt;
        return sum + asNumber(item.staged_line_total);
      }, 0);
  }, [session]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!API_KEY) {
          throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required");
        }
        await loadGooglePlaces(API_KEY);
        setPlacesReady(true);
        const active = await getActiveShoppingSession();
        setSession(active as ShoppingSession | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize shopping mode");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!placesReady) return;
    if (!storeQuery.trim() || selectedStore) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setPlacesLoading(true);
      try {
        const results = await autocompletePlaces(storeQuery.trim(), "ca");
        setSuggestions(results);
      } finally {
        setPlacesLoading(false);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [storeQuery, placesReady, selectedStore]);

  async function selectSuggestion(suggestion: PlacePrediction) {
    setError("");
    setPlacesLoading(true);
    try {
      const details = await getPlaceDetails(suggestion.place_id);
      setSelectedStore(details);
      setStoreQuery(suggestion.description);
      setSuggestions([]);
    } catch {
      setError("Could not load selected store details");
    } finally {
      setPlacesLoading(false);
    }
  }

  async function confirmStoreAndStart() {
    if (!selectedStore) return;
    setSaving(true);
    setError("");
    try {
      const created = await startShoppingSession({ store: selectedStore });
      setSession(created as ShoppingSession);
      setStoreQuery("");
      setSelectedStore(null);
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start shopping session");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem() {
    if (!session || !itemName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const updated = await addShoppingSessionItem({
        session_id: session.id,
        name: itemName.trim(),
        quantity: Number(qty) || 1,
        unit_price: price ? Number(price) : undefined,
      });
      setSession(updated as ShoppingSession);
      setItemName("");
      setQty("1");
      setPrice("");
    } catch {
      setError("Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItem(item: ShoppingItem, updates: { quantity?: number; unit_price?: number | null; name?: string }) {
    setSaving(true);
    setError("");
    try {
      const updated = await updateShoppingSessionItem(item.id, updates);
      setSession(updated as ShoppingSession);
    } catch {
      setError("Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    setSaving(true);
    setError("");
    try {
      const updated = await removeShoppingSessionItem(itemId);
      setSession(updated as ShoppingSession);
    } catch {
      setError("Failed to remove item");
    } finally {
      setSaving(false);
    }
  }

  async function handleReceiptScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setReceiptScanning(true);
    setError("");
    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);

      // Upload image to storage in parallel (non-blocking)
      const imageUrlPromise = uploadReceiptImageAction(base64, session.id).catch(() => null);

      // Scan and reconcile in one step via TabScanner
      const [updated, imageUrl] = await Promise.all([
        scanAndReconcileReceipt({
          session_id: session.id,
          base64_image: base64,
        }),
        imageUrlPromise,
      ]);

      // If image upload finished, attach it to the session (best effort)
      if (imageUrl && updated) {
        // Image URL is already stored via the upload action
      }

      setSession(updated as ShoppingSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan receipt");
    } finally {
      setReceiptScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleResolve(itemId: string, resolution: "accept_staged" | "accept_receipt" | "skip") {
    setSaving(true);
    setError("");
    try {
      const updated = await resolveShoppingSessionItem(itemId, { resolution });
      setSession(updated as ShoppingSession);
    } catch {
      setError("Failed to resolve mismatch");
    } finally {
      setSaving(false);
    }
  }

  async function handleCommit() {
    if (!session) return;
    setCommitLoading(true);
    setError("");
    try {
      await commitShoppingSession(session.id);
      setSession(null);
    } catch {
      setError("Failed to commit shopping session");
    } finally {
      setCommitLoading(false);
    }
  }

  function resetScan() {
    setScanStep("idle");
    setScanParsed(null);
    setScanMatches([]);
    setScanLoading(false);
    setScanError("");
  }

  async function handleShelfLabelCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setScanLoading(true);
    setScanError("");
    setScanStep("scanning");

    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);
      const { parsed, matches } = await scanShelfLabel({
        session_id: session.id,
        base64_image: base64,
      });

      setScanParsed(parsed);
      setScanMatches(matches);

      if (matches.length > 0) {
        setScanStep("matched");
      } else {
        setScanStep("not_found");
      }
    } catch {
      setScanError("Failed to read shelf label. Try again.");
      setScanStep("idle");
    } finally {
      setScanLoading(false);
      if (scanFileRef.current) scanFileRef.current.value = "";
    }
  }

  async function handleConfirmScanMatch(match: MatchResult) {
    if (!session || !scanParsed) return;
    setScanLoading(true);
    try {
      const updated = await addShelfLabelItem({
        session_id: session.id,
        parsed: scanParsed,
        inventory_item_id: match.inventory_item_id,
      });
      setSession(updated as ShoppingSession);
      resetScan();
    } catch {
      setScanError("Failed to add item");
    } finally {
      setScanLoading(false);
    }
  }

  async function handleScanNewItem(item: { id: string; name: string; unit: string }) {
    if (!session || !scanParsed) return;
    setScanLoading(true);
    try {
      const updated = await addShelfLabelItem({
        session_id: session.id,
        parsed: scanParsed,
        inventory_item_id: item.id,
      });
      setSession(updated as ShoppingSession);
      resetScan();
    } catch {
      setScanError("Failed to add item");
    } finally {
      setScanLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Shopping" />
        <div className="p-6 text-sm text-muted">Loading Shopping Mode...</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <PageHeader title="Choose Store" />
        <div className="p-4 space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold mb-1">Start Shopping Session</p>
            <p className="text-xs text-muted mb-4">
              Use Google Places to choose your store. Free-text stores are disabled.
            </p>
            <Input
              label="Store Search"
              placeholder="Search grocery or supplier store..."
              value={storeQuery}
              onChange={(e) => {
                setStoreQuery(e.target.value);
                setSelectedStore(null);
              }}
            />

            {!selectedStore && (suggestions.length > 0 || placesLoading) && (
              <div className="mt-2 rounded-2xl border border-border bg-card overflow-hidden">
                {placesLoading && (
                  <div className="px-4 py-3 text-xs text-muted">Searching stores...</div>
                )}
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    onClick={() => selectSuggestion(s)}
                    className="w-full px-4 py-3 text-left hover:bg-black/[0.04] transition-colors border-b last:border-b-0 border-border"
                  >
                    <p className="text-sm font-semibold">{s.primary_text}</p>
                    <p className="text-xs text-muted">{s.secondary_text || s.description}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {selectedStore && (
            <Card className="p-5">
              <p className="text-xs text-muted uppercase tracking-wide">Confirm Store</p>
              <h3 className="text-xl font-bold mt-1">{selectedStore.name}</h3>
              <p className="text-sm text-muted mt-1">{selectedStore.formatted_address}</p>
              <div className="mt-3 rounded-xl overflow-hidden border border-border">
                <iframe
                  title="Store location preview"
                  src={`https://www.google.com/maps?q=${selectedStore.lat},${selectedStore.lng}&z=15&output=embed`}
                  className="w-full h-36"
                  loading="lazy"
                />
              </div>
              <div className="mt-3 text-xs text-muted font-mono">
                Place ID: {selectedStore.place_id}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="secondary" onClick={() => setSelectedStore(null)}>
                  Change
                </Button>
                <Button onClick={confirmStoreAndStart} loading={saving}>
                  Start Shopping
                </Button>
              </div>
            </Card>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={() => router.push("/shopping/orders")}
            className="w-full text-sm text-primary font-medium py-2 text-center"
          >
            View Past Orders
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={session.store_name ?? "Shopping"} />
      <div className="p-4 pb-36 space-y-4">
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
              <p className="font-bold">{unresolvedCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Add To Basket</p>
          <Input
            placeholder="Search or type item name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Input
              type="number"
              placeholder="Quantity"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min="0.01"
              step="any"
            />
            <Input
              type="number"
              placeholder="Price per unit"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <Button className="w-full mt-3" onClick={handleAddItem} loading={saving}>
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
            onChange={handleShelfLabelCapture}
            className="hidden"
          />
          <Button
            variant="secondary"
            className="w-full mt-3"
            onClick={() => scanFileRef.current?.click()}
            loading={scanLoading && scanStep === "idle"}
          >
            Scan Shelf Label
          </Button>
        </Card>

        {/* Shelf Label Scan Flow */}
        {scanStep !== "idle" && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Shelf Label Scan</p>
              <button onClick={resetScan} className="text-xs text-primary">Cancel</button>
            </div>

            {scanStep === "scanning" && (
              <div className="flex items-center gap-3 py-4">
                <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-muted">Reading shelf label...</p>
              </div>
            )}

            {scanStep === "matched" && scanParsed && (
              <>
                <Card className="bg-white/5 mb-3">
                  <p className="text-xs text-muted">Detected</p>
                  <p className="font-medium">{scanParsed.product_name ?? scanParsed.raw_text}</p>
                  <div className="flex gap-2 mt-1">
                    {scanParsed.size_descriptor && <Badge variant="info">{scanParsed.size_descriptor}</Badge>}
                    {scanParsed.unit_price != null && <Badge>{formatMoney(scanParsed.unit_price)}</Badge>}
                    {scanParsed.quantity > 1 && <Badge>x{scanParsed.quantity}</Badge>}
                  </div>
                </Card>

                <p className="text-sm text-muted mb-2">Select the matching item:</p>
                <div className="space-y-2">
                  {scanMatches.map((match) => (
                    <Card key={match.inventory_item_id} onClick={() => handleConfirmScanMatch(match)}>
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
                <Button variant="secondary" className="w-full mt-3" onClick={() => setScanStep("not_found")}>
                  None of these — add new item
                </Button>
              </>
            )}

            {scanStep === "not_found" && (
              <ItemNotFound
                detectedText={scanParsed?.product_name ?? ""}
                onItemSelected={handleScanNewItem}
                onCancel={resetScan}
              />
            )}

            {scanError && <p className="text-sm text-danger mt-2">{scanError}</p>}
          </Card>
        )}

        <div className="space-y-2">
          {(session.items ?? []).map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.raw_name}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant={item.origin === "staged" ? "info" : "default"}>{item.origin}</Badge>
                    <Badge variant={reconVariant[item.reconciliation_status]}>
                      {reconLabel[item.reconciliation_status]}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
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
                  onBlur={(e) => handleUpdateItem(item, { quantity: Number(e.target.value) || 1 })}
                />
                <Input
                  type="number"
                  defaultValue={item.staged_unit_price != null ? asNumber(item.staged_unit_price) : ""}
                  min="0"
                  step="0.01"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    handleUpdateItem(item, { unit_price: val ? Number(val) : null });
                  }}
                />
                <Button variant="secondary" onClick={() => handleUpdateItem(item, { name: item.raw_name })}>
                  Save
                </Button>
              </div>

              <div className="mt-2 text-xs text-muted">
                Staged: {formatMoney(item.staged_line_total)} {item.receipt_line_total != null && `• Receipt: ${formatMoney(item.receipt_line_total)}`}
              </div>

              {item.reconciliation_status !== "exact" && item.resolution === "pending" && (
                <div className="grid grid-cols-3 gap-1 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => handleResolve(item.id, "accept_staged")}>
                    Keep Staged
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleResolve(item.id, "accept_receipt")}>
                    Use Receipt
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleResolve(item.id, "skip")}>
                    Skip
                  </Button>
                </div>
              )}
            </Card>
          ))}
          {session.items.length === 0 && (
            <p className="text-sm text-muted text-center py-6">Your basket is empty</p>
          )}
        </div>

        <Card className="p-5">
          <p className="text-sm font-semibold mb-2">Checkout Receipt</p>
          <p className="text-xs text-muted mb-3">
            Take a photo of your receipt to auto-scan and reconcile items.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceiptScan}
            className="hidden"
          />
          <Button
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            loading={receiptScanning}
          >
            {receiptScanning ? "Scanning Receipt..." : "Scan Receipt"}
          </Button>
          {receiptScanning && (
            <p className="text-xs text-muted text-center mt-2 animate-pulse">
              Processing with TabScanner — this may take a few seconds...
            </p>
          )}
        </Card>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="fixed left-0 right-0 bottom-16 z-40 px-3">
        <div className="max-w-lg mx-auto rounded-2xl border border-white/18 bg-[linear-gradient(160deg,rgba(8,24,43,0.9)_0%,rgba(5,17,32,0.86)_55%,rgba(7,18,34,0.9)_100%)] p-3 text-white shadow-[0_18px_42px_rgba(3,8,18,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-white/70">Basket Total</p>
              <p className="text-xl font-bold">{formatMoney(basketTotal)}</p>
            </div>
            <Button
              className="min-w-[160px]"
              onClick={handleCommit}
              loading={commitLoading}
              disabled={session.status !== "ready"}
            >
              Confirm & Commit
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
