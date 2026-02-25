import { lookupBarcode } from "./inventory";
import { openFoodFactsProvider } from "./barcode-provider-adapters/open-food-facts";
import { openBeautyFactsProvider } from "./barcode-provider-adapters/open-beauty-facts";
import { upcDatabaseProvider } from "./barcode-provider-adapters/upcdatabase";
import { upcItemDbProvider } from "./barcode-provider-adapters/upcitemdb";

type LookupBarcodeResult = Awaited<ReturnType<typeof lookupBarcode>>;

export type BarcodeProviderId =
  | "internal_tenant_lookup"
  | "open_food_facts"
  | "open_beauty_facts"
  | "upcdatabase"
  | "upcitemdb";

export type BarcodeProviderLayer =
  | "layer0_internal"
  | "layer1_open_food_facts"
  | "layer2_open_beauty_facts"
  | "layer3_upcdatabase"
  | "layer4_upcitemdb";

/**
 * Product metadata returned by external barcode providers.
 * Not an inventory item -- carries product knowledge for cache + UI presentation.
 */
export type ExternalProductMetadata = {
  name: string;
  brand: string | null;
  size_text: string | null;
  category_hint: string | null;
  image_url: string | null;
};

export type BarcodeProviderLookupResult =
  | {
      outcome: "hit";
      provider: BarcodeProviderId;
      layer: BarcodeProviderLayer;
      item: NonNullable<LookupBarcodeResult>;
    }
  | {
      outcome: "hit_external";
      provider: BarcodeProviderId;
      layer: BarcodeProviderLayer;
      metadata: ExternalProductMetadata;
    }
  | {
      outcome: "miss";
      provider: BarcodeProviderId;
      layer: BarcodeProviderLayer;
    }
  | {
      outcome: "error";
      provider: BarcodeProviderId;
      layer: BarcodeProviderLayer;
      error_code: string;
    };

export interface BarcodeProvider {
  id: BarcodeProviderId;
  layer: BarcodeProviderLayer;
  lookup(data: { normalized_barcode: string }): Promise<BarcodeProviderLookupResult>;
}

/** Per-provider fetch timeout in milliseconds */
export const PROVIDER_TIMEOUT_MS = 4000;

const internalTenantLookupProvider: BarcodeProvider = {
  id: "internal_tenant_lookup",
  layer: "layer0_internal",
  async lookup({ normalized_barcode }) {
    const item = await lookupBarcode(normalized_barcode);
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
};

const externalProviders: readonly BarcodeProvider[] = [
  openFoodFactsProvider,
  openBeautyFactsProvider,
  upcDatabaseProvider,
  upcItemDbProvider,
];

export function getBarcodeProviders(): readonly BarcodeProvider[] {
  return [internalTenantLookupProvider, ...externalProviders];
}
