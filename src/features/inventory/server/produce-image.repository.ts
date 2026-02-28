import { prisma } from "@/server/db/prisma";
import type { ImageSourceProvider } from "../shared/item-image.contracts";

export async function upsertProduceImage(
  pluCode: number,
  record: {
    imageUrl: string;
    storagePath: string;
    sourceProvider: ImageSourceProvider;
  },
) {
  return prisma.produceItemImage.upsert({
    where: { plu_code: pluCode },
    create: {
      plu_code: pluCode,
      image_url: record.imageUrl,
      storage_path: record.storagePath,
      source_provider: record.sourceProvider,
    },
    update: {
      image_url: record.imageUrl,
      storage_path: record.storagePath,
      source_provider: record.sourceProvider,
      enriched_at: new Date(),
    },
  });
}

export async function findProduceImage(pluCode: number) {
  return prisma.produceItemImage.findUnique({
    where: { plu_code: pluCode },
  });
}

export async function listUnenrichedPluCodes() {
  const produceRows = await prisma.produceItem.findMany({
    where: { language_code: "EN" },
    select: { plu_code: true },
    orderBy: { plu_code: "asc" },
  });

  const uniquePluCodes = Array.from(new Set(produceRows.map((row) => row.plu_code)));
  if (uniquePluCodes.length === 0) {
    return [];
  }

  const enrichedRows = await prisma.produceItemImage.findMany({
    where: {
      plu_code: {
        in: uniquePluCodes,
      },
    },
    select: { plu_code: true },
  });

  const enrichedPluCodes = new Set(enrichedRows.map((row) => row.plu_code));
  return uniquePluCodes.filter((pluCode) => !enrichedPluCodes.has(pluCode));
}
