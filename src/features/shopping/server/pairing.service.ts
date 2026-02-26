/**
 * Shopping item manual pairing service.
 * Handles manual/web-suggested pairing of staged barcode items to receipt items.
 */

import { prisma } from "@/server/db/prisma";
import type { ShoppingReconciliationStatus } from "@/lib/generated/prisma/client";
import { toNumber, round, mergeResolutionAudit } from "./helpers";
import { recomputeSessionState } from "./session-state.service";
import { linkScannedBarcodeToInventoryItemIfHighConfidence } from "./barcode-link.service";
import { findSessionById } from "./session.repository";

export async function pairShoppingSessionBarcodeItemToReceiptItem(data: {
  staged_item_id: string;
  receipt_item_id: string;
  source?: "manual" | "web_suggestion_manual" | "web_suggestion_auto";
  businessId: string;
}) {
  const sessionId = await prisma.$transaction(async (tx) => {
    const stagedItem = await tx.shoppingSessionItem.findFirstOrThrow({
      where: {
        id: data.staged_item_id,
        session: { business_id: data.businessId },
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
        session: { business_id: data.businessId },
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
        businessId: data.businessId,
        scannedBarcode: stagedItem.scanned_barcode,
        inventoryItemId: resolvedInventoryItemId,
        receiptLineConfidence: "high",
      });
    }

    await recomputeSessionState(tx, stagedItem.session_id);
    return stagedItem.session_id;
  });

  return findSessionById(sessionId, data.businessId);
}
