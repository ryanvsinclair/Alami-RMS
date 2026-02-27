import type { ParsedLineItem, ParsedLineProduceMatch } from "@/domain/parsers/receipt";
import type { ReceiptCorrectionCoreResult, ReceiptCorrectionProvinceCode } from "@/domain/parsers/receipt-correction-core";
import { similarity } from "@/domain/matching/fuzzy";
import { prisma } from "@/server/db/prisma";

type ProduceLookupMethod = ParsedLineProduceMatch["match_method"];
type CorrectionLine = ReceiptCorrectionCoreResult["lines"][number];
type ProduceLookupLanguage = "EN" | "FR" | "ES";

interface ProduceItemRecord {
  plu_code: number;
  language_code: string;
  commodity: string;
  variety: string | null;
  display_name: string;
}

interface ProduceLookupContext {
  provinceHint: ReceiptCorrectionProvinceCode | null;
}

interface ProduceLookupDeps {
  findProduceByPlu(data: {
    pluCode: number;
    languageCode: ProduceLookupLanguage;
  }): Promise<ProduceItemRecord | null>;
  listProduceByLanguage(languageCode: ProduceLookupLanguage): Promise<ProduceItemRecord[]>;
}

const SUPPORTED_LANGUAGES = new Set<ProduceLookupLanguage>(["EN", "FR", "ES"]);
const EN_FALLBACK: ProduceLookupLanguage = "EN";
const NAME_MATCH_THRESHOLD = 0.45;
const PRODUCE_NAME_HINT_PATTERN =
  /\b(apple|apples|banana|bananas|orange|oranges|grape|grapes|pear|pears|lemon|lemons|lime|limes|lettuce|tomato|tomatoes|potato|potatoes|onion|onions|pepper|peppers|broccoli|carrot|carrots|avocado|avocados|cucumber|cucumbers|celery|mushroom|mushrooms|spinach|kale|fruit|fruits|vegetable|vegetables|pomme|pommes|banane|bananes|raisin|raisins|poire|poires|citron|citrons|laitue|tomate|tomates|oignon|oignons|avocat|avocats|concombre|concombres|legume|legumes|manzana|manzanas|platano|platanos|naranja|naranjas|uva|uvas|pera|peras|limon|limones|lechuga|papa|papas|cebolla|cebollas|aguacate|aguacates|pepino|pepinos|fruta|frutas|verdura|verduras)\b/i;

const defaultDeps: ProduceLookupDeps = {
  async findProduceByPlu(data) {
    return prisma.produceItem.findUnique({
      where: {
        plu_code_language_code: {
          plu_code: data.pluCode,
          language_code: data.languageCode,
        },
      },
      select: {
        plu_code: true,
        language_code: true,
        commodity: true,
        variety: true,
        display_name: true,
      },
    });
  },
  async listProduceByLanguage(languageCode) {
    return prisma.produceItem.findMany({
      where: { language_code: languageCode },
      select: {
        plu_code: true,
        language_code: true,
        commodity: true,
        variety: true,
        display_name: true,
      },
    });
  },
};

const produceRowsByLanguageCache = new Map<ProduceLookupLanguage, ProduceItemRecord[]>();
const produceRowsByLanguagePending = new Map<ProduceLookupLanguage, Promise<ProduceItemRecord[]>>();

function normalizeSimilarityText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toWordSet(value: string): Set<string> {
  return new Set(value.split(" ").map((token) => token.trim()).filter((token) => token.length > 1));
}

function wordOverlapScore(a: string, b: string): number {
  const setA = toWordSet(a);
  const setB = toWordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let matches = 0;
  for (const token of setA) {
    if (setB.has(token)) matches += 1;
  }

  return matches / Math.max(setA.size, setB.size);
}

function resolveLanguageOrder(provinceHint: ReceiptCorrectionProvinceCode | null): ProduceLookupLanguage[] {
  if (provinceHint === "QC") {
    return ["FR", EN_FALLBACK];
  }
  return [EN_FALLBACK];
}

function parseValidPluCode(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  const asInt = Math.trunc(value);
  if (asInt <= 0) return null;
  return asInt;
}

function shouldAttemptNameFuzzyLookup(line: ParsedLineItem): boolean {
  if (!line.parsed_name || line.produce_match != null) return false;
  if (line.plu_code != null || line.organic_flag === true) return true;
  return PRODUCE_NAME_HINT_PATTERN.test(line.parsed_name);
}

async function getProduceRowsForLanguage(
  languageCode: ProduceLookupLanguage,
  deps: ProduceLookupDeps,
  useCache: boolean,
): Promise<ProduceItemRecord[]> {
  if (!useCache) {
    return deps.listProduceByLanguage(languageCode);
  }

  const cached = produceRowsByLanguageCache.get(languageCode);
  if (cached) return cached;

  const pending = produceRowsByLanguagePending.get(languageCode);
  if (pending) return pending;

  const next = deps.listProduceByLanguage(languageCode).then((rows) => {
    produceRowsByLanguageCache.set(languageCode, rows);
    produceRowsByLanguagePending.delete(languageCode);
    return rows;
  }).catch((error) => {
    produceRowsByLanguagePending.delete(languageCode);
    throw error;
  });

  produceRowsByLanguagePending.set(languageCode, next);
  return next;
}

