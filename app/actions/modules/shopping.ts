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
import { extractProductName } from "@/core/parsers/product-name";
import { extractTextFromImage } from "@/modules/receipts/ocr/google-vision";
import { scanReceipt, type TabScannerResult } from "@/modules/receipts/ocr/tabscanner";
import { lookupBarcode } from "@/app/actions/core/inventory";
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

function normalizeName(value: string): string {
  return normalizeText(value) || value.toLowerCase().trim();
}

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
}) {
  await requireModule("shopping");
  const businessId = await requireBusinessId();
  const quantity = data.quantity > 0 ? data.quantity : 1;
  const unitPrice = data.unit_price != null && data.unit_price >= 0 ? data.unit_price : null;
  const lineTotal = unitPrice != null ? round(quantity * unitPrice) : null;

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

  // Quick-shop phase: internal tenant DB lookup only (no external providers / web fallback).
  const matchedItem = await lookupBarcode(normalizedBarcode);
  const quantity = data.quantity != null && data.quantity > 0 ? data.quantity : 1;

  const provisionalLabel = `Unresolved Item [UPC:${normalizedBarcode}]`;
  const displayName =
    matchedItem && typeof matchedItem === "object" && "name" in matchedItem
      ? String(matchedItem.name)
      : "Unresolved Item";
  const inventoryItemId =
    matchedItem && typeof matchedItem === "object" && "id" in matchedItem
      ? String(matchedItem.id)
      : undefined;

  const session = await addShoppingSessionItem({
    session_id: data.session_id,
    name: inventoryItemId ? displayName : provisionalLabel,
    quantity,
    inventory_item_id: inventoryItemId,
  });

  return {
    session,
    quick_scan: {
      barcode: data.barcode.trim(),
      normalized_barcode: normalizedBarcode,
      status: inventoryItemId ? ("resolved" as const) : ("unresolved" as const),
      display_name: displayName,
      deferred_resolution: !inventoryItemId,
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

    for (const item of stagedItems) {
      let bestLine: (typeof createdLines)[number] | null = null;
      let bestScore = -1;

      for (const line of createdLines) {
        if (usedLineIds.has(line.id)) continue;

        let score = 0;
        if (item.inventory_item_id && line.matched_item_id === item.inventory_item_id) {
          score = 1;
        } else {
          const lineName = normalizeName(line.parsed_name ?? line.raw_text);
          score = similarity(item.normalized_name, lineName);
        }

        if (score > bestScore) {
          bestScore = score;
          bestLine = line;
        }
      }

      if (!bestLine || bestScore < 0.35) {
        await tx.shoppingSessionItem.update({
          where: { id: item.id },
          data: {
            receipt_line_item_id: null,
            receipt_quantity: null,
            receipt_unit_price: null,
            receipt_line_total: null,
            delta_quantity: null,
            delta_price: null,
            reconciliation_status: "missing_on_receipt",
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

      await tx.shoppingSessionItem.update({
        where: { id: item.id },
        data: {
          inventory_item_id: item.inventory_item_id ?? bestLine.matched_item_id,
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

    for (const item of stagedItems) {
      let bestLine: (typeof createdLines)[number] | null = null;
      let bestScore = -1;

      for (const line of createdLines) {
        if (usedLineIds.has(line.id)) continue;

        let score = 0;
        if (
          item.inventory_item_id &&
          line.matched_item_id === item.inventory_item_id
        ) {
          score = 1;
        } else {
          const lineName = normalizeName(line.parsed_name ?? line.raw_text);
          score = similarity(item.normalized_name, lineName);
        }

        if (score > bestScore) {
          bestScore = score;
          bestLine = line;
        }
      }

      if (!bestLine || bestScore < 0.35) {
        await tx.shoppingSessionItem.update({
          where: { id: item.id },
          data: {
            receipt_line_item_id: null,
            receipt_quantity: null,
            receipt_unit_price: null,
            receipt_line_total: null,
            delta_quantity: null,
            delta_price: null,
            reconciliation_status: "missing_on_receipt",
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

      await tx.shoppingSessionItem.update({
        where: { id: item.id },
        data: {
          inventory_item_id:
            item.inventory_item_id ?? bestLine.matched_item_id,
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
