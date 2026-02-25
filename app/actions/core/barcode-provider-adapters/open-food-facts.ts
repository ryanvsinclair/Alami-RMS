import type { BarcodeProvider, ExternalProductMetadata } from "../barcode-providers";
import { PROVIDER_TIMEOUT_MS } from "../barcode-providers";

const USER_AGENT = "AlamiRMS/1.0 (inventory-management; barcode-lookup)";

/**
 * Open Food Facts API v2 adapter.
 * No authentication required. Rate-limit-friendly with descriptive User-Agent.
 * Docs: https://wiki.openfoodfacts.org/API
 */
export const openFoodFactsProvider: BarcodeProvider = {
  id: "open_food_facts",
  layer: "layer1_open_food_facts",

  async lookup({ normalized_barcode }) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized_barcode)}?fields=product_name,brands,quantity,categories,image_front_url,status`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      const code =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "timeout"
          : "network_error";
      return {
        outcome: "error" as const,
        provider: "open_food_facts" as const,
        layer: "layer1_open_food_facts" as const,
        error_code: code,
      };
    }

    if (!response.ok) {
      return {
        outcome: "error" as const,
        provider: "open_food_facts" as const,
        layer: "layer1_open_food_facts" as const,
        error_code: `http_${response.status}`,
      };
    }

    let body: Record<string, unknown>;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        outcome: "error" as const,
        provider: "open_food_facts" as const,
        layer: "layer1_open_food_facts" as const,
        error_code: "invalid_json",
      };
    }

    // OFF returns status: 0 for "product not found", status: 1 for "product found"
    if (body.status !== 1 || !body.product) {
      return {
        outcome: "miss" as const,
        provider: "open_food_facts" as const,
        layer: "layer1_open_food_facts" as const,
      };
    }

    const product = body.product as Record<string, unknown>;
    const productName = normalizeString(product.product_name);

    if (!productName) {
      // Product exists but has no name -- treat as low-quality miss
      return {
        outcome: "miss" as const,
        provider: "open_food_facts" as const,
        layer: "layer1_open_food_facts" as const,
      };
    }

    const metadata: ExternalProductMetadata = {
      name: productName,
      brand: normalizeString(product.brands),
      size_text: normalizeString(product.quantity),
      category_hint: extractPrimaryCategory(product.categories),
      image_url: normalizeString(product.image_front_url),
    };

    return {
      outcome: "hit_external" as const,
      provider: "open_food_facts" as const,
      layer: "layer1_open_food_facts" as const,
      metadata,
    };
  },
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * OFF categories is a comma-separated string like "Beverages, Sodas, Colas".
 * Return the first (most specific) category.
 */
function extractPrimaryCategory(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[0] ?? null;
}
