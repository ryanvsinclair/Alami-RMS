"use client";

/**
 * Shopping session hook.
 * Encapsulates all state management and action handlers for the shopping page.
 */

import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  analyzeShoppingSessionBarcodeItemPhoto,
  cancelShoppingSession,
  checkoutShoppingSession,
  getActiveShoppingSession,
  pairShoppingSessionBarcodeItemToReceiptItem,
  searchProduceCatalog,
  scanAndReconcileReceipt,
  suggestShoppingSessionBarcodeReceiptPairWithWebFallback,
  resolveShoppingSessionItem,
  scanShelfLabel,
  startShoppingSession,
} from "@/app/actions/modules/shopping";
import { resolveBarcode } from "@/app/actions/core/barcode-resolver";
import { ocrImage } from "@/app/actions/modules/ocr";
import { uploadReceiptImageAction } from "@/app/actions/core/upload";
import { compressImage } from "@/shared/utils/compress-image";
import { normalizeBarcode } from "@/core/utils/barcode";
import type { IntakeItemSource } from "@/features/intake/shared";
import type { UnitType } from "@/lib/generated/prisma/client";
import {
  autocompletePlaces,
  getPlaceDetails,
  loadGooglePlaces,
  type PlaceDetails,
  type PlacePrediction,
} from "@/features/shopping/integrations/google-places.client";
import type { ShelfLabelResult } from "@/domain/parsers/shelf-label";
import type { MatchResult } from "@/domain/matching/engine";
import {
  asNumber,
  roundMoney,
  type ShoppingSession,
  type ShoppingItem,
  type ShoppingFallbackPhotoAnalysis,
  type ShoppingWebFallbackSuggestion,
  type ShoppingBarcodeLookup,
  type ShoppingBarcodePhotoDraft,
} from "./contracts";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type ScanStep = "idle" | "scanning" | "matched" | "not_found";

export type ShoppingSessionRefs = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  fallbackPhotoInputRef: RefObject<HTMLInputElement | null>;
  scanFileRef: RefObject<HTMLInputElement | null>;
};

type ProduceSuggestion = {
  plu_code: number;
  display_name: string;
  commodity: string;
  variety: string | null;
};

type ShoppingDraftItemInput = {
  name: string;
  quantity: number;
  unit?: string;
  unit_price?: number | null;
  inventory_item_id?: string | null;
  scanned_barcode?: string | null;
  inventory_item?: ShoppingItem["inventory_item"];
  intake_source?: IntakeItemSource;
};

function createDraftItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft_${crypto.randomUUID()}`;
  }
  return `draft_${Date.now()}_${Math.round(Math.random() * 1_000_000)}`;
}

const BARCODE_DIGIT_SEQUENCE = /\b\d{8,14}\b/g;

function extractBarcodeCandidates(rawText: string): string[] {
  const matches = rawText.match(BARCODE_DIGIT_SEQUENCE) ?? [];
  const unique = Array.from(new Set(matches));
  unique.sort((a, b) => b.length - a.length);
  return unique
    .map((value) => normalizeBarcode(value))
    .filter((value): value is string => Boolean(value));
}

function deriveSuggestedName(rawText: string, productName: string | null | undefined): string {
  const candidate = productName?.trim();
  if (candidate && candidate.toLowerCase() !== "unknown product") {
    return candidate.slice(0, 120);
  }

  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 3);
  if (!firstLine) return "New Item";
  return firstLine.slice(0, 120);
}

function inferSuggestedUnit(text: string): string {
  const sample = text.toLowerCase();
  if (sample.includes("kg")) return "kg";
  if (/\bgrams?\b|\bg\b/.test(sample)) return "g";
  if (sample.includes("lb")) return "lb";
  if (sample.includes("oz")) return "oz";
  if (/\bml\b/.test(sample)) return "ml";
  if (/\bl\b|\blitre|\bliter/.test(sample)) return "l";
  if (sample.includes("pack")) return "pack";
  if (sample.includes("box")) return "box";
  if (sample.includes("bag")) return "bag";
  return "each";
}

export function useShoppingSession(refs: ShoppingSessionRefs) {
  const { fileInputRef, fallbackPhotoInputRef, scanFileRef } = refs;

  const [session, setSession] = useState<ShoppingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [produceSuggestions, setProduceSuggestions] = useState<ProduceSuggestion[]>([]);
  const [produceSearchLoading, setProduceSearchLoading] = useState(false);

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
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);
  const [barcodePhotoAnalyzeLoading, setBarcodePhotoAnalyzeLoading] = useState(false);
  const [barcodeCreateLoading, setBarcodeCreateLoading] = useState(false);
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
  const [draftItems, setDraftItems] = useState<ShoppingItem[]>([]);

  function createDraftItem(input: ShoppingDraftItemInput): ShoppingItem {
    const quantity = input.quantity > 0 ? input.quantity : 1;
    const unitPrice =
      input.unit_price != null && input.unit_price >= 0 ? input.unit_price : null;
    const lineTotal = unitPrice != null ? roundMoney(unitPrice * quantity) : null;

    return {
      id: createDraftItemId(),
      origin: "staged",
      raw_name: input.name,
      quantity,
      unit: input.unit ?? "each",
      staged_unit_price: unitPrice,
      staged_line_total: lineTotal,
      receipt_quantity: null,
      receipt_unit_price: null,
      receipt_line_total: null,
      delta_quantity: null,
      delta_price: null,
      reconciliation_status: "exact",
      resolution: "accept_staged",
      receipt_line_item_id: null,
      scanned_barcode: input.scanned_barcode ?? null,
      inventory_item_id: input.inventory_item_id ?? null,
      inventory_item: input.inventory_item ?? null,
      intake_source: input.intake_source ?? null,
    };
  }

  // ─── Computed values ─────────────────────────────────────

  const unresolvedCount = useMemo(
    () =>
      (session?.receipt_id ? session.items : []).filter(
        (item) => item.reconciliation_status !== "exact" && item.resolution === "pending"
      ).length,
    [session]
  );

  const basketTotal = useMemo(() => {
    return draftItems
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
  }, [draftItems]);

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
    if (!session) {
      setDraftItems([]);
      return;
    }

    setDraftItems(
      (session.items ?? [])
        .filter((item) => item.origin === "staged")
        .map((item) => ({
          ...item,
          reconciliation_status: "exact",
          resolution: "accept_staged",
          intake_source: item.intake_source ?? null,
        }))
    );
  }, [session]);

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

  useEffect(() => {
    const sessionId = session?.id ?? null;
    if (!sessionId) {
      setProduceSuggestions([]);
      return;
    }
    const query = itemName.trim();
    if (query.length < 2) {
      setProduceSuggestions([]);
      setProduceSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setProduceSearchLoading(true);
      try {
        const results = await searchProduceCatalog(query, 6);
        setProduceSuggestions(results as ProduceSuggestion[]);
      } catch {
        setProduceSuggestions([]);
      } finally {
        setProduceSearchLoading(false);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [itemName, session?.id]);

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
      const nextItem = createDraftItem({
        name: itemName.trim(),
        quantity: Number(qty) || 1,
        unit_price: price ? Number(price) : undefined,
        intake_source: "manual_entry",
      });
      setDraftItems((prev) => [...prev, nextItem]);
      setItemName("");
      setQty("1");
      setPrice("");
      setProduceSuggestions([]);
    } catch {
      setError("Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddProduceSuggestion(suggestion: ProduceSuggestion) {
    if (!session) return;
    setSaving(true);
    setError("");
    try {
      const nextItem = createDraftItem({
        name: `${suggestion.display_name} (PLU ${suggestion.plu_code})`,
        quantity: Number(qty) || 1,
        unit_price: price ? Number(price) : undefined,
        intake_source: "produce_search",
      });
      setDraftItems((prev) => [...prev, nextItem]);
      setItemName("");
      setQty("1");
      setPrice("");
      setProduceSuggestions([]);
    } catch {
      setError("Failed to add produce item");
    } finally {
      setSaving(false);
    }
  }

  async function lookupBarcodeForCheckout(barcode: string): Promise<ShoppingBarcodeLookup | null> {
    const raw = barcode.trim();
    if (!raw) return null;

    setBarcodeLookupLoading(true);
    setError("");
    try {
      const resolution = await resolveBarcode({ barcode: raw });
      if (resolution.status === "resolved") {
        return {
          status: "resolved",
          normalized_barcode: resolution.normalized_barcode,
          source: resolution.source,
          confidence: resolution.confidence,
          item: {
            id: resolution.item.id,
            name: resolution.item.name,
            unit: resolution.item.unit,
            image_url: resolution.item.image_url ?? null,
            category: resolution.item.category ? { name: resolution.item.category.name } : null,
          },
        };
      }

      if (resolution.status === "resolved_external") {
        return {
          status: "resolved_external",
          normalized_barcode: resolution.normalized_barcode,
          source: resolution.source,
          confidence: resolution.confidence,
          metadata: {
            name: resolution.metadata.name,
            brand: resolution.metadata.brand,
            size_text: resolution.metadata.size_text,
            category_hint: resolution.metadata.category_hint,
            image_url: resolution.metadata.image_url,
          },
        };
      }

      return {
        status: "unresolved",
        normalized_barcode: resolution.normalized_barcode,
        source: resolution.source,
        confidence: resolution.confidence,
        reason: resolution.reason,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to look up barcode");
      return null;
    } finally {
      setBarcodeLookupLoading(false);
    }
  }

  async function addResolvedBarcodeLookupToSession(lookup: ShoppingBarcodeLookup): Promise<boolean> {
    if (!session || lookup.status !== "resolved") return false;

    setBarcodeCreateLoading(true);
    setError("");
    setNotice("");
    try {
      const nextItem = createDraftItem({
        name: lookup.item.name,
        quantity: 1,
        unit: lookup.item.unit,
        inventory_item_id: lookup.item.id,
        scanned_barcode: lookup.normalized_barcode,
        inventory_item: {
          id: lookup.item.id,
          name: lookup.item.name,
          image_url: lookup.item.image_url,
          category: lookup.item.category,
        },
        intake_source: "barcode_scan",
      });
      setDraftItems((prev) => [...prev, nextItem]);
      setNotice(`${lookup.item.name} added to basket.`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add barcode item");
      return false;
    } finally {
      setBarcodeCreateLoading(false);
    }
  }

  async function analyzeMissingBarcodePhoto(
    file: File,
    barcodeHint?: string | null,
  ): Promise<ShoppingBarcodePhotoDraft | null> {
    setBarcodePhotoAnalyzeLoading(true);
    setError("");
    setNotice("");
    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);
      const ocr = await ocrImage(base64);
      if (!ocr.success) {
        throw new Error(ocr.error ?? "Could not analyze this photo");
      }

      const rawText = (ocr.raw_text ?? "").trim();
      const inferredFromText = extractBarcodeCandidates(rawText)[0] ?? null;
      const inferredBarcode = normalizeBarcode(barcodeHint ?? "") || inferredFromText;
      return {
        raw_text: rawText,
        product_info: ocr.product_info ?? null,
        suggested_name: deriveSuggestedName(rawText, ocr.product_info?.product_name),
        suggested_unit: inferSuggestedUnit(
          `${ocr.product_info?.weight ?? ""} ${ocr.product_info?.quantity_description ?? ""}`,
        ),
        inferred_barcode: inferredBarcode,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze photo");
      return null;
    } finally {
      setBarcodePhotoAnalyzeLoading(false);
    }
  }

  async function createPhotoFallbackItemAndAddToSession(data: {
    name: string;
    unit: string;
    raw_text: string;
    barcode?: string | null;
  }): Promise<boolean> {
    if (!session) return false;

    const normalizedName = data.name.trim();
    if (!normalizedName) {
      setError("Item name is required");
      return false;
    }

    const normalizedBarcode = normalizeBarcode(data.barcode ?? "");

    setBarcodeCreateLoading(true);
    setError("");
    setNotice("");
    try {
      const nextItem = createDraftItem({
        name: normalizedName,
        quantity: 1,
        unit: data.unit || "each",
        scanned_barcode: normalizedBarcode || undefined,
        intake_source: "barcode_scan",
      });
      setDraftItems((prev) => [...prev, nextItem]);
      setNotice(`${normalizedName} added to basket.`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scanned item");
      return false;
    } finally {
      setBarcodeCreateLoading(false);
    }
  }

  async function handleUpdateItem(item: ShoppingItem, updates: { quantity?: number; unit_price?: number | null; name?: string }) {
    setSaving(true);
    setError("");
    try {
      setDraftItems((prev) =>
        prev.map((current) => {
          if (current.id !== item.id) return current;
          const nextQuantity =
            updates.quantity != null
              ? updates.quantity > 0
                ? updates.quantity
                : 1
              : asNumber(current.quantity) || 1;
          const nextUnitPrice =
            updates.unit_price !== undefined
              ? updates.unit_price
              : current.staged_unit_price != null
                ? asNumber(current.staged_unit_price)
                : null;
          const nextLineTotal =
            nextUnitPrice != null ? roundMoney(nextUnitPrice * nextQuantity) : null;

          return {
            ...current,
            raw_name: updates.name?.trim() || current.raw_name,
            quantity: nextQuantity,
            staged_unit_price: nextUnitPrice,
            staged_line_total: nextLineTotal,
          };
        })
      );
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
      setDraftItems((prev) => prev.filter((item) => item.id !== itemId));
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
      if (itemId.startsWith("draft_")) {
        setDraftItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, resolution } : item
          )
        );
      } else {
        const updated = await resolveShoppingSessionItem(itemId, { resolution });
        setSession(updated as ShoppingSession);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve mismatch");
    } finally {
      setSaving(false);
    }
  }

  async function handleCommit(): Promise<string | null> {
    if (!session) return null;
    if (draftItems.length === 0) {
      setError("Add at least one item before checkout");
      return null;
    }
    setCommitLoading(true);
    setError("");
    try {
      await checkoutShoppingSession({
        session_id: session.id,
        items: draftItems.map((item) => ({
          name: item.raw_name,
          quantity: asNumber(item.quantity) || 1,
          unit: item.unit as UnitType,
          unit_price:
            item.staged_unit_price != null
              ? asNumber(item.staged_unit_price)
              : null,
          inventory_item_id: item.inventory_item_id ?? null,
          scanned_barcode: item.scanned_barcode ?? null,
          intake_source: item.intake_source ?? undefined,
        })),
      });
      const committedSessionId = session.id;
      setDraftItems([]);
      setSession(null);
      return committedSessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit shopping session");
      return null;
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
      const nextItem = createDraftItem({
        name: scanParsed.product_name ?? scanParsed.raw_text,
        quantity: scanParsed.quantity,
        unit: "each",
        unit_price: scanParsed.unit_price ?? undefined,
        inventory_item_id: match.inventory_item_id,
        intake_source: "shelf_label_scan",
      });
      setDraftItems((prev) => [...prev, nextItem]);
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
      const nextItem = createDraftItem({
        name: (scanParsed.product_name ?? scanParsed.raw_text) || item.name,
        quantity: scanParsed.quantity,
        unit: item.unit || "each",
        unit_price: scanParsed.unit_price ?? undefined,
        inventory_item_id: item.id,
        inventory_item: {
          id: item.id,
          name: item.name,
          image_url: null,
          category: null,
        },
        intake_source: "shelf_label_scan",
      });
      setDraftItems((prev) => [...prev, nextItem]);
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
    produceSuggestions,
    produceSearchLoading,
    items: draftItems,
    receiptScanning,
    commitLoading,
    cancelLoading,
    barcodeLookupLoading,
    barcodePhotoAnalyzeLoading,
    barcodeCreateLoading,
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
    handleAddProduceSuggestion,
    lookupBarcodeForCheckout,
    addResolvedBarcodeLookupToSession,
    analyzeMissingBarcodePhoto,
    createPhotoFallbackItemAndAddToSession,
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
    resetScan,
    handleShelfLabelCapture,
    handleConfirmScanMatch,
    handleScanNewItem,
  };
}