function toProduceMatch(record: ProduceItemRecord, method: ProduceLookupMethod): ParsedLineProduceMatch {
  return {
    display_name: record.display_name,
    commodity: record.commodity,
    variety: record.variety ?? null,
    language_code: record.language_code,
    match_method: method,
  };
}

function pickBestFuzzyCandidate(data: {
  query: string;
  candidates: ProduceItemRecord[];
}): { record: ProduceItemRecord; score: number } | null {
  const query = normalizeSimilarityText(data.query);
  if (!query) return null;

  let best: { record: ProduceItemRecord; score: number } | null = null;

  for (const candidate of data.candidates) {
    const display = normalizeSimilarityText(candidate.display_name);
    const commodity = normalizeSimilarityText(candidate.commodity);
    const variety = normalizeSimilarityText(candidate.variety ?? "");

    const displayScore = similarity(query, display);
    const commodityScore = commodity ? similarity(query, commodity) * 0.92 : 0;
    const varietyScore = variety ? similarity(query, variety) * 0.88 : 0;

    const overlapDisplay = wordOverlapScore(query, display) * 0.15;
    const overlapCommodity = commodity ? wordOverlapScore(query, commodity) * 0.1 : 0;
    const overlapVariety = variety ? wordOverlapScore(query, variety) * 0.08 : 0;

    const score = Math.max(
      displayScore + overlapDisplay,
      commodityScore + overlapCommodity,
      varietyScore + overlapVariety,
    );

    if (best == null || score > best.score) {
      best = { record: candidate, score };
    }
  }

  if (best == null || best.score < NAME_MATCH_THRESHOLD) return null;
  return best;
}

async function resolveProduceMatchForLine(data: {
  line: ParsedLineItem;
  languageOrder: ProduceLookupLanguage[];
  deps: ProduceLookupDeps;
  useCache: boolean;
}): Promise<{ match: ParsedLineProduceMatch; usedEnFallback: boolean } | null> {
  const pluCode = parseValidPluCode(data.line.plu_code);
  if (pluCode != null) {
    for (let i = 0; i < data.languageOrder.length; i += 1) {
      const languageCode = data.languageOrder[i];
      const record = await data.deps.findProduceByPlu({ pluCode, languageCode });
      if (!record) continue;
      return {
        match: toProduceMatch(record, "plu"),
        usedEnFallback: i > 0 && languageCode === EN_FALLBACK,
      };
    }
  }

  if (!shouldAttemptNameFuzzyLookup(data.line)) {
    return null;
  }

  for (let i = 0; i < data.languageOrder.length; i += 1) {
    const languageCode = data.languageOrder[i];
    const candidates = await getProduceRowsForLanguage(languageCode, data.deps, data.useCache);
    const best = pickBestFuzzyCandidate({
      query: data.line.parsed_name ?? "",
      candidates,
    });
    if (!best) continue;

    return {
      match: toProduceMatch(best.record, "name_fuzzy"),
      usedEnFallback: i > 0 && languageCode === EN_FALLBACK,
    };
  }

  return null;
}

function attachLookupMetadata(data: {
  entry: CorrectionLine;
  match: ParsedLineProduceMatch;
  usedEnFallback: boolean;
}): CorrectionLine {
  const nextParseFlags = new Set(data.entry.parse_flags);
  nextParseFlags.add(
    data.match.match_method === "plu"
      ? "produce_lookup_plu_match"
      : "produce_lookup_name_fuzzy_match",
  );
  if (data.usedEnFallback) {
    nextParseFlags.add("produce_lookup_language_fallback_en");
  }

  const nextCorrectionActions = [
    ...data.entry.correction_actions,
    {
      type: "produce_lookup_match",
      before: null,
      after: data.match.display_name,
      confidence: data.match.match_method === "plu" ? 0.99 : 0.82,
      reason:
        data.match.match_method === "plu"
          ? "Matched canonical produce row by PLU."
          : "Matched canonical produce row by fuzzy produce-name similarity.",
    },
  ];

  return {
    ...data.entry,
    line: {
      ...data.entry.line,
      produce_match: data.match,
    },
    parse_flags: Array.from(nextParseFlags),
    correction_actions: nextCorrectionActions,
  };
}

export async function applyProduceLookupToCorrectionLines(
  lines: CorrectionLine[],
  context: ProduceLookupContext,
  deps: ProduceLookupDeps = defaultDeps,
): Promise<CorrectionLine[]> {
  const useCache = deps === defaultDeps;
  const languageOrder = resolveLanguageOrder(context.provinceHint);
  const safeLanguageOrder = languageOrder.filter((code): code is ProduceLookupLanguage =>
    SUPPORTED_LANGUAGES.has(code),
  );
  const order = safeLanguageOrder.length > 0 ? safeLanguageOrder : [EN_FALLBACK];

  return Promise.all(
    lines.map(async (entry) => {
      if (entry.line.produce_match != null) {
        return entry;
      }

      const resolved = await resolveProduceMatchForLine({
        line: entry.line,
        languageOrder: order,
        deps,
        useCache,
      });
      if (!resolved) {
        return entry;
      }

      return attachLookupMetadata({
        entry,
        match: resolved.match,
        usedEnFallback: resolved.usedEnFallback,
      });
    }),
  );
}
