export const IMAGE_SOURCE_PROVIDERS = [
  "spoonacular",
  "barcode_provider",
  "manual",
] as const;

export type ImageSourceProvider = (typeof IMAGE_SOURCE_PROVIDERS)[number];

export type ProduceImageRecord = {
  pluCode: number;
  imageUrl: string;
  storagePath: string;
  sourceProvider: ImageSourceProvider;
  enrichedAt: Date;
};

export type ItemImageResolution = {
  imageUrl: string | null;
  source: "own" | "produce" | "barcode" | "none";
};

export const ITEM_IMAGES_BUCKET = "item-images" as const;
export const PRODUCE_IMAGE_PATH_PREFIX = "produce/" as const;
export const BARCODE_IMAGE_PATH_PREFIX = "barcodes/" as const;
export const INVENTORY_IMAGE_PATH_PREFIX = "inventory/" as const;
