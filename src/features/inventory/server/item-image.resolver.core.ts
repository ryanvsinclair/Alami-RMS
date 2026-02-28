import type { ItemImageResolution } from "../shared/item-image.contracts";

export type ResolveItemImageUrlParams = {
  inventoryItemImageUrl?: string | null;
  pluCode?: number | null;
  barcodeNormalized?: string | null;
  produceImageUrl?: string | null;
  barcodeImageUrl?: string | null;
};

export function normalizeImageUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized;
}

export function normalizeBarcode(value: string | null | undefined): string | null {
  const digitsOnly = value?.replace(/\D/g, "").trim();
  if (!digitsOnly) return null;
  return digitsOnly;
}

export function extractCanonicalPluCodeFromBarcode(barcode: string | null | undefined): number | null {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  if (normalized.length === 4) {
    return Number.parseInt(normalized, 10);
  }

  if (normalized.length === 5 && normalized.startsWith("9")) {
    return Number.parseInt(normalized.slice(1), 10);
  }

  if (normalized.length === 5) {
    return Number.parseInt(normalized, 10);
  }

  return null;
}

export function resolveItemImageUrl(params: ResolveItemImageUrlParams): ItemImageResolution {
  const ownImageUrl = normalizeImageUrl(params.inventoryItemImageUrl);
  if (ownImageUrl) {
    return {
      source: "own",
      imageUrl: ownImageUrl,
    };
  }

  const produceImageUrl = normalizeImageUrl(params.produceImageUrl);
  if (params.pluCode != null && produceImageUrl) {
    return {
      source: "produce",
      imageUrl: produceImageUrl,
    };
  }

  const barcodeImageUrl = normalizeImageUrl(params.barcodeImageUrl);
  if (params.barcodeNormalized != null && barcodeImageUrl) {
    return {
      source: "barcode",
      imageUrl: barcodeImageUrl,
    };
  }

  return {
    source: "none",
    imageUrl: null,
  };
}
