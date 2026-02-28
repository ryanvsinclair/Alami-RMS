/**
 * Shopping session commit service.
 * Converts a reconciled shopping session into inventory transactions
 * and financial ledger entries.
 */

import { prisma } from "@/server/db/prisma";
import { serialize } from "@/domain/shared/serialize";
import { matchText } from "@/domain/matching/engine";
import { extractProductName } from "@/domain/parsers/product-name";
import { toNumber, round, normalizeName, getReceiptBalanceCheck } from "./helpers";
import { recomputeSessionState } from "./session-state.service";
import {
  INTAKE_ITEM_SOURCES,
  INTAKE_SOURCE_ELIGIBILITY,
  type IntakeItemSource,
} from "@/features/intake/shared";

function resolveShoppingItemIntakeSource(item: {
  origin: "staged" | "receipt";
  scanned_barcode: string | null;
  resolution_audit: unknown;
}): IntakeItemSource {
  const intakeSourceFromAudit =
    item.resolution_audit &&
    typeof item.resolution_audit === "object" &&
    "intake_source" in (item.resolution_audit as Record<string, unknown>)
      ? (item.resolution_audit as Record<string, unknown>).intake_source
      : null;

  if (
    typeof intakeSourceFromAudit === "string" &&
    (INTAKE_ITEM_SOURCES as readonly string[]).includes(intakeSourceFromAudit)
  ) {
    return intakeSourceFromAudit as IntakeItemSource;
  }

  if (item.origin === "receipt") return "receipt_produce_confirmed";
  if (item.scanned_barcode) return "barcode_scan";
  return "manual_entry";
}

export async function commitShoppingSession(
  sessionId: string,
  businessId: string
) {
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
    const ineligibleInventoryItems: Array<{
      shopping_session_item_id: string;
      intake_source: IntakeItemSource;
      inventory_eligibility: string;
    }> = [];
    for (const item of committableItems) {
      const intakeSource = resolveShoppingItemIntakeSource(item);
      const intakePolicy = INTAKE_SOURCE_ELIGIBILITY[intakeSource];
      if (intakePolicy.inventory_eligibility !== "eligible") {
        ineligibleInventoryItems.push({
          shopping_session_item_id: item.id,
          intake_source: intakeSource,
          inventory_eligibility: intakePolicy.inventory_eligibility,
        });
        continue;
      }

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
            intake_source: intakeSource,
            inventory_eligibility: intakePolicy.inventory_eligibility,
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
            inventory_transaction_count: transactions.length,
            ineligible_inventory_item_count: ineligibleInventoryItems.length,
            ineligible_inventory_item_ids: ineligibleInventoryItems.map((entry) => entry.shopping_session_item_id),
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
