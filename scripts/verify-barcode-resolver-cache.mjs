import "dotenv/config";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { normalizeBarcode } from "../lib/core/utils/barcode.ts";
import { resolveNormalizedBarcodeWithProviders } from "../app/actions/core/barcode-resolver-core.ts";
import {
  buildBarcodeResolutionEventCreateArgs,
  buildResolvedGlobalBarcodeCatalogUpsertArgs,
  buildUnresolvedGlobalBarcodeCatalogUpsertArgs,
} from "../app/actions/core/barcode-resolver-cache.ts";

const DEFAULT_SEED_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const HIT_BARCODE = "012345678905";
const MISS_BARCODE = "0999999999999";

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

async function pickSeedItem(prisma) {
  return prisma.inventoryItem.findFirst({
    where: { business_id: DEFAULT_SEED_BUSINESS_ID },
    include: {
      category: true,
      supplier: true,
      barcodes: true,
      aliases: true,
    },
    orderBy: { created_at: "asc" },
  });
}

async function ensureSeedBarcode(prisma, { businessId, inventoryItemId, barcode }) {
  const existing = await prisma.itemBarcode.findFirst({
    where: { business_id: businessId, barcode },
    select: { id: true },
  });
  if (existing) {
    return { created: false, id: existing.id };
  }

  const created = await prisma.itemBarcode.create({
    data: {
      business_id: businessId,
      inventory_item_id: inventoryItemId,
      barcode,
    },
    select: { id: true },
  });
  return { created: true, id: created.id };
}

async function findInventoryItemByBarcode(prisma, { businessId, barcode }) {
  const result = await prisma.itemBarcode.findFirst({
    where: { business_id: businessId, barcode },
    include: {
      inventory_item: {
        include: {
          category: true,
          supplier: true,
          barcodes: true,
          aliases: true,
        },
      },
    },
  });
  return result?.inventory_item ?? null;
}

async function run() {
  const { prisma, pool } = createPrisma();
  try {
    const hitBarcode = normalizeBarcode(HIT_BARCODE);
    const missBarcode = normalizeBarcode(MISS_BARCODE);
    const barcodes = [hitBarcode, missBarcode];

    const seedItem = await pickSeedItem(prisma);
    if (!seedItem) {
      throw new Error(
        `No inventory items found for seed business ${DEFAULT_SEED_BUSINESS_ID}`
      );
    }

    await prisma.barcodeResolutionEvent.deleteMany({
      where: { barcode_normalized: { in: barcodes } },
    });
    await prisma.globalBarcodeCatalog.deleteMany({
      where: { barcode_normalized: { in: barcodes } },
    });

    const seededBarcode = await ensureSeedBarcode(prisma, {
      businessId: seedItem.business_id,
      inventoryItemId: seedItem.id,
      barcode: hitBarcode,
    });

    const providers = [
      {
        id: "internal_tenant_lookup",
        layer: "layer0_internal",
        async lookup({ normalized_barcode }) {
          const item = await findInventoryItemByBarcode(prisma, {
            businessId: seedItem.business_id,
            barcode: normalized_barcode,
          });
          if (!item) {
            return {
              outcome: "miss",
              provider: "internal_tenant_lookup",
              layer: "layer0_internal",
            };
          }
          return {
            outcome: "hit",
            provider: "internal_tenant_lookup",
            layer: "layer0_internal",
            item,
          };
        },
      },
    ];

    const readGlobalBarcodeCatalog = (barcode) =>
      prisma.globalBarcodeCatalog.findUnique({
        where: { barcode_normalized: barcode },
      });

    const upsertResolvedGlobalBarcodeCatalog = async ({
      barcode,
      provider,
      item,
      observedAt,
    }) =>
      prisma.globalBarcodeCatalog.upsert(
        buildResolvedGlobalBarcodeCatalogUpsertArgs({
          barcode,
          provider,
          item,
          observedAt,
        })
      );

    const upsertUnresolvedGlobalBarcodeCatalog = async ({
      barcode,
      observedAt,
      previous,
    }) => {
      const { args } = buildUnresolvedGlobalBarcodeCatalogUpsertArgs({
        barcode,
        observedAt,
        previous,
      });
      return prisma.globalBarcodeCatalog.upsert(args);
    };

    const createBarcodeResolutionEvent = (data) =>
      prisma.barcodeResolutionEvent.create(buildBarcodeResolutionEventCreateArgs(data));

    const hitResult = await resolveNormalizedBarcodeWithProviders({
      normalizedBarcode: hitBarcode,
      providers,
      readGlobalBarcodeCatalog,
      upsertResolvedGlobalBarcodeCatalog,
      upsertUnresolvedGlobalBarcodeCatalog,
      createBarcodeResolutionEvent,
      shouldRethrowProviderError: (providerId) => providerId === "internal_tenant_lookup",
    });

    const missResult = await resolveNormalizedBarcodeWithProviders({
      normalizedBarcode: missBarcode,
      providers,
      readGlobalBarcodeCatalog,
      upsertResolvedGlobalBarcodeCatalog,
      upsertUnresolvedGlobalBarcodeCatalog,
      createBarcodeResolutionEvent,
      shouldRethrowProviderError: (providerId) => providerId === "internal_tenant_lookup",
    });

    const catalogRows = await prisma.globalBarcodeCatalog.findMany({
      where: { barcode_normalized: { in: barcodes } },
      orderBy: { barcode_normalized: "asc" },
      select: {
        barcode_normalized: true,
        resolution_status: true,
        failure_count: true,
        retry_after_at: true,
        source_provider: true,
        source_updated_at: true,
        confidence: true,
        last_seen_at: true,
      },
    });

    const eventRows = await prisma.barcodeResolutionEvent.findMany({
      where: { barcode_normalized: { in: barcodes } },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: {
        barcode_normalized: true,
        provider: true,
        outcome: true,
        confidence: true,
        error_code: true,
        duration_ms: true,
        created_at: true,
        barcode_catalog_id: true,
      },
    });

    const summary = {
      seed: {
        business_id: seedItem.business_id,
        inventory_item_id: seedItem.id,
        inventory_item_name: seedItem.name,
        hit_barcode: hitBarcode,
        hit_barcode_created: seededBarcode.created,
        item_barcode_id: seededBarcode.id,
        miss_barcode: missBarcode,
      },
      results: {
        hit: {
          status: hitResult.status,
          source: hitResult.source,
          layer: hitResult.layer,
          normalized_barcode: hitResult.normalized_barcode,
          item_id: hitResult.status === "resolved" ? hitResult.item.id : null,
          item_name: hitResult.status === "resolved" ? hitResult.item.name : null,
        },
        miss: missResult,
      },
      global_barcode_catalog: catalogRows,
      barcode_resolution_events: eventRows,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
