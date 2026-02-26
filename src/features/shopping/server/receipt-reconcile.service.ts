/**
 * Shopping receipt reconciliation services.
 * Handles both raw text and TabScanner structured receipt reconciliation.
 */

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { parseReceiptText } from "@/core/parsers/receipt";
import { resolveReceiptLineMatch } from "@/core/matching/receipt-line";
import { scanReceipt, type TabScannerResult } from "@/modules/receipts/ocr/tabscanner";
import type { Prisma, ShoppingReconciliationStatus, UnitType } from "@/lib/generated/prisma/client";
import {
  toNumber,
  round,
  normalizeName,
  scoreShoppingReceiptLineCandidate,
  parseReceiptTotals,
} from "./helpers";
import { recomputeSessionState } from "./session-state.service";
import { linkScannedBarcodeToInventoryItemIfHighConfidence } from "./barcode-link.service";

// ─── Shared reconciliation loop ──────────────────────────────

async function reconcileStagedItemsAgainstLines(
  tx: Prisma.TransactionClient,
  params: {
    sessionId: string;
    businessId: string;
    createdLines: Array<{
      id: string;
      matched_item_id: string | null;
      raw_text: string;
      parsed_name: string | null;
      quantity: Prisma.Decimal | number | null;
      unit: string | null;
      line_cost: Prisma.Decimal | number | null;
      unit_cost: Prisma.Decimal | number | null;
      confidence: string | null;
    }>;
  }
) {
  const { sessionId, businessId, createdLines } = params;

  // Remove old receipt-origin items
  await tx.shoppingSessionItem.deleteMany({
    where: { session_id: sessionId, origin: "receipt" },
  });

  const stagedItems = await tx.shoppingSessionItem.findMany({
    where: { session_id: sessionId, origin: "staged" },
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

  // Create shopping items for unmatched receipt lines
  for (const line of createdLines) {
    if (usedLineIds.has(line.id)) continue;
    const lineName = line.parsed_name ?? line.raw_text;
    await tx.shoppingSessionItem.create({
      data: {
        session_id: sessionId,
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

  await recomputeSessionState(tx, sessionId);
}

// ─── Full session result loader (post-reconciliation) ────────

async function loadFullSessionResult(
  tx: Prisma.TransactionClient,
  sessionId: string
) {
  const result = await tx.shoppingSession.findUnique({
    where: { id: sessionId },
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
}

// ─── Raw text reconciliation ─────────────────────────────────

export async function reconcileShoppingSessionReceipt(data: {
  session_id: string;
  raw_text: string;
  image_url?: string;
  businessId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.shoppingSession.findFirstOrThrow({
      where: { id: data.session_id, business_id: data.businessId },
      include: {
        items: { orderBy: { created_at: "asc" } },
      },
    });

    if (session.status === "committed" || session.status === "cancelled") {
      throw new Error("Session is closed");
    }

    const receipt = await tx.receipt.create({
      data: {
        business_id: data.businessId,
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
          businessId: data.businessId,
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

    await reconcileStagedItemsAgainstLines(tx, {
      sessionId: session.id,
      businessId: data.businessId,
      createdLines,
    });

    return loadFullSessionResult(tx, session.id);
  });
}

// ─── TabScanner reconciliation ───────────────────────────────

export async function reconcileWithTabScannerData(params: {
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

    await reconcileStagedItemsAgainstLines(tx, {
      sessionId: session.id,
      businessId: business_id,
      createdLines,
    });

    return loadFullSessionResult(tx, session.id);
  });
}

// ─── Combined scan + reconcile ───────────────────────────────

export async function scanAndReconcileReceipt(data: {
  session_id: string;
  base64_image: string;
  image_url?: string;
  businessId: string;
}) {
  // Step 1: Scan receipt with TabScanner
  const scanResult = await scanReceipt(data.base64_image);
  if (!scanResult.success || !scanResult.result) {
    throw new Error(scanResult.error ?? "Receipt scan failed");
  }

  const ts = scanResult.result;

  // Step 2: Reconcile using TabScanner structured data
  return reconcileWithTabScannerData({
    session_id: data.session_id,
    business_id: data.businessId,
    tabscanner: ts,
    image_url: data.image_url,
  });
}
