"use server";

import { requireModule } from "@/core/modules/guard";
import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { normalizeBarcode } from "@/core/utils/barcode";
import { normalizeText, similarity } from "@/core/matching/fuzzy";
import { matchText } from "@/core/matching/engine";
import {
  learnReceiptItemAlias,
  resolveReceiptLineMatch,
} from "@/core/matching/receipt-line";
import { parseReceiptText } from "@/core/parsers/receipt";
import { parseShelfLabel, type ShelfLabelResult } from "@/core/parsers/shelf-label";
import {
  extractProductInfo,
  extractProductName,
  type ProductInfo,
} from "@/core/parsers/product-name";
import { extractTextFromImage } from "@/modules/receipts/ocr/google-vision";
import { scanReceipt, type TabScannerResult } from "@/modules/receipts/ocr/tabscanner";
import { resolveBarcode } from "@/app/actions/core/barcode-resolver";
import { runConstrainedShoppingProductWebFallback } from "@/modules/shopping/web-fallback";
import { requireBusinessId } from "@/core/auth/tenant";
import type {
  Prisma,
  ShoppingItemResolution,
  ShoppingReconciliationStatus,
  ShoppingSessionStatus,
  UnitType,
} from "@/lib/generated/prisma/client";

const OPEN_STATUSES: ShoppingSessionStatus[] = ["draft", "reconciling", "ready"];
const RECEIPT_TOTAL_TOLERANCE = 0.01;

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeName(value: string): string {
  return normalizeText(value) || value.toLowerCase().trim();
}

function normalizeSpace(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mergeResolutionAudit(
  current: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base = asJsonRecord(current);
  return {
    ...base,
    ...patch,
    updated_at: new Date().toISOString(),
  } as Prisma.InputJsonValue;
}

function buildExternalBarcodeDisplayName(metadata: {
  name: string;
  brand: string | null;
  size_text: string | null;
}): string {
  const parts = [metadata.brand, metadata.name, metadata.size_text]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(" ") || metadata.name || "Unresolved Item";
}

function isGenericUnresolvedShoppingLabel(rawName: string): boolean {
  return /^unresolved item(?:\s+\[upc:\d{8,14}\])?$/i.test(rawName.trim());
}

function scoreShoppingReceiptLineCandidate(params: {
  itemInventoryItemId: string | null | undefined;
  itemRawName: string;
  itemNormalizedName: string;
  itemScannedBarcode: string | null | undefined;
  itemQuantity: Prisma.Decimal | number | null | undefined;
  itemStagedLineTotal: Prisma.Decimal | number | null | undefined;
  stagedIndex: number;
  lineIndex: number;
  lineMatchedItemId: string | null | undefined;
  lineRawText: string;
  lineParsedName: string | null | undefined;
  lineQuantity: Prisma.Decimal | number | null | undefined;
  lineLineTotal: Prisma.Decimal | number | null | undefined;
  lineConfidence: string | null | undefined;
}): number {
  if (
    params.itemInventoryItemId &&
    params.lineMatchedItemId === params.itemInventoryItemId
  ) {
    return 1;
  }

  const lineName = normalizeName(params.lineParsedName ?? params.lineRawText);
  let score = similarity(params.itemNormalizedName, lineName);

  if (!params.itemScannedBarcode) {
    return score;
  }

  const distance = Math.abs(params.stagedIndex - params.lineIndex);
  let barcodeHeuristicScore = Math.max(0, 0.72 - distance * 0.12);

  const stagedTotal = toNumber(params.itemStagedLineTotal);
  const lineTotal = toNumber(params.lineLineTotal);
  if (stagedTotal != null && lineTotal != null) {
    const delta = Math.abs(stagedTotal - lineTotal);
    if (delta <= 0.01) {
      barcodeHeuristicScore += 0.16;
    } else if (delta <= 0.5) {
      barcodeHeuristicScore += 0.08;
    }
  }

  const stagedQty = toNumber(params.itemQuantity);
  const lineQty = toNumber(params.lineQuantity);
  if (
    stagedQty != null &&
    lineQty != null &&
    Math.abs(stagedQty - lineQty) <= 0.001
  ) {
    barcodeHeuristicScore += 0.05;
  }

  if (params.lineConfidence === "high" && params.lineMatchedItemId) {
    barcodeHeuristicScore += 0.04;
  }

  const cappedBarcodeHeuristic = Math.min(barcodeHeuristicScore, 0.95);
  if (
    !params.itemInventoryItemId &&
    isGenericUnresolvedShoppingLabel(params.itemRawName)
  ) {
    // For generic unresolved shopping labels, sequence/price/qty heuristics must carry the match.
    score = Math.max(score, cappedBarcodeHeuristic);
  } else {
    // For externally named provisional items, blend text similarity with sequence/price hints.
    score = Math.max(score, Math.min(score + cappedBarcodeHeuristic * 0.2, 0.95));
  }

  return Math.min(score, 1);
}

function scoreReceiptItemAgainstWebFallback(params: {
  receiptItemName: string;
  receiptLineTotal: Prisma.Decimal | number | null | undefined;
  receiptQuantity: Prisma.Decimal | number | null | undefined;
  stagedLineTotal: Prisma.Decimal | number | null | undefined;
  stagedQuantity: Prisma.Decimal | number | null | undefined;
  canonicalName: string;
  brand: string | null;
  size: string | null;
  webConfidenceScore: number;
}): number {
  const receiptText = normalizeName(params.receiptItemName);
  const targetText = normalizeName(
    [params.brand, params.canonicalName, params.size].filter(Boolean).join(" ")
  );
  let score = similarity(receiptText, targetText);

  const receiptTotal = toNumber(params.receiptLineTotal);
  const stagedTotal = toNumber(params.stagedLineTotal);
  if (receiptTotal != null && stagedTotal != null) {
    const delta = Math.abs(receiptTotal - stagedTotal);
    if (delta <= 0.01) score += 0.14;
    else if (delta <= 0.5) score += 0.08;
    else if (delta <= 1.5) score += 0.03;
  }

  const receiptQty = toNumber(params.receiptQuantity);
  const stagedQty = toNumber(params.stagedQuantity);
  if (
    receiptQty != null &&
    stagedQty != null &&
    Math.abs(receiptQty - stagedQty) <= 0.001
  ) {
    score += 0.05;
  }

  score += Math.min(params.webConfidenceScore, 0.9) * 0.15;
  return clamp(score, 0, 1);
}

type ShoppingFallbackPhotoAnalysis = {
  raw_text: string;
  product_info: ProductInfo | null;
};

type ShoppingBalanceCheckItem = {
  origin: "staged" | "receipt";
  resolution: ShoppingItemResolution;
  staged_line_total: Prisma.Decimal | number | null;
  receipt_line_total: Prisma.Decimal | number | null;
};

function getSelectedShoppingLineSubtotal(items: ShoppingBalanceCheckItem[]): number {
  const subtotal = items
    .filter((item) => item.resolution !== "skip")
    .reduce((sum, item) => {
      const useReceipt = item.origin === "receipt" || item.resolution === "accept_receipt";
      if (useReceipt) {
        return sum + (toNumber(item.receipt_line_total) ?? toNumber(item.staged_line_total) ?? 0);
      }
      return sum + (toNumber(item.staged_line_total) ?? 0);
    }, 0);

  return round(subtotal);
}

function getReceiptBalanceCheck(params: {
  receiptId: string | null;
  receiptSubtotal: Prisma.Decimal | number | null;
  receiptTotal: Prisma.Decimal | number | null;
  taxTotal: Prisma.Decimal | number | null;
  items: ShoppingBalanceCheckItem[];
}) {
  if (!params.receiptId) {
    return {
      hasReceipt: false,
      selectedSubtotal: 0,
      selectedTotal: 0,
      subtotalDelta: null as number | null,
      totalDelta: null as number | null,
      isBalanced: false,
      isMissingExpectedTotal: false,
    };
  }

  const selectedSubtotal = getSelectedShoppingLineSubtotal(params.items);
  const selectedTotal = round(selectedSubtotal + (toNumber(params.taxTotal) ?? 0));

  const expectedSubtotal = toNumber(params.receiptSubtotal);
  const expectedTotal = toNumber(params.receiptTotal);
  const subtotalDelta =
    expectedSubtotal == null ? null : round(selectedSubtotal - expectedSubtotal);
  const totalDelta = expectedTotal == null ? null : round(selectedTotal - expectedTotal);

  const subtotalBalanced =
    subtotalDelta == null || Math.abs(subtotalDelta) <= RECEIPT_TOTAL_TOLERANCE;
  const totalBalanced =
    totalDelta != null && Math.abs(totalDelta) <= RECEIPT_TOTAL_TOLERANCE;

  return {
    hasReceipt: true,
    selectedSubtotal,
    selectedTotal,
    subtotalDelta,
    totalDelta,
    isBalanced: subtotalBalanced && totalBalanced,
    isMissingExpectedTotal: expectedTotal == null,
  };
}

function parseReceiptTotals(rawText: string): {
  subtotal: number | null;
  tax: number | null;
  total: number | null;
} {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  const amountFromLine = (line: string) => {
    const match = line.match(/(\d+\.\d{2})\s*$/);
    return match ? parseFloat(match[1]) : null;
  };

  const subtotal = lines.find((line) => /^sub\s*total|^subtotal/.test(line));
  const tax = lines.find((line) => /^tax|^gst|^hst|^pst/.test(line));
  const total = lines.find((line) => /^total(?!.*sub)/.test(line));

  return {
    subtotal: subtotal ? amountFromLine(subtotal) : null,
    tax: tax ? amountFromLine(tax) : null,
    total: total ? amountFromLine(total) : null,
  };
}

async function recomputeSessionState(
  tx: Prisma.TransactionClient,
  sessionId: string
) {
  const [session, items] = await Promise.all([
    tx.shoppingSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        receipt_id: true,
        receipt_subtotal: true,
        receipt_total: true,
        tax_total: true,
      },
    }),
    tx.shoppingSessionItem.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: "asc" },
    }),
  ]);

  const stagedSubtotal = items
    .filter((item) => item.origin === "staged" && item.resolution !== "skip")
    .reduce((sum, item) => sum + (toNumber(item.staged_line_total) ?? 0), 0);

  const pendingMismatches = items.filter((item) => {
    if (item.resolution === "skip") return false;
    if (item.reconciliation_status === "exact") return false;
    return item.resolution === "pending";
  }).length;

  const receiptBalance = getReceiptBalanceCheck({
    receiptId: session.receipt_id,
    receiptSubtotal: session.receipt_subtotal,
    receiptTotal: session.receipt_total,
    taxTotal: session.tax_total,
    items,
  });

  let nextStatus = session.status;
  if (session.status !== "committed" && session.status !== "cancelled") {
    if (!session.receipt_id) {
      nextStatus = "draft";
    } else if (pendingMismatches === 0 && receiptBalance.isBalanced) {
      nextStatus = "ready";
    } else {
      nextStatus = "reconciling";
    }
  }

  await tx.shoppingSession.update({
    where: { id: sessionId },
    data: {
      status: nextStatus,
      staged_subtotal: round(stagedSubtotal),
    },
  });
}

