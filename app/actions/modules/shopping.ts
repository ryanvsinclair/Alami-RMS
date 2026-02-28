// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/shopping/server/*
"use server";

import { requireModule } from "@/core/modules/guard";
import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { normalizeBarcode } from "@/core/utils/barcode";
import { parseShelfLabel, type ShelfLabelResult } from "@/core/parsers/shelf-label";
import { resolveBarcode } from "@/app/actions/core/barcode-resolver";
import {
  learnReceiptItemAlias,
} from "@/core/matching/receipt-line";
import { requireBusinessId } from "@/core/auth/tenant";
import {
  INTAKE_ITEM_SOURCES,
  INTAKE_SOURCE_ELIGIBILITY,
  type IntakeItemSource,
} from "@/features/intake/shared";
import type {
  ShoppingItemResolution,
  UnitType,
} from "@/lib/generated/prisma/client";

// ─── Canonical implementations (delegated) ───────────────────
import { findActiveSession, findSessionById } from "@/features/shopping/server/session.repository";
import { upsertSupplierFromGooglePlace } from "@/features/shopping/server/supplier-place.service";
import { recomputeSessionState } from "@/features/shopping/server/session-state.service";
import {
  reconcileShoppingSessionReceipt as _reconcileReceipt,
  scanAndReconcileReceipt as _scanAndReconcile,
} from "@/features/shopping/server/receipt-reconcile.service";
import { pairShoppingSessionBarcodeItemToReceiptItem as _pairItems } from "@/features/shopping/server/pairing.service";
import { analyzeShoppingSessionBarcodeItemPhoto as _analyzePhoto } from "@/features/shopping/server/fallback-photo.service";
import { suggestShoppingSessionBarcodeReceiptPairWithWebFallback as _suggestWebPair } from "@/features/shopping/server/fallback-web.service";
import { commitShoppingSession as _commit } from "@/features/shopping/server/commit.service";
import {
  getCommittedShoppingSessions as _getCommitted,
  getItemPriceHistory as _getPriceHistory,
  reorderShoppingSession as _reorder,
} from "@/features/shopping/server/history.service";
import {
  toNumber,
  round,
  normalizeName,
  buildExternalBarcodeDisplayName,
} from "@/features/shopping/server/helpers";
import type { SelectedGooglePlace, ShoppingFallbackPhotoAnalysis } from "@/features/shopping/server/contracts";
import { matchText } from "@/core/matching/engine";

function resolveIntakeSource(source: IntakeItemSource | undefined): IntakeItemSource {
  if (!source) return "manual_entry";
  if ((INTAKE_ITEM_SOURCES as readonly string[]).includes(source)) {
    return source;
  }
  return "manual_entry";
}

// ─── Session CRUD ────────────────────────────────────────────

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
  return findActiveSession(businessId);
}

export async function getShoppingSession(sessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return findSessionById(sessionId, businessId);
}

export async function addShoppingSessionItem(data: {
  session_id: string;
  name: string;
  quantity: number;
  unit?: UnitType;
  unit_price?: number;
  inventory_item_id?: string;
  scanned_barcode?: string;
  intake_source?: IntakeItemSource;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const quantity = data.quantity > 0 ? data.quantity : 1;
  const unitPrice = data.unit_price != null && data.unit_price >= 0 ? data.unit_price : null;
  const lineTotal = unitPrice != null ? round(quantity * unitPrice) : null;
  const scannedBarcode = data.scanned_barcode ? normalizeBarcode(data.scanned_barcode) : null;
  const intakeSource = resolveIntakeSource(data.intake_source);
  const intakePolicy = INTAKE_SOURCE_ELIGIBILITY[intakeSource];

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
        resolution_audit: {
          intake_source: intakeSource,
          inventory_eligibility: intakePolicy.inventory_eligibility,
          requires_explicit_confirmation: intakePolicy.requires_explicit_confirmation,
        } as never,
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
    intake_source: "barcode_scan",
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

export async function searchProduceCatalog(query: string, limit = 8) {
  await requireModule("shopping");
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [] as Array<{
      plu_code: number;
      display_name: string;
      commodity: string;
      variety: string | null;
    }>;
  }

  const safeLimit = Math.max(1, Math.min(limit, 20));
  const rows = await prisma.produceItem.findMany({
    where: {
      language_code: "EN",
      OR: [
        { display_name: { contains: trimmed, mode: "insensitive" } },
        { commodity: { contains: trimmed, mode: "insensitive" } },
        { variety: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      plu_code: true,
      display_name: true,
      commodity: true,
      variety: true,
    },
    orderBy: { display_name: "asc" },
    take: safeLimit,
  });

  return serialize(rows);
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

// ─── Receipt reconciliation (delegated) ──────────────────────

export async function reconcileShoppingSessionReceipt(data: {
  session_id: string;
  raw_text: string;
  image_url?: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _reconcileReceipt({ ...data, businessId });
}

export async function scanAndReconcileReceipt(data: {
  session_id: string;
  base64_image: string;
  image_url?: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _scanAndReconcile({ ...data, businessId });
}

// ─── Resolution / pairing (delegated) ────────────────────────

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
  return _analyzePhoto({ ...data, businessId });
}

export async function suggestShoppingSessionBarcodeReceiptPairWithWebFallback(data: {
  staged_item_id: string;
  photo_analysis?: ShoppingFallbackPhotoAnalysis | null;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _suggestWebPair({ ...data, businessId });
}

export async function pairShoppingSessionBarcodeItemToReceiptItem(data: {
  staged_item_id: string;
  receipt_item_id: string;
  source?: "manual" | "web_suggestion_manual" | "web_suggestion_auto";
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _pairItems({ ...data, businessId });
}

// ─── Commit (delegated) ──────────────────────────────────────

export async function commitShoppingSession(sessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _commit(sessionId, businessId);
}

// ─── Price history (delegated) ───────────────────────────────

export async function getItemPriceHistory(inventoryItemId: string, limit = 20) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _getPriceHistory(inventoryItemId, businessId, limit);
}

// ─── Shelf label scanning ────────────────────────────────────

export async function scanShelfLabel(data: {
  session_id: string;
  base64_image: string;
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const { extractTextFromImage } = await import("@/modules/receipts/ocr/google-vision");
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
    intake_source: "shelf_label_scan",
  });
}

// ─── Past orders (delegated) ─────────────────────────────────

export async function getCommittedShoppingSessions(limit = 30) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _getCommitted(businessId, limit);
}

export async function reorderShoppingSession(pastSessionId: string) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  return _reorder(pastSessionId, businessId);
}
