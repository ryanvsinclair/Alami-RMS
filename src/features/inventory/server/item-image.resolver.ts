import { prisma } from "@/server/db/prisma";
import type { ItemImageResolution } from "../shared/item-image.contracts";
import {
  extractCanonicalPluCodeFromBarcode,
  normalizeBarcode,
  normalizeImageUrl,
  resolveItemImageUrl,
  type ResolveItemImageUrlParams,
} from "./item-image.resolver.core";

export {
  extractCanonicalPluCodeFromBarcode,
  normalizeBarcode,
  normalizeImageUrl,
  resolveItemImageUrl,
};
export type { ResolveItemImageUrlParams };

export async function resolveItemImageUrlFromDb(
  inventoryItemId: string,
  businessId: string,
): Promise<ItemImageResolution> {
  const item = await prisma.inventoryItem.findFirst({
    where: {
      id: inventoryItemId,
      business_id: businessId,
    },
    select: {
      image_url: true,
      barcodes: {
        select: {
          barcode: true,
        },
      },
    },
  });

  if (!item) {
    return {
      source: "none",
      imageUrl: null,
    };
  }

  const normalizedBarcodes = Array.from(
    new Set(
      item.barcodes
        .map((barcode) => normalizeBarcode(barcode.barcode))
        .filter((barcode): barcode is string => Boolean(barcode)),
    ),
  );

  const candidatePluCodes = Array.from(
    new Set(normalizedBarcodes.map((barcode) => extractCanonicalPluCodeFromBarcode(barcode))),
  ).filter((pluCode): pluCode is number => pluCode != null);

  const [produceImageRows, barcodeImageRows] = await Promise.all([
    candidatePluCodes.length > 0
      ? prisma.produceItemImage.findMany({
          where: {
            plu_code: { in: candidatePluCodes },
          },
          select: {
            plu_code: true,
            image_url: true,
            enriched_at: true,
          },
          orderBy: {
            enriched_at: "desc",
          },
        })
      : Promise.resolve([]),
    normalizedBarcodes.length > 0
      ? prisma.globalBarcodeCatalog.findMany({
          where: {
            barcode_normalized: { in: normalizedBarcodes },
            image_url: { not: null },
          },
          select: {
            barcode_normalized: true,
            image_url: true,
            last_seen_at: true,
          },
          orderBy: {
            last_seen_at: "desc",
          },
        })
      : Promise.resolve([]),
  ]);

  const selectedProduceImage = produceImageRows.find((row) => normalizeImageUrl(row.image_url) != null) ?? null;
  const selectedBarcodeImage = barcodeImageRows.find((row) => normalizeImageUrl(row.image_url) != null) ?? null;

  return resolveItemImageUrl({
    inventoryItemImageUrl: item.image_url,
    pluCode: selectedProduceImage?.plu_code ?? null,
    barcodeNormalized: selectedBarcodeImage?.barcode_normalized ?? null,
    produceImageUrl: selectedProduceImage?.image_url ?? null,
    barcodeImageUrl: selectedBarcodeImage?.image_url ?? null,
  });
}