async function linkScannedBarcodeToInventoryItemIfHighConfidence(
  tx: Prisma.TransactionClient,
  params: {
    businessId: string;
    scannedBarcode: string | null | undefined;
    inventoryItemId: string | null | undefined;
    receiptLineConfidence: string | null | undefined;
  }
) {
  if (!params.scannedBarcode) return;
  if (!params.inventoryItemId) return;
  if (params.receiptLineConfidence !== "high") return;

  const normalized = normalizeBarcode(params.scannedBarcode);
  if (!normalized) return;

  const existing = await tx.itemBarcode.findFirst({
    where: {
      business_id: params.businessId,
      barcode: normalized,
    },
    select: { id: true },
  });
  if (existing) return;

  try {
    await tx.itemBarcode.create({
      data: {
        business_id: params.businessId,
        inventory_item_id: params.inventoryItemId,
        barcode: normalized,
      } as never,
    });
  } catch {
    // Fail-open if a concurrent write already created the barcode mapping.
  }
}

type SelectedGooglePlace = {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
};

async function upsertSupplierFromGooglePlace(place: SelectedGooglePlace, businessId: string) {
  const existing = await prisma.supplier.findFirst({
    where: { business_id: businessId, google_place_id: place.place_id },
  });

  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: {
        name: place.name,
        formatted_address: place.formatted_address,
        latitude: place.lat,
        longitude: place.lng,
      },
    });
  }

  const nameMatch = await prisma.supplier.findMany({
    where: {
      business_id: businessId,
      name: { equals: place.name, mode: "insensitive" },
    },
    take: 1,
  });
  if (nameMatch[0]) {
    return prisma.supplier.update({
      where: { id: nameMatch[0].id },
      data: {
        google_place_id: place.place_id,
        formatted_address: place.formatted_address,
        latitude: place.lat,
        longitude: place.lng,
      },
    });
  }

  return prisma.supplier.create({
    data: {
      business_id: businessId,
      name: place.name,
      google_place_id: place.place_id,
      formatted_address: place.formatted_address,
      latitude: place.lat,
      longitude: place.lng,
    },
  });
}

