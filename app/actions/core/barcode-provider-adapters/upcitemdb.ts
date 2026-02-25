import type { BarcodeProvider, ExternalProductMetadata } from "../barcode-providers";
import { PROVIDER_TIMEOUT_MS } from "../barcode-providers";

/**
 * Simple in-memory daily request counter for the free trial tier.
 * Resets at midnight UTC. This is per-process only; sufficient for
 * a single dev/prod instance. For multi-instance deployments,
 * consider a shared Redis counter.
 */
const DAILY_LIMIT = 95; // Leave 5-request buffer under the 100/day free limit
let dailyRequestCount = 0;
let currentDay = todayUTC();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkAndIncrementThrottle(): boolean {
  const day = todayUTC();
  if (day !== currentDay) {
    currentDay = day;
    dailyRequestCount = 0;
  }
  if (dailyRequestCount >= DAILY_LIMIT) {
    return false;
  }
  dailyRequestCount++;
  return true;
}

/**
 * UPCitemdb trial API adapter.
 * Free plan: 100 requests/day, no API key required (uses /trial/ path).
 * Docs: https://devs.upcitemdb.com/
 */
export const upcItemDbProvider: BarcodeProvider = {
  id: "upcitemdb",
  layer: "layer4_upcitemdb",

  async lookup({ normalized_barcode }) {
    if (!checkAndIncrementThrottle()) {
      return {
        outcome: "error" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
        error_code: "daily_limit_reached",
      };
    }

    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(normalized_barcode)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      const code =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "timeout"
          : "network_error";
      return {
        outcome: "error" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
        error_code: code,
      };
    }

    if (response.status === 429) {
      return {
        outcome: "error" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
        error_code: "rate_limited",
      };
    }

    if (!response.ok) {
      return {
        outcome: "error" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
        error_code: `http_${response.status}`,
      };
    }

    let body: Record<string, unknown>;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        outcome: "error" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
        error_code: "invalid_json",
      };
    }

    // Response: { code: "OK", total: N, offset: 0, items: [...] }
    if (body.code !== "OK") {
      return {
        outcome: "miss" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
      };
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return {
        outcome: "miss" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
      };
    }

    const product = items[0] as Record<string, unknown>;
    const title = normalizeString(product.title);

    if (!title) {
      return {
        outcome: "miss" as const,
        provider: "upcitemdb" as const,
        layer: "layer4_upcitemdb" as const,
      };
    }

    // Extract first image from the images array
    const images = Array.isArray(product.images) ? product.images : [];
    const imageUrl = typeof images[0] === "string" ? images[0] : null;

    const metadata: ExternalProductMetadata = {
      name: title,
      brand: normalizeString(product.brand),
      size_text: normalizeString(product.size),
      category_hint: normalizeString(product.category),
      image_url: imageUrl,
    };

    return {
      outcome: "hit_external" as const,
      provider: "upcitemdb" as const,
      layer: "layer4_upcitemdb" as const,
      metadata,
    };
  },
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
