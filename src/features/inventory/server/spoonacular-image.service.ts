import { prisma } from "@/server/db/prisma";

const SPOONACULAR_INGREDIENT_SEARCH_ENDPOINT =
  "https://api.spoonacular.com/food/ingredients/search";
const SPOONACULAR_IMAGE_BASE_URL =
  "https://spoonacular.com/cdn/ingredients_500x500/";
const REQUEST_TIMEOUT_MS = 8_000;
const MISS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

const spoonacularMissCache = new Map<string, number>();
const spoonacularHitCache = new Map<string, string>();

function normalizeQueryName(rawName: string): string {
  return rawName
    .replace(/\(PLU\s*\d{3,6}\)\s*$/i, "")
    .replace(/\[UPC:\d{8,14}\]\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function shouldSkipSpoonacularQuery(queryName: string): boolean {
  if (!queryName) return true;
  const lowered = queryName.toLowerCase();
  return (
    lowered === "unresolved item" ||
    lowered === "new item" ||
    lowered.length < 2
  );
}

function rememberMiss(queryName: string) {
  spoonacularMissCache.set(queryName.toLowerCase(), Date.now());
}

function wasRecentMiss(queryName: string): boolean {
  const key = queryName.toLowerCase();
  const lastMissAt = spoonacularMissCache.get(key);
  if (!lastMissAt) return false;
  if (Date.now() - lastMissAt > MISS_CACHE_TTL_MS) {
    spoonacularMissCache.delete(key);
    return false;
  }
  return true;
}

function rememberHit(queryName: string, imageUrl: string) {
  spoonacularHitCache.set(queryName.toLowerCase(), imageUrl);
}

function getRememberedHit(queryName: string): string | null {
  return spoonacularHitCache.get(queryName.toLowerCase()) ?? null;
}

export async function findSpoonacularIngredientImageUrlByName(
  rawName: string,
): Promise<string | null> {
  const apiKey = process.env.SPOONACULAR_API_KEY?.trim();
  if (!apiKey) return null;

  const queryName = normalizeQueryName(rawName);
  if (shouldSkipSpoonacularQuery(queryName)) return null;

  const cachedHit = getRememberedHit(queryName);
  if (cachedHit) return cachedHit;
  if (wasRecentMiss(queryName)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(SPOONACULAR_INGREDIENT_SEARCH_ENDPOINT);
    url.searchParams.set("query", queryName);
    url.searchParams.set("number", "1");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 402 || response.status === 429) {
        rememberMiss(queryName);
      }
      return null;
    }

    const payload = (await response.json()) as {
      results?: Array<{ image?: string | null }>;
    };

    const imageFileName = payload.results?.[0]?.image?.trim();
    if (!imageFileName) {
      rememberMiss(queryName);
      return null;
    }

    const imageUrl = `${SPOONACULAR_IMAGE_BASE_URL}${imageFileName}`;
    rememberHit(queryName, imageUrl);
    return imageUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveAndPersistMissingInventoryItemImage(params: {
  inventoryItemId: string;
  businessId: string;
  itemName: string;
  currentImageUrl?: string | null;
}): Promise<string | null> {
  const normalizedCurrent = params.currentImageUrl?.trim();
  if (normalizedCurrent) {
    return normalizedCurrent;
  }

  const spoonacularImageUrl = await findSpoonacularIngredientImageUrlByName(
    params.itemName,
  );
  if (!spoonacularImageUrl) return null;

  const updated = await prisma.inventoryItem.updateMany({
    where: {
      id: params.inventoryItemId,
      business_id: params.businessId,
      image_url: null,
    },
    data: {
      image_url: spoonacularImageUrl,
    },
  });

  if (updated.count > 0) {
    return spoonacularImageUrl;
  }

  const current = await prisma.inventoryItem.findFirst({
    where: {
      id: params.inventoryItemId,
      business_id: params.businessId,
    },
    select: {
      image_url: true,
    },
  });

  return current?.image_url?.trim() || spoonacularImageUrl;
}
