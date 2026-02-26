"use client";

/**
 * Shopping session hook.
 * Encapsulates all state management and action handlers for the shopping page.
 */

import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  addShoppingSessionItem,
  addShoppingSessionItemByBarcodeQuick,
  addShelfLabelItem,
  analyzeShoppingSessionBarcodeItemPhoto,
  cancelShoppingSession,
  commitShoppingSession,
  getActiveShoppingSession,
  pairShoppingSessionBarcodeItemToReceiptItem,
  scanAndReconcileReceipt,
  suggestShoppingSessionBarcodeReceiptPairWithWebFallback,
  removeShoppingSessionItem,
  resolveShoppingSessionItem,
  scanShelfLabel,
  startShoppingSession,
  updateShoppingSessionItem,
} from "@/app/actions/modules/shopping";
import { uploadReceiptImageAction } from "@/app/actions/core/upload";
import { compressImage } from "@/core/utils/compress-image";
import {
  autocompletePlaces,
  getPlaceDetails,
  loadGooglePlaces,
  type PlaceDetails,
  type PlacePrediction,
} from "@/lib/google/places";
import type { ShelfLabelResult } from "@/domain/parsers/shelf-label";
import type { MatchResult } from "@/core/matching/engine";
import {
  asNumber,
  roundMoney,
  type ShoppingSession,
  type ShoppingItem,
  type ShoppingFallbackPhotoAnalysis,
  type ShoppingWebFallbackSuggestion,
  type QuickScanFeedback,
} from "./contracts";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type ScanStep = "idle" | "scanning" | "matched" | "not_found";

export type ShoppingSessionRefs = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  quickBarcodeInputRef: RefObject<HTMLInputElement | null>;
  receiptSectionRef: RefObject<HTMLDivElement | null>;
  fallbackPhotoInputRef: RefObject<HTMLInputElement | null>;
  scanFileRef: RefObject<HTMLInputElement | null>;
};

