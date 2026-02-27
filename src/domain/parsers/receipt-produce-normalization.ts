import type { ParsedLineItem } from "./receipt";

export interface ProduceNormalizationCorrectionHint {
  type: "plu_9prefix_normalized" | "organic_keyword_stripped";
  before: string | number | null;
  after: string | number | null;
  reason: string;
}

export interface ProduceNormalizationResult {
  line: ParsedLineItem;
  produce_candidate: boolean;
  parse_flags: string[];
  corrections: ProduceNormalizationCorrectionHint[];
}

const ORGANIC_KEYWORDS = new Set([
  "organic",
  "org",
  "bio",
  "biologique",
  "organique",
  "organico",
  "ecologico",
]);

const PRODUCE_HINT_TOKENS = new Set([
  "apple",
  "apples",
  "banana",
  "bananas",
  "orange",
  "oranges",
  "grape",
  "grapes",
  "pear",
  "pears",
  "lemon",
  "lemons",
  "lime",
  "limes",
  "lettuce",
  "tomato",
  "tomatoes",
  "potato",
  "potatoes",
  "onion",
  "onions",
  "pepper",
  "peppers",
  "broccoli",
  "carrot",
  "carrots",
  "avocado",
  "avocados",
  "cucumber",
  "cucumbers",
  "celery",
  "mushroom",
  "mushrooms",
  "spinach",
  "kale",
  "fruit",
  "fruits",
  "vegetable",
  "vegetables",
  "pomme",
  "pommes",
  "banane",
  "bananes",
  "raisin",
  "raisins",
  "poire",
  "poires",
  "citron",
  "citrons",
  "laitue",
  "tomate",
  "tomates",
  "oignon",
  "oignons",
  "avocat",
  "avocats",
  "concombre",
  "concombres",
  "fruit",
  "fruits",
  "legume",
  "legumes",
  "manzana",
  "manzanas",
  "platano",
  "platanos",
  "naranja",
  "naranjas",
  "uva",
  "uvas",
  "pera",
  "peras",
  "limon",
  "limones",
  "lechuga",
  "tomate",
  "tomates",
  "papa",
  "papas",
  "cebolla",
  "cebollas",
  "aguacate",
  "aguacates",
  "pepino",
  "pepinos",
  "fruta",
  "frutas",
  "verdura",
  "verduras",
]);

const DIGIT_TOKEN_PATTERN = /\b\d{4,5}\b/g;
const PACKAGED_SKU_PATTERN = /\b\d{6,}\b/;

function normalizeToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tokenizeText(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean);
}

function stripOrganicKeywords(name: string | null | undefined): {
  cleaned_name: string | null;
  removed_tokens: string[];
} {
  if (!name) {
    return { cleaned_name: null, removed_tokens: [] };
  }

  const originalTokens = name
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const removed: string[] = [];
  const kept = originalTokens.filter((token) => {
    const normalized = normalizeToken(token);
    const isOrganic = normalized.length > 0 && ORGANIC_KEYWORDS.has(normalized);
    if (isOrganic) {
      removed.push(normalized);
    }
    return !isOrganic;
  });

  return {
    cleaned_name: kept.length > 0 ? kept.join(" ") : null,
    removed_tokens: Array.from(new Set(removed)),
  };
}

function normalizePluToken(rawToken: string): {
  plu_code: number | null;
  normalized: boolean;
  original: number | null;
} {
  if (!/^\d{4,5}$/.test(rawToken)) {
    return { plu_code: null, normalized: false, original: null };
  }

  if (rawToken.length === 5) {
    if (!rawToken.startsWith("9")) {
      return { plu_code: null, normalized: false, original: Number.parseInt(rawToken, 10) };
    }

    return {
      plu_code: Number.parseInt(rawToken.slice(1), 10),
      normalized: true,
      original: Number.parseInt(rawToken, 10),
    };
  }

  return {
    plu_code: Number.parseInt(rawToken, 10),
    normalized: false,
    original: Number.parseInt(rawToken, 10),
  };
}

