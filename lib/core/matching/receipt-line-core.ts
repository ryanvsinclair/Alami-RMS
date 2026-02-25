export type ReceiptLineMatchProfile = "receipt" | "shopping";

export type ReceiptLineMatchConfidence = "high" | "medium" | "low" | "none";

export type ReceiptLineMatchStatus = "matched" | "suggested" | "unresolved";

export type ReceiptLineMatchSource =
  | "receipt_place_code_alias"
  | "receipt_place_alias"
  | "exact_alias"
  | "fuzzy_alias"
  | "fuzzy_name"
  | "word_overlap";

export interface ReceiptLineMatchCandidate {
  inventory_item_id: string;
  item_name: string;
  score: number;
  confidence: ReceiptLineMatchConfidence;
  match_source: ReceiptLineMatchSource;
}

export interface ResolveReceiptLineMatchCoreInput {
  rawText: string;
  parsedName?: string | null;
  profile: ReceiptLineMatchProfile;
  findPlaceCodeAliasMatch?: (
    lineCode: string
  ) => Promise<ReceiptLineMatchCandidate | null>;
  findPlaceAliasMatch: (searchText: string) => Promise<ReceiptLineMatchCandidate | null>;
  matchTextCandidates: (searchText: string) => Promise<ReceiptLineMatchCandidate[]>;
}

export interface ResolvedReceiptLineMatchCore {
  matched_item_id: string | null;
  confidence: ReceiptLineMatchConfidence;
  status: ReceiptLineMatchStatus;
  topMatch: ReceiptLineMatchCandidate | null;
}

// Keep in sync with fuzzy.normalizeText(). Duplicated here so this module stays
// runnable under plain Node tests without Next/TS path/runtime helpers.
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeReceiptAliasText(text: string): string {
  return normalizeText(text);
}

/**
 * Extract a likely store-specific line code from the start of a receipt line.
 * Examples:
 *   "5523795 TERRA DATES $9.49" -> "5523795"
 *   "AB1234 SPONGES 2PK 4.99" -> "ab1234"
 */
export function extractReceiptStoreLineCode(rawText: string): string | null {
  const normalized = normalizeReceiptAliasText(rawText);
  if (!normalized) return null;

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  const first = parts[0];
  if (first.length < 4 || first.length > 16) return null;
  if (!/^[a-z0-9]+$/.test(first)) return null;
  if (!/\d/.test(first)) return null;

  // Avoid capturing quantities like "2 x milk" or decimal fragments.
  const remainder = parts.slice(1).join(" ");
  if (!/[a-z]/.test(remainder)) return null;

  return first;
}

export function buildReceiptItemAliasLookupWhere(params: {
  businessId: string;
  googlePlaceId?: string | null;
  searchText: string;
}): Record<string, unknown> | null {
  if (!params.googlePlaceId) return null;

  const normalized = normalizeReceiptAliasText(params.searchText);
  if (!normalized) return null;

  return {
    business_id: params.businessId,
    google_place_id: params.googlePlaceId,
    alias_text: normalized,
    inventory_item: {
      business_id: params.businessId,
      is_active: true,
    },
  };
}

export function buildReceiptItemAliasUpsertArgs(params: {
  businessId: string;
  googlePlaceId?: string | null;
  inventoryItemId: string;
  rawText: string;
  confidence?: ReceiptLineMatchConfidence;
}): {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
} | null {
  if (!params.googlePlaceId) return null;

  const normalized = normalizeReceiptAliasText(params.rawText);
  if (!normalized) return null;

  const confidence = params.confidence ?? "high";

  return {
    where: {
      business_id_google_place_id_alias_text: {
        business_id: params.businessId,
        google_place_id: params.googlePlaceId,
        alias_text: normalized,
      },
    },
    create: {
      business_id: params.businessId,
      google_place_id: params.googlePlaceId,
      alias_text: normalized,
      inventory_item_id: params.inventoryItemId,
      confidence,
    },
    update: {
      inventory_item_id: params.inventoryItemId,
      confidence,
    },
  };
}

export function mapReceiptLineMatchToStatus(
  topMatch: ReceiptLineMatchCandidate | null,
  profile: ReceiptLineMatchProfile
): ReceiptLineMatchStatus {
  if (!topMatch) return "unresolved";
  if (topMatch.confidence === "high") return "matched";
  if (profile === "receipt" && topMatch.confidence === "medium") {
    return "suggested";
  }
  return "unresolved";
}

export async function resolveReceiptLineMatchCore({
  rawText,
  parsedName,
  profile,
  findPlaceCodeAliasMatch,
  findPlaceAliasMatch,
  matchTextCandidates,
}: ResolveReceiptLineMatchCoreInput): Promise<ResolvedReceiptLineMatchCore> {
  if (findPlaceCodeAliasMatch) {
    const lineCode = extractReceiptStoreLineCode(rawText);
    if (lineCode) {
      const placeCodeAliasMatch = await findPlaceCodeAliasMatch(lineCode);
      if (placeCodeAliasMatch) {
        return {
          matched_item_id: placeCodeAliasMatch.inventory_item_id,
          confidence: placeCodeAliasMatch.confidence,
          status: mapReceiptLineMatchToStatus(placeCodeAliasMatch, profile),
          topMatch: placeCodeAliasMatch,
        };
      }
    }
  }

  const searchText = parsedName ?? rawText;
  const placeAliasMatch = await findPlaceAliasMatch(searchText);

  if (placeAliasMatch) {
    return {
      matched_item_id: placeAliasMatch.inventory_item_id,
      confidence: placeAliasMatch.confidence,
      status: mapReceiptLineMatchToStatus(placeAliasMatch, profile),
      topMatch: placeAliasMatch,
    };
  }

  const matches = await matchTextCandidates(searchText);
  const topMatch = matches[0] ?? null;

  return {
    matched_item_id: topMatch?.inventory_item_id ?? null,
    confidence: topMatch?.confidence ?? "none",
    status: mapReceiptLineMatchToStatus(topMatch, profile),
    topMatch,
  };
}