export function useShoppingSession(refs: ShoppingSessionRefs) {
  const { fileInputRef, quickBarcodeInputRef, receiptSectionRef, fallbackPhotoInputRef, scanFileRef } = refs;

  const [session, setSession] = useState<ShoppingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [quickBarcode, setQuickBarcode] = useState("");
  const [quickScanLoading, setQuickScanLoading] = useState(false);
  const [quickScanFeedback, setQuickScanFeedback] = useState<QuickScanFeedback | null>(null);

  const [receiptScanning, setReceiptScanning] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [fallbackPhotoTargetItemId, setFallbackPhotoTargetItemId] = useState<string | null>(null);
  const [photoFallbackAnalysisByItemId, setPhotoFallbackAnalysisByItemId] = useState<
    Record<string, ShoppingFallbackPhotoAnalysis>
  >({});
  const [webFallbackSuggestionByItemId, setWebFallbackSuggestionByItemId] = useState<
    Record<string, ShoppingWebFallbackSuggestion>
  >({});
  const [fallbackPhotoLoadingItemId, setFallbackPhotoLoadingItemId] = useState<string | null>(null);
  const [webFallbackLoadingItemId, setWebFallbackLoadingItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Shelf label scan state
  const [scanStep, setScanStep] = useState<ScanStep>("idle");
  const [scanParsed, setScanParsed] = useState<ShelfLabelResult | null>(null);
  const [scanMatches, setScanMatches] = useState<MatchResult[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");

  const [storeQuery, setStoreQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [selectedStore, setSelectedStore] = useState<PlaceDetails | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);

  // ─── Computed values ─────────────────────────────────────

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
        const useReceipt =
          item.origin === "receipt" || item.resolution === "accept_receipt";
        if (useReceipt) {
          const receipt = asNumber(item.receipt_line_total);
          if (receipt > 0) return sum + receipt;
        }
        return sum + asNumber(item.staged_line_total);
      }, 0);
  }, [session]);

  const selectedTotalWithTax = useMemo(() => {
    if (!session) return 0;
    return roundMoney(basketTotal + asNumber(session.tax_total));
  }, [basketTotal, session]);

  const unresolvedScannedBarcodeItems = useMemo(
    () =>
      (session?.items ?? []).filter(
        (item) =>
          item.origin === "staged" &&
          Boolean(item.scanned_barcode) &&
          !item.receipt_line_item_id &&
          item.resolution === "pending"
      ),
    [session]
  );

  const unmatchedReceiptItems = useMemo(
    () =>
      (session?.items ?? []).filter(
        (item) =>
          item.origin === "receipt" &&
          Boolean(item.receipt_line_item_id) &&
          item.resolution === "pending"
      ),
    [session]
  );

  const receiptTotalDelta = useMemo(() => {
    if (!session?.receipt_id || session.receipt_total == null) return null;
    return roundMoney(selectedTotalWithTax - asNumber(session.receipt_total));
  }, [selectedTotalWithTax, session]);

  const receiptSubtotalDelta = useMemo(() => {
    if (!session?.receipt_id || session.receipt_subtotal == null) return null;
    return roundMoney(basketTotal - asNumber(session.receipt_subtotal));
  }, [basketTotal, session]);

  const receiptTotalMissing = Boolean(session?.receipt_id) && session?.receipt_total == null;
  const receiptSubtotalMismatch =
    Boolean(session?.receipt_id) &&
    receiptSubtotalDelta != null &&
    Math.abs(receiptSubtotalDelta) > 0.01;
  const receiptTotalMismatch =
    Boolean(session?.receipt_id) &&
    (
      receiptTotalMissing ||
      receiptTotalDelta == null ||
      Math.abs(receiptTotalDelta) > 0.01 ||
      receiptSubtotalMismatch
    );
  const receiptScanIncomplete =
    Boolean(session?.receipt_id) && session?.status !== "ready";
  const blockingIssueCount = unresolvedCount + (receiptTotalMismatch ? 1 : 0);

  // ─── Effects ─────────────────────────────────────────────

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

  // ─── Handlers ────────────────────────────────────────────

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

  async function handleQuickBarcodeAdd() {
    if (!session || !quickBarcode.trim()) return;
    setQuickScanLoading(true);
    setError("");
    try {
      const result = await addShoppingSessionItemByBarcodeQuick({
        session_id: session.id,
        barcode: quickBarcode.trim(),
      });
      setSession(result.session as ShoppingSession);
      setQuickScanFeedback(result.quick_scan);
      setQuickBarcode("");
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => quickBarcodeInputRef.current?.focus());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add barcode item");
    } finally {
      setQuickScanLoading(false);
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
      const imageUrlPromise = uploadReceiptImageAction(base64, session.id).catch(() => null);
      const [updated] = await Promise.all([
        scanAndReconcileReceipt({
          session_id: session.id,
          base64_image: base64,
        }),
        imageUrlPromise,
      ]);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve mismatch");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit shopping session");
    } finally {
      setCommitLoading(false);
    }
  }

  async function handleManualPairBarcodeToReceipt(
    stagedItemId: string,
    receiptItemId: string,
    source: "manual" | "web_suggestion_manual" | "web_suggestion_auto" = "manual"
  ) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await pairShoppingSessionBarcodeItemToReceiptItem({
        staged_item_id: stagedItemId,
        receipt_item_id: receiptItemId,
        source,
      });
      setSession(updated as ShoppingSession);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pair barcode item to receipt item");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleRequestFallbackPhoto(itemId: string) {
    setFallbackPhotoTargetItemId(itemId);
    fallbackPhotoInputRef.current?.click();
  }

  async function handleFallbackPhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = fallbackPhotoTargetItemId;
    if (!file || !itemId) return;

    setFallbackPhotoLoadingItemId(itemId);
    setError("");
    setNotice("");
    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);
      const result = await analyzeShoppingSessionBarcodeItemPhoto({
        staged_item_id: itemId,
        base64_image: base64,
      });

      if (!result.success || !result.analysis) {
        setError(result.error ?? "Failed to analyze item photo");
        return;
      }

      setPhotoFallbackAnalysisByItemId((prev) => ({
        ...prev,
        [itemId]: result.analysis,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze item photo");
    } finally {
      setFallbackPhotoLoadingItemId(null);
      setFallbackPhotoTargetItemId(null);
      if (fallbackPhotoInputRef.current) fallbackPhotoInputRef.current.value = "";
    }
  }

  async function handleTryWebFallbackSuggestion(itemId: string) {
    setWebFallbackLoadingItemId(itemId);
    setError("");
    setNotice("");
    try {
      const result = await suggestShoppingSessionBarcodeReceiptPairWithWebFallback({
        staged_item_id: itemId,
        photo_analysis: photoFallbackAnalysisByItemId[itemId] ?? null,
      });

      if (!result.success) {
        setError("Web fallback suggestion failed");
        return;
      }

      setWebFallbackSuggestionByItemId((prev) => ({
        ...prev,
        [itemId]: result.fallback as ShoppingWebFallbackSuggestion,
      }));

      const fallback = result.fallback as ShoppingWebFallbackSuggestion;
      if (
        fallback.status === "ok" &&
        fallback.auto_apply_eligible &&
        fallback.suggested_receipt_item_id
      ) {
        const paired = await handleManualPairBarcodeToReceipt(
          itemId,
          fallback.suggested_receipt_item_id,
          "web_suggestion_auto"
        );
        if (paired) {
          setNotice(
            "High-confidence web/AI suggestion auto-applied. Review the updated reconciliation before commit."
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Web fallback suggestion failed");
    } finally {
      setWebFallbackLoadingItemId(null);
    }
  }

  async function handleCancelSession() {
    if (!session) return;
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm("Cancel this shopping session? Your staged items and reconciliation state will be discarded.");
    if (!confirmed) return;

    setCancelLoading(true);
    setError("");
    try {
      await cancelShoppingSession(session.id);
      setSession(null);
      setStoreQuery("");
      setSelectedStore(null);
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel session");
    } finally {
      setCancelLoading(false);
    }
  }

  function handleConcludeQuickShop() {
    receiptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return {
    // State
    session,
    loading,
    saving,
    error,
    itemName,
    setItemName,
    qty,
    setQty,
    price,
    setPrice,
    quickBarcode,
    setQuickBarcode,
    quickScanLoading,
    quickScanFeedback,
    receiptScanning,
    commitLoading,
    cancelLoading,
    notice,
    scanStep,
    scanParsed,
    scanMatches,
    scanLoading,
    scanError,
    storeQuery,
    setStoreQuery,
    suggestions,
    selectedStore,
    setSelectedStore,
    placesLoading,
    photoFallbackAnalysisByItemId,
    webFallbackSuggestionByItemId,
    fallbackPhotoLoadingItemId,
    webFallbackLoadingItemId,

    // Computed
    unresolvedCount,
    basketTotal,
    selectedTotalWithTax,
    unresolvedScannedBarcodeItems,
    unmatchedReceiptItems,
    receiptTotalDelta,
    receiptSubtotalDelta,
    receiptTotalMissing,
    receiptSubtotalMismatch,
    receiptTotalMismatch,
    receiptScanIncomplete,
    blockingIssueCount,

    // Handlers
    selectSuggestion,
    confirmStoreAndStart,
    handleAddItem,
    handleQuickBarcodeAdd,
    handleUpdateItem,
    handleRemoveItem,
    handleReceiptScan,
    handleResolve,
    handleCommit,
    handleManualPairBarcodeToReceipt,
    handleRequestFallbackPhoto,
    handleFallbackPhotoCapture,
    handleTryWebFallbackSuggestion,
    handleCancelSession,
    handleConcludeQuickShop,
    resetScan,
    handleShelfLabelCapture,
    handleConfirmScanMatch,
    handleScanNewItem,
  };
}
