/**
 * Barcode-to-inventory-item linking service.
 * Links scanned barcodes to inventory items when confidence is high.
 */

import { normalizeBarcode } from "@/domain/barcode/normalize";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function linkScannedBarcodeToInventoryItemIfHighConfidence(
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