function extractCanonicalPlu(line: ParsedLineItem): {
  canonical_plu: number | null;
  normalized_from_9prefix: boolean;
  original_plu: number | null;
} {
  const explicitPlu = line.plu_code == null ? null : Number(line.plu_code);
  if (explicitPlu != null && Number.isFinite(explicitPlu)) {
    const normalized = normalizePluToken(String(Math.trunc(explicitPlu)));
    return {
      canonical_plu: normalized.plu_code,
      normalized_from_9prefix: normalized.normalized,
      original_plu: normalized.original,
    };
  }

  const rawCandidates = line.raw_text.match(DIGIT_TOKEN_PATTERN) ?? [];

  const normalizedNinePrefix = rawCandidates.find(
    (token) => token.length === 5 && token.startsWith("9"),
  );
  if (normalizedNinePrefix) {
    const normalized = normalizePluToken(normalizedNinePrefix);
    return {
      canonical_plu: normalized.plu_code,
      normalized_from_9prefix: normalized.normalized,
      original_plu: normalized.original,
    };
  }

  const fourDigit = rawCandidates.find((token) => token.length === 4);
  if (fourDigit) {
    const normalized = normalizePluToken(fourDigit);
    return {
      canonical_plu: normalized.plu_code,
      normalized_from_9prefix: normalized.normalized,
      original_plu: normalized.original,
    };
  }

  return {
    canonical_plu: null,
    normalized_from_9prefix: false,
    original_plu: null,
  };
}

function detectProduceCandidate(input: {
  line: ParsedLineItem;
  canonicalPlu: number | null;
  normalizedFromNinePrefix: boolean;
  cleanedName: string | null;
  strippedOrganicTokenCount: number;
}): boolean {
  if (PACKAGED_SKU_PATTERN.test(input.line.raw_text)) return false;
  if (input.normalizedFromNinePrefix) return true;

  const tokens = tokenizeText(input.cleanedName);
  const hasProduceHint = tokens.some((token) => PRODUCE_HINT_TOKENS.has(token));

  if (input.canonicalPlu != null) {
    return hasProduceHint || input.strippedOrganicTokenCount > 0;
  }

  if (!input.cleanedName) return false;

  return hasProduceHint;
}

export function normalizeReceiptProduceLine(line: ParsedLineItem): ProduceNormalizationResult {
  const parseFlags: string[] = [];
  const corrections: ProduceNormalizationCorrectionHint[] = [];
  const plu = extractCanonicalPlu(line);
  const organicKeywordStrip = stripOrganicKeywords(line.parsed_name);
  const produceCandidate = detectProduceCandidate({
    line,
    canonicalPlu: plu.canonical_plu,
    normalizedFromNinePrefix: plu.normalized_from_9prefix,
    cleanedName: organicKeywordStrip.cleaned_name,
    strippedOrganicTokenCount: organicKeywordStrip.removed_tokens.length,
  });

  if (!produceCandidate) {
    return {
      line: {
        ...line,
        produce_match: line.produce_match ?? null,
      },
      produce_candidate: false,
      parse_flags: parseFlags,
      corrections,
    };
  }

  if (plu.normalized_from_9prefix && plu.original_plu != null && plu.canonical_plu != null) {
    parseFlags.push("plu_9prefix_normalized");
    corrections.push({
      type: "plu_9prefix_normalized",
      before: plu.original_plu,
      after: plu.canonical_plu,
      reason: "Normalized 5-digit organic PLU by stripping the leading 9 prefix.",
    });
  }

  if (organicKeywordStrip.removed_tokens.length > 0) {
    parseFlags.push("organic_keyword_stripped");
    corrections.push({
      type: "organic_keyword_stripped",
      before: line.parsed_name ?? null,
      after: organicKeywordStrip.cleaned_name,
      reason: "Removed organic adjective tokens from produce text for canonical matching.",
    });
  }

  const organicDetected =
    Boolean(line.organic_flag) ||
    plu.normalized_from_9prefix ||
    organicKeywordStrip.removed_tokens.length > 0;

  const normalizedLine: ParsedLineItem = {
    ...line,
    parsed_name:
      organicKeywordStrip.cleaned_name && organicKeywordStrip.cleaned_name !== line.parsed_name
        ? organicKeywordStrip.cleaned_name
        : line.parsed_name,
    plu_code: plu.canonical_plu,
    produce_match: line.produce_match ?? null,
    organic_flag: organicDetected ? true : line.organic_flag ?? null,
  };

  return {
    line: normalizedLine,
    produce_candidate: true,
    parse_flags: parseFlags,
    corrections,
  };
}
