import type { BarcodeProvider, ExternalProductMetadata } from "../barcode-providers";
import { PROVIDER_TIMEOUT_MS } from "../barcode-providers";

/**
 * UPCDatabase.org API adapter.
 * Requires an API key set via UPCDATABASE_API_KEY env variable.
 * Docs: https://upcdatabase.org/api
 */
export const upcDatabaseProvider: BarcodeProvider = {
  id: "upcdatabase",
  layer: "layer3_upcdatabase",

  async lookup({ normalized_barcode }) {
    const apiKey = process.env.UPCDATABASE_API_KEY;
    if (!apiKey) {
      return {
        outcome: "error" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
        error_code: "no_api_key",
      };
    }

    const url = `https://api.upcdatabase.org/product/${encodeURIComponent(normalized_barcode)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
        error_code: code,
      };
    }

    if (response.status === 404) {
      return {
        outcome: "miss" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
      };
    }

    if (response.status === 429) {
      return {
        outcome: "error" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
        error_code: "rate_limited",
      };
    }

    if (!response.ok) {
      return {
        outcome: "error" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
        error_code: `http_${response.status}`,
      };
    }

    let body: Record<string, unknown>;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        outcome: "error" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
        error_code: "invalid_json",
      };
    }

    if (body.success === false || !body.title) {
      return {
        outcome: "miss" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
      };
    }

    const title = normalizeString(body.title);
    if (!title) {
      return {
        outcome: "miss" as const,
        provider: "upcdatabase" as const,
        layer: "layer3_upcdatabase" as const,
      };
    }

    // Extract size from metadata if available
    const metadata_ = body.metadata as Record<string, unknown> | undefined;
    const sizeText = normalizeString(metadata_?.size);

    // Extract first image if available
    const images = Array.isArray(body.images) ? body.images : [];
    const imageUrl = typeof images[0] === "string" ? images[0] : null;

    const productMetadata: ExternalProductMetadata = {
      name: title,
      brand: normalizeString(body.brand),
      size_text: sizeText,
      category_hint: normalizeString(body.category),
      image_url: imageUrl,
    };

    return {
      outcome: "hit_external" as const,
      provider: "upcdatabase" as const,
      layer: "layer3_upcdatabase" as const,
      metadata: productMetadata,
    };
  },
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