export async function startShoppingSession(data: {
  store: SelectedGooglePlace;
  notes?: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  if (!data.store?.place_id) {
    throw new Error("A Google Place selection is required");
  }

  try {
    const supplier = await upsertSupplierFromGooglePlace(data.store, businessId);

    const session = await prisma.shoppingSession.create({
      data: {
        business_id: businessId,
        supplier_id: supplier.id,
        google_place_id: data.store.place_id,
        store_name: data.store.name,
        store_address: data.store.formatted_address,
        store_lat: data.store.lat,
        store_lng: data.store.lng,
        notes: data.notes?.trim() || undefined,
        status: "draft",
      },
      include: {
        supplier: true,
        items: {
          orderBy: { created_at: "asc" },
          include: { inventory_item: true, receipt_line: true },
        },
        receipt: true,
      },
    });
    return serialize(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      /column .* does not exist/i.test(message) ||
      /Invalid `prisma\./i.test(message)
    ) {
      throw new Error(
        "Database schema is out of date. Run `npx prisma migrate deploy` and retry."
      );
    }
    throw error;
  }
}

export async function getActiveShoppingSession() {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const sessions = await prisma.shoppingSession.findMany({
    where: { business_id: businessId, status: { in: OPEN_STATUSES } },
    orderBy: { started_at: "desc" },
    take: 1,
    include: {
      supplier: true,
      items: {
        orderBy: { created_at: "asc" },
        include: { inventory_item: true, receipt_line: true },
      },
      receipt: true,
    },
  });
  return sessions[0] ? serialize(sessions[0]) : null;
}

export async function getShoppingSession(sessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, business_id: businessId },
    include: {
      supplier: true,
      items: {
        orderBy: { created_at: "asc" },
        include: { inventory_item: true, receipt_line: true },
      },
      receipt: {
        include: {
          line_items: {
            orderBy: { line_number: "asc" },
            include: { matched_item: true },
          },
        },
      },
    },
  });
  return session ? serialize(session) : null;
}

export async function addShoppingSessionItem(data: {
  session_id: string;
  name: string;
  quantity: number;
  unit?: UnitType;
  unit_price?: number;
  inventory_item_id?: string;
  scanned_barcode?: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const quantity = data.quantity > 0 ? data.quantity : 1;
  const unitPrice = data.unit_price != null && data.unit_price >= 0 ? data.unit_price : null;
  const lineTotal = unitPrice != null ? round(quantity * unitPrice) : null;
  const scannedBarcode = data.scanned_barcode ? normalizeBarcode(data.scanned_barcode) : null;

  await prisma.$transaction(async (tx) => {
    const session = await tx.shoppingSession.findFirstOrThrow({
      where: { id: data.session_id, business_id: businessId },
      select: { status: true },
    });

    if (session.status === "committed" || session.status === "cancelled") {
      throw new Error("Session is closed");
    }

    await tx.shoppingSessionItem.create({
      data: {
        session_id: data.session_id,
        inventory_item_id: data.inventory_item_id,
        scanned_barcode: scannedBarcode,
        raw_name: data.name.trim(),
        normalized_name: normalizeName(data.name),
        quantity,
        unit: data.unit ?? "each",
        staged_unit_price: unitPrice,
        staged_line_total: lineTotal,
        reconciliation_status: session.status === "draft" ? "pending" : "missing_on_receipt",
        resolution: "pending",
      },
    });

    await recomputeSessionState(tx, data.session_id);
  });

  return getShoppingSession(data.session_id);
}

export async function addShoppingSessionItemByBarcodeQuick(data: {
  session_id: string;
  barcode: string;
  quantity?: number;
}) {
  await requireModule("shopping");

  const normalizedBarcode = normalizeBarcode(data.barcode);
  if (!normalizedBarcode) {
    throw new Error("Invalid barcode");
  }

  // Quick-shop phase: run the layered barcode resolver stack (internal first, then providers).
  // This intentionally excludes the receipt-context web/AI fallback, which remains post-receipt only.
  const resolution = await resolveBarcode({ barcode: normalizedBarcode });
  const quantity = data.quantity != null && data.quantity > 0 ? data.quantity : 1;

  let displayName = "Unresolved Item";
  let inventoryItemId: string | undefined;
  let quickStatus: "resolved_inventory" | "resolved_barcode_metadata" | "unresolved" =
    "unresolved";
  let deferredResolution = true;

  if (resolution.status === "resolved") {
    displayName = String(resolution.item.name);
    inventoryItemId = String(resolution.item.id);
    quickStatus = "resolved_inventory";
    deferredResolution = false;
  } else if (resolution.status === "resolved_external") {
    displayName = buildExternalBarcodeDisplayName(resolution.metadata);
    quickStatus = "resolved_barcode_metadata";
    deferredResolution = true;
  }

  const session = await addShoppingSessionItem({
    session_id: data.session_id,
    name: displayName,
    quantity,
    inventory_item_id: inventoryItemId,
    scanned_barcode: normalizedBarcode,
  });

  return {
    session,
    quick_scan: {
      barcode: data.barcode.trim(),
      normalized_barcode: normalizedBarcode,
      status: quickStatus,
      display_name: displayName,
      deferred_resolution: deferredResolution,
      source: resolution.source,
      confidence: resolution.confidence,
    },
  };
}

export async function updateShoppingSessionItem(
  itemId: string,
  data: {
    name?: string;
    quantity?: number;
    unit?: UnitType;
    unit_price?: number | null;
    inventory_item_id?: string | null;
  }
) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const item = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: { id: itemId, session: { business_id: businessId } },
    select: { session_id: true },
  });

  await prisma.$transaction(async (tx) => {
    const current = await tx.shoppingSessionItem.findFirstOrThrow({
      where: { id: itemId, session: { business_id: businessId } },
    });

    const quantity =
      data.quantity != null ? (data.quantity > 0 ? data.quantity : 1) : toNumber(current.quantity) ?? 1;
    const unitPrice =
      data.unit_price !== undefined
        ? data.unit_price
        : toNumber(current.staged_unit_price);
    const lineTotal =
      unitPrice != null ? round(quantity * unitPrice) : null;

    await tx.shoppingSessionItem.update({
      where: { id: itemId },
      data: {
        raw_name: data.name != null ? data.name.trim() : undefined,
        normalized_name: data.name != null ? normalizeName(data.name) : undefined,
        quantity,
        unit: data.unit,
        staged_unit_price: unitPrice,
        staged_line_total: lineTotal,
        inventory_item_id: data.inventory_item_id,
      },
    });

    await recomputeSessionState(tx, item.session_id);
  });

  return getShoppingSession(item.session_id);
}

export async function removeShoppingSessionItem(itemId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const item = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: { id: itemId, session: { business_id: businessId } },
    select: { session_id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.shoppingSessionItem.delete({ where: { id: itemId } });
    await recomputeSessionState(tx, item.session_id);
  });

  return getShoppingSession(item.session_id);
}

export async function cancelShoppingSession(sessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();

  const session = await prisma.shoppingSession.findFirstOrThrow({
    where: { id: sessionId, business_id: businessId },
    select: { id: true, status: true },
  });

  if (session.status === "committed") {
    throw new Error("Committed sessions cannot be cancelled");
  }

  if (session.status === "cancelled") {
    return true;
  }

  await prisma.shoppingSession.update({
    where: { id: session.id },
    data: {
      status: "cancelled",
      completed_at: new Date(),
    },
  });

  return true;
}

export async function reconcileShoppingSessionReceipt(data: {
  session_id: string;
  raw_text: string;
  image_url?: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return prisma.$transaction(async (tx) => {
    const session = await tx.shoppingSession.findFirstOrThrow({
      where: { id: data.session_id, business_id: businessId },
      include: {
        items: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (session.status === "committed" || session.status === "cancelled") {
      throw new Error("Session is closed");
    }

    const receipt = await tx.receipt.create({
      data: {
        business_id: businessId,
        raw_text: data.raw_text,
        image_url: data.image_url,
        supplier_id: session.supplier_id,
        status: "review",
      },
    });

    const parsedLines = parseReceiptText(data.raw_text);
    const createdLines = await Promise.all(
      parsedLines.map(async (line) => {
        const resolved = await resolveReceiptLineMatch({
          rawText: line.raw_text,
          parsedName: line.parsed_name,
          businessId,
          googlePlaceId: session.google_place_id,
          profile: "shopping",
        });
        return tx.receiptLineItem.create({
          data: {
            receipt_id: receipt.id,
            line_number: line.line_number,
            raw_text: line.raw_text,
            parsed_name: line.parsed_name,
            quantity: line.quantity,
            unit: line.unit,
            line_cost: line.line_cost,
            unit_cost: line.unit_cost,
            matched_item_id: resolved.matched_item_id,
            confidence: resolved.confidence,
            status: resolved.status,
          },
          include: { matched_item: true },
        });
      })
    );

    const totals = parseReceiptTotals(data.raw_text);

    await tx.shoppingSession.update({
      where: { id: session.id },
      data: {
        receipt_id: receipt.id,
        tax_total: totals.tax,
        receipt_subtotal: totals.subtotal,
        receipt_total: totals.total ?? (totals.subtotal != null ? round(totals.subtotal + (totals.tax ?? 0)) : null),
      },
    });

    await tx.shoppingSessionItem.deleteMany({
      where: {
        session_id: session.id,
        origin: "receipt",
      },
    });

    const stagedItems = await tx.shoppingSessionItem.findMany({
      where: { session_id: session.id, origin: "staged" },
      orderBy: { created_at: "asc" },
    });

    const usedLineIds = new Set<string>();

    for (const [stagedIndex, item] of stagedItems.entries()) {
      let bestLine: (typeof createdLines)[number] | null = null;
      let bestScore = -1;
      let secondBestScore = -1;

      for (const [lineIndex, line] of createdLines.entries()) {
        if (usedLineIds.has(line.id)) continue;

        const score = scoreShoppingReceiptLineCandidate({
          itemInventoryItemId: item.inventory_item_id,
          itemRawName: item.raw_name,
          itemNormalizedName: item.normalized_name,
          itemScannedBarcode: item.scanned_barcode,
          itemQuantity: item.quantity,
          itemStagedLineTotal: item.staged_line_total,
          stagedIndex,
          lineIndex,
          lineMatchedItemId: line.matched_item_id,
          lineRawText: line.raw_text,
          lineParsedName: line.parsed_name,
          lineQuantity: line.quantity,
          lineLineTotal: line.line_cost,
          lineConfidence: line.confidence,
        });

        if (score > bestScore) {
          secondBestScore = bestScore;
          bestScore = score;
          bestLine = line;
        } else if (score > secondBestScore) {
          secondBestScore = score;
        }
      }

      const isScannedBarcodePairing = Boolean(item.scanned_barcode);
      const scoreThreshold = isScannedBarcodePairing ? 0.6 : 0.35;
      const ambiguityMargin = isScannedBarcodePairing ? 0.12 : 0.05;
      const isAmbiguousPairing =
        bestLine != null &&
        secondBestScore >= 0 &&
        bestScore - secondBestScore < ambiguityMargin;

      if (!bestLine || bestScore < scoreThreshold || isAmbiguousPairing) {
        await tx.shoppingSessionItem.update({
          where: { id: item.id },
          data: {
            receipt_line_item_id: null,
            receipt_quantity: null,
            receipt_unit_price: null,
            receipt_line_total: null,
            delta_quantity: null,
            delta_price: null,
            reconciliation_status:
              isAmbiguousPairing && isScannedBarcodePairing
                ? "pending"
                : "missing_on_receipt",
            resolution: "pending",
          },
        });
        continue;
      }

      usedLineIds.add(bestLine.id);

      const stagedQty = toNumber(item.quantity) ?? 1;
      const stagedUnitPrice = toNumber(item.staged_unit_price);
      const receiptQty = toNumber(bestLine.quantity) ?? 1;
      const receiptUnitPrice =
        toNumber(bestLine.unit_cost) ??
        (toNumber(bestLine.line_cost) != null && receiptQty > 0
          ? round((toNumber(bestLine.line_cost) as number) / receiptQty)
          : null);
      const qtyDelta = round(receiptQty - stagedQty, 4);
      const priceDelta =
        stagedUnitPrice != null && receiptUnitPrice != null
          ? round(receiptUnitPrice - stagedUnitPrice)
          : null;

      let reconciliationStatus: ShoppingReconciliationStatus = "exact";
      if (Math.abs(qtyDelta) > 0.001) {
        reconciliationStatus = "quantity_mismatch";
      } else if (priceDelta != null && Math.abs(priceDelta) >= 0.01) {
        reconciliationStatus = "price_mismatch";
      }

      const resolvedInventoryItemId = item.inventory_item_id ?? bestLine.matched_item_id;

      await tx.shoppingSessionItem.update({
        where: { id: item.id },
        data: {
          inventory_item_id: resolvedInventoryItemId,
          receipt_line_item_id: bestLine.id,
          receipt_quantity: receiptQty,
          receipt_unit_price: receiptUnitPrice,
          receipt_line_total: toNumber(bestLine.line_cost),
          delta_quantity: qtyDelta,
          delta_price: priceDelta,
          reconciliation_status: reconciliationStatus,
          resolution: reconciliationStatus === "exact" ? "accept_receipt" : "pending",
        },
      });

      await linkScannedBarcodeToInventoryItemIfHighConfidence(tx, {
        businessId,
        scannedBarcode: item.scanned_barcode,
        inventoryItemId: resolvedInventoryItemId,
        receiptLineConfidence: bestLine.confidence,
      });
    }

    for (const line of createdLines) {
      if (usedLineIds.has(line.id)) continue;
      const lineName = line.parsed_name ?? line.raw_text;
      await tx.shoppingSessionItem.create({
        data: {
          session_id: session.id,
          inventory_item_id: line.matched_item_id,
          receipt_line_item_id: line.id,
          origin: "receipt",
          raw_name: lineName,
          normalized_name: normalizeName(lineName),
          quantity: line.quantity ?? 1,
          unit: line.unit ?? "each",
          receipt_quantity: line.quantity ?? 1,
          receipt_unit_price: toNumber(line.unit_cost),
          receipt_line_total: toNumber(line.line_cost),
          reconciliation_status: "extra_on_receipt",
          resolution: "pending",
        },
      });
    }

    await recomputeSessionState(tx, session.id);
    const result = await tx.shoppingSession.findUnique({
      where: { id: session.id },
      include: {
        supplier: true,
        items: {
          orderBy: { created_at: "asc" },
          include: { inventory_item: true, receipt_line: true },
        },
        receipt: {
          include: {
            line_items: {
              orderBy: { line_number: "asc" },
              include: { matched_item: true },
            },
          },
        },
      },
    });
    return result ? serialize(result) : null;
  });
}

/**
 * Scan a receipt image with TabScanner and reconcile with the shopping session.
 * Combines image upload, OCR, and reconciliation into a single action.
 */
export async function scanAndReconcileReceipt(data: {
  session_id: string;
  base64_image: string;
  image_url?: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();

  // Step 1: Scan receipt with TabScanner
  const scanResult = await scanReceipt(data.base64_image);
  if (!scanResult.success || !scanResult.result) {
    throw new Error(scanResult.error ?? "Receipt scan failed");
  }

  const ts = scanResult.result;

  // Step 2: Reconcile using TabScanner structured data
  return reconcileWithTabScannerData({
    session_id: data.session_id,
    business_id: businessId,
    tabscanner: ts,
    image_url: data.image_url,
  });
}

async function reconcileWithTabScannerData(params: {
  session_id: string;
  business_id: string;
  tabscanner: TabScannerResult;
  image_url?: string;
}) {
  const { session_id, business_id, tabscanner, image_url } = params;

  // Build a synthetic raw_text from TabScanner for storage
  const rawTextLines = tabscanner.lineItems.map(
    (li) =>
      `${li.descClean || li.desc}${li.qty > 1 ? ` x${li.qty}` : ""} $${li.lineTotal.toFixed(2)}`
  );
  if (tabscanner.subTotal != null) rawTextLines.push(`Subtotal $${tabscanner.subTotal.toFixed(2)}`);
  if (tabscanner.tax != null) rawTextLines.push(`Tax $${tabscanner.tax.toFixed(2)}`);
  if (tabscanner.total != null) rawTextLines.push(`Total $${tabscanner.total.toFixed(2)}`);
  const rawText = rawTextLines.join("\n");

  return prisma.$transaction(async (tx) => {
    const session = await tx.shoppingSession.findFirstOrThrow({
      where: { id: session_id, business_id: business_id },
      include: {
        items: { orderBy: { created_at: "asc" } },
      },
    });

    if (session.status === "committed" || session.status === "cancelled") {
      throw new Error("Session is closed");
    }

    // Create receipt record
    const receipt = await tx.receipt.create({
      data: {
        business_id: business_id,
        raw_text: rawText,
        image_url: image_url,
        supplier_id: session.supplier_id,
        status: "review",
        parsed_data: {
          source: "tabscanner",
          establishment: tabscanner.establishment,
          date: tabscanner.date,
          currency: tabscanner.currency,
          paymentMethod: tabscanner.paymentMethod,
        } as never,
      },
    });

    // Create receipt line items from TabScanner structured data
    const createdLines = await Promise.all(
      tabscanner.lineItems.map(async (tsLine, index) => {
        const resolved = await resolveReceiptLineMatch({
          rawText: tsLine.desc,
          parsedName: tsLine.descClean || tsLine.desc,
          businessId: business_id,
          googlePlaceId: session.google_place_id,
          profile: "shopping",
        });

        const unitPrice =
          tsLine.qty > 0 ? round(tsLine.lineTotal / tsLine.qty) : tsLine.price;

        return tx.receiptLineItem.create({
          data: {
            receipt_id: receipt.id,
            line_number: index + 1,
            raw_text: tsLine.desc,
            parsed_name: tsLine.descClean || tsLine.desc,
            quantity: tsLine.qty || 1,
            unit: "each",
            line_cost: tsLine.lineTotal,
            unit_cost: unitPrice,
            matched_item_id: resolved.matched_item_id,
            confidence: resolved.confidence,
            status: resolved.status,
          },
          include: { matched_item: true },
        });
      })
    );

    // Use TabScanner totals directly
    const subtotal = tabscanner.subTotal;
    const tax = tabscanner.tax;
    const total =
      tabscanner.total ??
      (subtotal != null ? round(subtotal + (tax ?? 0)) : null);

    await tx.shoppingSession.update({
      where: { id: session.id },
      data: {
        receipt_id: receipt.id,
        tax_total: tax,
        receipt_subtotal: subtotal,
        receipt_total: total,
      },
    });

    // Remove old receipt-origin items
    await tx.shoppingSessionItem.deleteMany({
      where: { session_id: session.id, origin: "receipt" },
    });

    // Reconcile staged items against TabScanner line items
    const stagedItems = await tx.shoppingSessionItem.findMany({
      where: { session_id: session.id, origin: "staged" },
      orderBy: { created_at: "asc" },
    });

    const usedLineIds = new Set<string>();

    for (const [stagedIndex, item] of stagedItems.entries()) {
      let bestLine: (typeof createdLines)[number] | null = null;
      let bestScore = -1;
      let secondBestScore = -1;

      for (const [lineIndex, line] of createdLines.entries()) {
        if (usedLineIds.has(line.id)) continue;

        const score = scoreShoppingReceiptLineCandidate({
          itemInventoryItemId: item.inventory_item_id,
          itemRawName: item.raw_name,
          itemNormalizedName: item.normalized_name,
          itemScannedBarcode: item.scanned_barcode,
          itemQuantity: item.quantity,
          itemStagedLineTotal: item.staged_line_total,
          stagedIndex,
          lineIndex,
          lineMatchedItemId: line.matched_item_id,
          lineRawText: line.raw_text,
          lineParsedName: line.parsed_name,
          lineQuantity: line.quantity,
          lineLineTotal: line.line_cost,
          lineConfidence: line.confidence,
        });

        if (score > bestScore) {
          secondBestScore = bestScore;
          bestScore = score;
          bestLine = line;
        } else if (score > secondBestScore) {
          secondBestScore = score;
        }
      }

      const isScannedBarcodePairing = Boolean(item.scanned_barcode);
      const scoreThreshold = isScannedBarcodePairing ? 0.6 : 0.35;
      const ambiguityMargin = isScannedBarcodePairing ? 0.12 : 0.05;
      const isAmbiguousPairing =
        bestLine != null &&
        secondBestScore >= 0 &&
        bestScore - secondBestScore < ambiguityMargin;

      if (!bestLine || bestScore < scoreThreshold || isAmbiguousPairing) {
        await tx.shoppingSessionItem.update({
          where: { id: item.id },
          data: {
            receipt_line_item_id: null,
            receipt_quantity: null,
            receipt_unit_price: null,
            receipt_line_total: null,
            delta_quantity: null,
            delta_price: null,
            reconciliation_status:
              isAmbiguousPairing && isScannedBarcodePairing
                ? "pending"
                : "missing_on_receipt",
            resolution: "pending",
          },
        });
        continue;
      }

      usedLineIds.add(bestLine.id);

      const stagedQty = toNumber(item.quantity) ?? 1;
      const stagedUnitPrice = toNumber(item.staged_unit_price);
      const receiptQty = toNumber(bestLine.quantity) ?? 1;
      const receiptUnitPrice =
        toNumber(bestLine.unit_cost) ??
        (toNumber(bestLine.line_cost) != null && receiptQty > 0
          ? round((toNumber(bestLine.line_cost) as number) / receiptQty)
          : null);
      const qtyDelta = round(receiptQty - stagedQty, 4);
      const priceDelta =
        stagedUnitPrice != null && receiptUnitPrice != null
          ? round(receiptUnitPrice - stagedUnitPrice)
          : null;

      let reconciliationStatus: ShoppingReconciliationStatus = "exact";
      if (Math.abs(qtyDelta) > 0.001) {
        reconciliationStatus = "quantity_mismatch";
      } else if (priceDelta != null && Math.abs(priceDelta) >= 0.01) {
        reconciliationStatus = "price_mismatch";
      }

      const resolvedInventoryItemId = item.inventory_item_id ?? bestLine.matched_item_id;

      await tx.shoppingSessionItem.update({
        where: { id: item.id },
        data: {
          inventory_item_id: resolvedInventoryItemId,
          receipt_line_item_id: bestLine.id,
          receipt_quantity: receiptQty,
          receipt_unit_price: receiptUnitPrice,
          receipt_line_total: toNumber(bestLine.line_cost),
          delta_quantity: qtyDelta,
          delta_price: priceDelta,
          reconciliation_status: reconciliationStatus,
          resolution:
            reconciliationStatus === "exact" ? "accept_receipt" : "pending",
        },
      });

      await linkScannedBarcodeToInventoryItemIfHighConfidence(tx, {
        businessId: business_id,
        scannedBarcode: item.scanned_barcode,
        inventoryItemId: resolvedInventoryItemId,
        receiptLineConfidence: bestLine.confidence,
      });
    }

    // Create shopping items for unmatched receipt lines
    for (const line of createdLines) {
      if (usedLineIds.has(line.id)) continue;
      const lineName = line.parsed_name ?? line.raw_text;
      await tx.shoppingSessionItem.create({
        data: {
          session_id: session.id,
          inventory_item_id: line.matched_item_id,
          receipt_line_item_id: line.id,
          origin: "receipt",
          raw_name: lineName,
          normalized_name: normalizeName(lineName),
          quantity: line.quantity ?? 1,
          unit: (line.unit as UnitType) ?? "each",
          receipt_quantity: line.quantity ?? 1,
          receipt_unit_price: toNumber(line.unit_cost),
          receipt_line_total: toNumber(line.line_cost),
          reconciliation_status: "extra_on_receipt",
          resolution: "pending",
        },
      });
    }

    await recomputeSessionState(tx, session.id);

    const result = await tx.shoppingSession.findUnique({
      where: { id: session.id },
      include: {
        supplier: true,
        items: {
          orderBy: { created_at: "asc" },
          include: { inventory_item: true, receipt_line: true },
        },
        receipt: {
          include: {
            line_items: {
              orderBy: { line_number: "asc" },
              include: { matched_item: true },
            },
          },
        },
      },
    });
    return result ? serialize(result) : null;
  });
}

export async function resolveShoppingSessionItem(
  itemId: string,
  data: {
    resolution: ShoppingItemResolution;
    inventory_item_id?: string | null;
  }
) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const item = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: { id: itemId, session: { business_id: businessId } },
    select: {
      session_id: true,
      inventory_item_id: true,
      receipt_line: {
        select: {
          raw_text: true,
          parsed_name: true,
        },
      },
      session: {
        select: {
          receipt_id: true,
          google_place_id: true,
        },
      },
    },
  });

  if (item.session.receipt_id) {
    throw new Error(
      "Receipt scan is not 100% complete. Please rescan the receipt instead."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.shoppingSessionItem.update({
      where: { id: itemId },
      data: {
        resolution: data.resolution,
        inventory_item_id: data.inventory_item_id,
      },
    });

    await recomputeSessionState(tx, item.session_id);
  });

  const resolvedItemId =
    data.inventory_item_id === undefined
      ? item.inventory_item_id
      : data.inventory_item_id;
  const googlePlaceId = item.session.google_place_id;
  if (
    data.resolution !== "skip" &&
    resolvedItemId &&
    googlePlaceId &&
    item.receipt_line?.raw_text
  ) {
    await learnReceiptItemAlias({
      businessId,
      googlePlaceId,
      inventoryItemId: resolvedItemId,
      rawText: item.receipt_line.raw_text,
      confidence: "high",
    });
    if (item.receipt_line.parsed_name) {
      await learnReceiptItemAlias({
        businessId,
        googlePlaceId,
        inventoryItemId: resolvedItemId,
        rawText: item.receipt_line.parsed_name,
        confidence: "high",
      });
    }
  }

  return getShoppingSession(item.session_id);
}

export async function analyzeShoppingSessionBarcodeItemPhoto(data: {
  staged_item_id: string;
  base64_image: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();

  const stagedItem = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: {
      id: data.staged_item_id,
      session: { business_id: businessId },
    },
    select: {
      id: true,
      origin: true,
      scanned_barcode: true,
      resolution_audit: true,
      session: { select: { receipt_id: true } },
    },
  });

  if (stagedItem.origin !== "staged") {
    throw new Error("Photo fallback can only be used for staged shopping items");
  }

  if (!stagedItem.scanned_barcode) {
    throw new Error("This item does not have a saved scanned barcode");
  }

  if (!stagedItem.session.receipt_id) {
    throw new Error("Receipt must be scanned before photo-assisted fallback");
  }

  const ocr = await extractTextFromImage(data.base64_image);
  if (!ocr.success) {
    return {
      success: false as const,
      error: ocr.error ?? "OCR failed",
      analysis: null as ShoppingFallbackPhotoAnalysis | null,
    };
  }

  let productInfo: ProductInfo | null = null;
  try {
    productInfo = await extractProductInfo(ocr.raw_text, ocr.labels, ocr.logos);
  } catch {
    productInfo = null;
  }

  await prisma.shoppingSessionItem.update({
    where: { id: stagedItem.id },
    data: {
      resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
        photo_fallback: {
          analyzed_at: new Date().toISOString(),
          barcode: stagedItem.scanned_barcode,
          ocr_text_excerpt: normalizeSpace(ocr.raw_text).slice(0, 600),
          product_info: productInfo
            ? {
                product_name: productInfo.product_name,
                brand: productInfo.brand,
                category: productInfo.category,
                quantity_description: productInfo.quantity_description,
                weight: productInfo.weight,
              }
            : null,
        },
      }),
    },
  });

  return {
    success: true as const,
    analysis: {
      raw_text: ocr.raw_text,
      product_info: productInfo,
    } satisfies ShoppingFallbackPhotoAnalysis,
  };
}

export async function suggestShoppingSessionBarcodeReceiptPairWithWebFallback(data: {
  staged_item_id: string;
  photo_analysis?: ShoppingFallbackPhotoAnalysis | null;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();

  const stagedItem = await prisma.shoppingSessionItem.findFirstOrThrow({
    where: {
      id: data.staged_item_id,
      session: { business_id: businessId },
    },
    select: {
      id: true,
      session_id: true,
      origin: true,
      raw_name: true,
      quantity: true,
      staged_line_total: true,
      scanned_barcode: true,
      inventory_item_id: true,
      resolution_audit: true,
      session: {
        select: {
          receipt_id: true,
          store_name: true,
          status: true,
        },
      },
    },
  });

  if (stagedItem.origin !== "staged") {
    throw new Error("Web fallback applies to staged shopping items only");
  }

  if (!stagedItem.scanned_barcode) {
    throw new Error("Staged item does not have a saved scanned barcode");
  }

  if (!stagedItem.session.receipt_id) {
    throw new Error("Receipt must be scanned before web fallback");
  }

  const unmatchedReceiptItems = await prisma.shoppingSessionItem.findMany({
    where: {
      session_id: stagedItem.session_id,
      origin: "receipt",
      resolution: "pending",
      receipt_line_item_id: { not: null },
    },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      raw_name: true,
      quantity: true,
      receipt_quantity: true,
      receipt_line_total: true,
      receipt_unit_price: true,
      inventory_item_id: true,
      receipt_line_item_id: true,
    },
  });

  if (unmatchedReceiptItems.length === 0) {
    return {
      success: true as const,
      fallback: {
        status: "no_unmatched_receipt_items" as const,
        query: "",
        rationale: "No unmatched receipt items remain for suggestion.",
        web_result: null,
        pair_suggestions: [],
      },
    };
  }

  const photoInfo = data.photo_analysis?.product_info ?? null;
  const photoRawText = data.photo_analysis?.raw_text ?? "";
  const photoProductName =
    photoInfo?.product_name && photoInfo.product_name !== "Unknown Product"
      ? photoInfo.product_name
      : "";
  const photoPackHint =
    [photoInfo?.quantity_description, photoInfo?.weight]
      .map((value) => normalizeSpace(value))
      .filter(Boolean)
      .join(" ")
      .trim() || null;

  const fallback = await runConstrainedShoppingProductWebFallback({
    parsed_item_text: photoProductName || photoRawText || stagedItem.raw_name,
    store_name: stagedItem.session.store_name,
    barcode: stagedItem.scanned_barcode,
    brand_hint: photoInfo?.brand || null,
    pack_size_hint: photoPackHint,
    max_results: 5,
  });

  if (fallback.status !== "ok") {
    await prisma.shoppingSessionItem.update({
      where: { id: stagedItem.id },
      data: {
        resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
          web_fallback: {
            attempted_at: new Date().toISOString(),
            status: fallback.status,
            query: fallback.query,
            rationale: fallback.rationale,
            provider_meta: fallback.provider_meta ?? null,
            from_photo_hints: Boolean(photoInfo || photoRawText),
            unmatched_receipt_item_count: unmatchedReceiptItems.length,
          },
        }),
      },
    });

    return {
      success: true as const,
      fallback: {
        status: fallback.status,
        query: fallback.query,
        rationale: fallback.rationale,
        web_result: fallback,
        pair_suggestions: [] as Array<unknown>,
        auto_apply_eligible: false,
        auto_apply_reason: "No structured web fallback result available.",
      },
    };
  }

  const pairSuggestions = unmatchedReceiptItems
    .map((receiptItem) => {
      const score = scoreReceiptItemAgainstWebFallback({
        receiptItemName: receiptItem.raw_name,
        receiptLineTotal: receiptItem.receipt_line_total,
        receiptQuantity: receiptItem.receipt_quantity ?? receiptItem.quantity,
        stagedLineTotal: stagedItem.staged_line_total,
        stagedQuantity: stagedItem.quantity,
        canonicalName: fallback.structured.canonical_name,
        brand: fallback.structured.brand,
        size: fallback.structured.size,
        webConfidenceScore: fallback.confidence_score,
      });

      let confidence: "low" | "medium" | "high" = "low";
      if (score >= 0.82 && fallback.confidence_score >= 0.62) {
        confidence = "high";
      } else if (score >= 0.62) {
        confidence = "medium";
      }

      return {
        receipt_item_id: receiptItem.id,
        receipt_line_item_id: receiptItem.receipt_line_item_id,
        receipt_name: receiptItem.raw_name,
        receipt_line_total: toNumber(receiptItem.receipt_line_total),
        score: round(score, 3),
        confidence,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const best = pairSuggestions[0] ?? null;
  const second = pairSuggestions[1] ?? null;
  const ambiguous =
    best != null && second != null && best.score - second.score < 0.08;
  const webHighEnough =
    fallback.confidence_label === "high" && fallback.confidence_score >= 0.78;
  const pairHighEnough =
    best != null &&
    best.confidence === "high" &&
    best.score >= 0.9;
  const autoApplyEligible = Boolean(best) && webHighEnough && pairHighEnough && !ambiguous;

  let autoApplyReason = "Requires manual confirmation.";
  if (!best) {
    autoApplyReason = "No receipt pair suggestion available.";
  } else if (ambiguous) {
    autoApplyReason = "Top pair suggestion is too close to the next candidate.";
  } else if (!webHighEnough) {
    autoApplyReason = "Web/AI confidence is below the auto-apply threshold.";
  } else if (!pairHighEnough) {
    autoApplyReason = "Receipt pairing confidence is below the auto-apply threshold.";
  } else {
    autoApplyReason = "Eligible for auto-apply (high web confidence + high receipt pairing confidence).";
  }

  await prisma.shoppingSessionItem.update({
    where: { id: stagedItem.id },
    data: {
      resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
          web_fallback: {
            attempted_at: new Date().toISOString(),
            status: "ok",
            query: fallback.query,
            rationale: fallback.rationale,
            provider_meta: fallback.provider_meta ?? null,
            from_photo_hints: Boolean(photoInfo || photoRawText),
            photo_hint_summary: photoInfo
            ? {
                product_name:
                  photoInfo.product_name && photoInfo.product_name !== "Unknown Product"
                    ? photoInfo.product_name
                    : null,
                brand: photoInfo.brand || null,
                quantity_description: photoInfo.quantity_description || null,
                weight: photoInfo.weight || null,
              }
            : null,
          web_result: {
            confidence_label: fallback.confidence_label,
            confidence_score: fallback.confidence_score,
            structured: fallback.structured,
            candidates: fallback.candidates.slice(0, 3).map((candidate) => ({
              title: candidate.title,
              link: candidate.link,
              snippet: candidate.snippet.slice(0, 220),
            })),
          },
          pair_suggestions: pairSuggestions.slice(0, 5),
          suggested_receipt_item_id:
            best && best.confidence !== "low" && !ambiguous ? best.receipt_item_id : null,
          suggested_confidence: best && !ambiguous ? best.confidence : "low",
          ambiguous,
          auto_apply_eligible: autoApplyEligible,
          auto_apply_reason: autoApplyReason,
        },
      }),
    },
  });

  return {
    success: true as const,
    fallback: {
      status: "ok" as const,
      query: fallback.query,
      rationale: fallback.rationale,
      web_result: {
        confidence_label: fallback.confidence_label,
        confidence_score: fallback.confidence_score,
        structured: fallback.structured,
        candidates: fallback.candidates.slice(0, 3),
      },
      pair_suggestions: pairSuggestions,
      suggested_receipt_item_id:
        best && best.confidence !== "low" && !ambiguous ? best.receipt_item_id : null,
      suggested_confidence: best && !ambiguous ? best.confidence : "low",
      ambiguous,
      auto_apply_eligible: autoApplyEligible,
      auto_apply_reason: autoApplyReason,
    },
  };
}

export async function pairShoppingSessionBarcodeItemToReceiptItem(data: {
  staged_item_id: string;
  receipt_item_id: string;
  source?: "manual" | "web_suggestion_manual" | "web_suggestion_auto";
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();

  const sessionId = await prisma.$transaction(async (tx) => {
    const stagedItem = await tx.shoppingSessionItem.findFirstOrThrow({
      where: {
        id: data.staged_item_id,
        session: { business_id: businessId },
      },
      select: {
        id: true,
        session_id: true,
        origin: true,
        scanned_barcode: true,
        inventory_item_id: true,
        raw_name: true,
        normalized_name: true,
        quantity: true,
        staged_unit_price: true,
        staged_line_total: true,
        resolution_audit: true,
        session: {
          select: {
            id: true,
            status: true,
            receipt_id: true,
          },
        },
      },
    });

    const receiptItem = await tx.shoppingSessionItem.findFirstOrThrow({
      where: {
        id: data.receipt_item_id,
        session: { business_id: businessId },
      },
      select: {
        id: true,
        session_id: true,
        origin: true,
        inventory_item_id: true,
        receipt_line_item_id: true,
        raw_name: true,
        quantity: true,
        receipt_quantity: true,
        receipt_unit_price: true,
        receipt_line_total: true,
      },
    });

    if (stagedItem.session_id !== receiptItem.session_id) {
      throw new Error("Items must belong to the same shopping session");
    }

    if (stagedItem.origin !== "staged") {
      throw new Error("First item must be a staged shopping item");
    }

    if (receiptItem.origin !== "receipt" || !receiptItem.receipt_line_item_id) {
      throw new Error("Second item must be an unmatched receipt item");
    }

    if (!stagedItem.scanned_barcode) {
      throw new Error("Staged item does not have a saved scanned barcode");
    }

    if (stagedItem.session.status === "committed" || stagedItem.session.status === "cancelled") {
      throw new Error("Session is closed");
    }

    if (!stagedItem.session.receipt_id) {
      throw new Error("Receipt must be scanned before manual pairing");
    }

    const duplicateStagedAssignment = await tx.shoppingSessionItem.findFirst({
      where: {
        session_id: stagedItem.session_id,
        id: { notIn: [stagedItem.id, receiptItem.id] },
        origin: "staged",
        receipt_line_item_id: receiptItem.receipt_line_item_id,
      },
      select: { id: true },
    });
    if (duplicateStagedAssignment) {
      throw new Error("Receipt line is already paired to another staged item");
    }

    const stagedQty = toNumber(stagedItem.quantity) ?? 1;
    const stagedUnitPrice = toNumber(stagedItem.staged_unit_price);
    const receiptQty =
      toNumber(receiptItem.receipt_quantity) ?? toNumber(receiptItem.quantity) ?? 1;
    const receiptUnitPrice = toNumber(receiptItem.receipt_unit_price);
    const receiptLineTotal = toNumber(receiptItem.receipt_line_total);
    const qtyDelta = round(receiptQty - stagedQty, 4);
    const priceDelta =
      stagedUnitPrice != null && receiptUnitPrice != null
        ? round(receiptUnitPrice - stagedUnitPrice)
        : null;

    let reconciliationStatus: ShoppingReconciliationStatus = "exact";
    if (Math.abs(qtyDelta) > 0.001) {
      reconciliationStatus = "quantity_mismatch";
    } else if (priceDelta != null && Math.abs(priceDelta) >= 0.01) {
      reconciliationStatus = "price_mismatch";
    }

    const resolvedInventoryItemId =
      stagedItem.inventory_item_id ?? receiptItem.inventory_item_id;

    await tx.shoppingSessionItem.update({
      where: { id: stagedItem.id },
      data: {
        inventory_item_id: resolvedInventoryItemId,
        receipt_line_item_id: receiptItem.receipt_line_item_id,
        receipt_quantity: receiptQty,
        receipt_unit_price: receiptUnitPrice,
        receipt_line_total: receiptLineTotal,
        delta_quantity: qtyDelta,
        delta_price: priceDelta,
        reconciliation_status: reconciliationStatus,
        resolution:
          reconciliationStatus === "exact" ? "accept_receipt" : "pending",
        resolution_audit: mergeResolutionAudit(stagedItem.resolution_audit, {
          final_pairing_decision: {
            paired_at: new Date().toISOString(),
            source: data.source ?? "manual",
            staged_item: {
              id: stagedItem.id,
              raw_name: stagedItem.raw_name,
              scanned_barcode: stagedItem.scanned_barcode,
              quantity: stagedQty,
              staged_line_total: toNumber(stagedItem.staged_line_total),
            },
            receipt_item: {
              id: receiptItem.id,
              receipt_line_item_id: receiptItem.receipt_line_item_id,
              raw_name: receiptItem.raw_name,
              quantity: receiptQty,
              receipt_line_total: receiptLineTotal,
            },
            resolved_inventory_item_id: resolvedInventoryItemId,
            reconciliation_status: reconciliationStatus,
            qty_delta: qtyDelta,
            price_delta: priceDelta,
          },
        }),
      },
    });

    await tx.shoppingSessionItem.delete({
      where: { id: receiptItem.id },
    });

    // Manual pairing is a strong user confirmation signal for the barcode <-> receipt item link.
    if (stagedItem.scanned_barcode && resolvedInventoryItemId) {
      await linkScannedBarcodeToInventoryItemIfHighConfidence(tx, {
        businessId,
        scannedBarcode: stagedItem.scanned_barcode,
        inventoryItemId: resolvedInventoryItemId,
        receiptLineConfidence: "high",
      });
    }

    await recomputeSessionState(tx, stagedItem.session_id);
    return stagedItem.session_id;
  });

  return getShoppingSession(sessionId);
}

export async function commitShoppingSession(sessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return prisma.$transaction(async (tx) => {
    const session = await tx.shoppingSession.findFirstOrThrow({
      where: { id: sessionId, business_id: businessId },
      include: {
        supplier: true,
        items: {
          orderBy: { created_at: "asc" },
        },
      },
    });

    const existingTransactions = await tx.inventoryTransaction.findMany({
      where: { business_id: businessId, shopping_session_id: sessionId },
      orderBy: { created_at: "asc" },
      include: { inventory_item: true },
    });

    if (session.status === "committed") {
      return existingTransactions;
    }

    if (existingTransactions.length > 0) {
      throw new Error("Session already partially committed");
    }

    await recomputeSessionState(tx, sessionId);
    const refreshed = await tx.shoppingSession.findFirstOrThrow({
      where: { id: sessionId, business_id: businessId },
      include: { items: true, supplier: true },
    });

    const receiptBalance = getReceiptBalanceCheck({
      receiptId: refreshed.receipt_id,
      receiptSubtotal: refreshed.receipt_subtotal,
      receiptTotal: refreshed.receipt_total,
      taxTotal: refreshed.tax_total,
      items: refreshed.items,
    });

    if (refreshed.status !== "ready") {
      if (refreshed.receipt_id) {
        throw new Error(
          "Receipt scan is not 100% complete. Please rescan the receipt and try again."
        );
      }
      throw new Error("Resolve all discrepancies before committing");
    }

    if (refreshed.receipt_id && (!receiptBalance.isBalanced || receiptBalance.isMissingExpectedTotal)) {
      throw new Error(
        "Receipt scan is not 100% complete. Please rescan the receipt and try again."
      );
    }

    const committableItems = refreshed.items.filter((item) => item.resolution !== "skip");
    if (committableItems.length === 0) {
      throw new Error("No items selected for commit");
    }

    const transactions = [];
    for (const item of committableItems) {
      const useReceipt = item.origin === "receipt" || item.resolution === "accept_receipt";
      const quantity = useReceipt ? (toNumber(item.receipt_quantity) ?? toNumber(item.quantity) ?? 1) : (toNumber(item.quantity) ?? 1);
      const unitPrice = useReceipt
        ? toNumber(item.receipt_unit_price) ?? toNumber(item.staged_unit_price)
        : toNumber(item.staged_unit_price);
      const totalCost = useReceipt
        ? toNumber(item.receipt_line_total) ?? (unitPrice != null ? round(unitPrice * quantity) : null)
        : toNumber(item.staged_line_total) ?? (unitPrice != null ? round(unitPrice * quantity) : null);

      let inventoryItemId = item.inventory_item_id;
      if (!inventoryItemId) {
        const suggestions = await matchText(item.raw_name, 1, businessId);
        if (suggestions.length > 0 && suggestions[0].confidence !== "low" && suggestions[0].confidence !== "none") {
          inventoryItemId = suggestions[0].inventory_item_id;
        } else {
          const created = await tx.inventoryItem.create({
            data: {
              business_id: businessId,
              name: extractProductName(item.raw_name) || item.raw_name,
              unit: item.unit,
              supplier_id: refreshed.supplier_id,
              aliases: {
                create: [{ alias_text: normalizeName(item.raw_name), source: "shopping" }],
              },
            },
          });
          inventoryItemId = created.id;
        }

        await tx.shoppingSessionItem.update({
          where: { id: item.id },
          data: { inventory_item_id: inventoryItemId },
        });
      }

      const transaction = await tx.inventoryTransaction.create({
        data: {
          business_id: businessId,
          inventory_item_id: inventoryItemId,
          transaction_type: "purchase",
          quantity,
          unit: item.unit,
          unit_cost: unitPrice,
          total_cost: totalCost,
          input_method: "shopping",
          source: refreshed.store_name ?? refreshed.supplier?.name ?? "shopping",
          receipt_id: refreshed.receipt_id,
          receipt_line_item_id: item.receipt_line_item_id,
          shopping_session_id: refreshed.id,
          raw_data: {
            shopping_session_item_id: item.id,
            reconciliation_status: item.reconciliation_status,
            resolution: item.resolution,
          } as never,
        },
        include: { inventory_item: true },
      });
      transactions.push(transaction);
    }

    // Record price history and update default_cost for each item
    for (const transaction of transactions) {
      if (transaction.unit_cost == null) continue;

      await tx.itemPriceHistory.create({
        data: {
          business_id: businessId,
          inventory_item_id: transaction.inventory_item_id,
          supplier_id: refreshed.supplier_id,
          shopping_session_id: refreshed.id,
          unit_cost: transaction.unit_cost,
        },
      });

      await tx.inventoryItem.update({
        where: { id: transaction.inventory_item_id },
        data: { default_cost: transaction.unit_cost },
      });
    }

    await tx.shoppingSession.update({
      where: { id: refreshed.id },
      data: {
        status: "committed",
        completed_at: new Date(),
      },
    });

    // Bridge: record in unified financial ledger (idempotent via upsert)
    const expenseAmount = toNumber(refreshed.receipt_total) ?? toNumber(refreshed.staged_subtotal) ?? 0;
    if (expenseAmount > 0) {
      await tx.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: businessId,
            source: "shopping",
            external_id: refreshed.id,
          },
        },
        create: {
          business_id: businessId,
          type: "expense",
          source: "shopping",
          amount: expenseAmount,
          description: refreshed.store_name ?? refreshed.supplier?.name ?? "Shopping trip",
          occurred_at: new Date(),
          external_id: refreshed.id,
          shopping_session_id: refreshed.id,
          metadata: {
            item_count: committableItems.length,
            receipt_total: toNumber(refreshed.receipt_total),
            staged_subtotal: toNumber(refreshed.staged_subtotal),
          } as never,
        },
        update: {},
      });
    }

    return serialize(transactions);
  });
}

export async function getItemPriceHistory(inventoryItemId: string, limit = 20) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const rows = await prisma.itemPriceHistory.findMany({
    where: { inventory_item_id: inventoryItemId, business_id: businessId },
    orderBy: { recorded_at: "desc" },
    take: limit,
    include: { supplier: { select: { name: true } } },
  });
  return serialize(rows);
}

// ============================================================
// Shelf Label Scanning
// ============================================================

export async function scanShelfLabel(data: {
  session_id: string;
  base64_image: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const ocr = await extractTextFromImage(data.base64_image);
  if (!ocr.success) throw new Error(ocr.error ?? "OCR failed");

  const parsed = parseShelfLabel(ocr.raw_text);
  const searchText = parsed.product_name ?? ocr.raw_text;
  const matches = searchText ? await matchText(searchText, 5, businessId) : [];

  return { parsed, matches };
}

export async function addShelfLabelItem(data: {
  session_id: string;
  parsed: ShelfLabelResult;
  inventory_item_id?: string;
}) {
  await requireModule("shopping");
  return addShoppingSessionItem({
    session_id: data.session_id,
    name: data.parsed.product_name ?? data.parsed.raw_text,
    quantity: data.parsed.quantity,
    unit: "each",
    unit_price: data.parsed.unit_price ?? undefined,
    inventory_item_id: data.inventory_item_id,
  });
}

// ============================================================
// Past Orders
// ============================================================

export async function getCommittedShoppingSessions(limit = 30) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const sessions = await prisma.shoppingSession.findMany({
    where: { business_id: businessId, status: "committed" },
    orderBy: { completed_at: "desc" },
    take: limit,
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  return serialize(sessions);
}

export async function reorderShoppingSession(pastSessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const past = await prisma.shoppingSession.findFirstOrThrow({
    where: { id: pastSessionId, business_id: businessId },
    include: {
      supplier: true,
      items: {
        where: { origin: "staged", resolution: { not: "skip" } },
        include: { inventory_item: true },
      },
    },
  });

  if (!past.supplier || !past.google_place_id) {
    throw new Error("Session has no store information");
  }

  const newSession = await prisma.shoppingSession.create({
    data: {
      business_id: businessId,
      supplier_id: past.supplier_id,
      google_place_id: past.google_place_id,
      store_name: past.store_name,
      store_address: past.store_address,
      store_lat: past.store_lat,
      store_lng: past.store_lng,
      status: "draft",
    },
  });

  for (const item of past.items) {
    const price = item.inventory_item?.default_cost
      ? toNumber(item.inventory_item.default_cost)
      : toNumber(item.staged_unit_price);
    const qty = toNumber(item.quantity) ?? 1;

    await prisma.shoppingSessionItem.create({
      data: {
        session_id: newSession.id,
        inventory_item_id: item.inventory_item_id,
        raw_name: item.raw_name,
        normalized_name: item.normalized_name,
        quantity: qty,
        unit: item.unit,
        staged_unit_price: price,
        staged_line_total: price != null ? round(qty * price) : null,
        origin: "staged",
        reconciliation_status: "pending",
        resolution: "pending",
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    await recomputeSessionState(tx, newSession.id);
  });

  return getShoppingSession(newSession.id);
}
