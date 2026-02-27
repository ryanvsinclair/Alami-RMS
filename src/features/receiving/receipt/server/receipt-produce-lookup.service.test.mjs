import test from "node:test";
import assert from "node:assert/strict";

const produceLookupModule = await import("./receipt-produce-lookup.service.ts");
const applyProduceLookupToCorrectionLines =
  produceLookupModule.applyProduceLookupToCorrectionLines ??
  produceLookupModule.default?.applyProduceLookupToCorrectionLines ??
  produceLookupModule["module.exports"]?.applyProduceLookupToCorrectionLines;

if (typeof applyProduceLookupToCorrectionLines !== "function") {
  throw new Error("Unable to load applyProduceLookupToCorrectionLines from receipt-produce-lookup.service.ts");
}

function makeCorrectionEntry(lineOverrides = {}, entryOverrides = {}) {
  return {
    line: {
      line_number: 1,
      raw_text: "POMMES GALA",
      parsed_name: "POMMES GALA",
      quantity: 1,
      unit: "each",
      line_cost: 6.99,
      unit_cost: 6.99,
      plu_code: null,
      produce_match: null,
      organic_flag: null,
      ...lineOverrides,
    },
    parse_confidence_score: 0.91,
    parse_confidence_band: "high",
    parse_flags: [],
    correction_actions: [],
    ...entryOverrides,
  };
}

test("applyProduceLookupToCorrectionLines uses Quebec language preference with EN PLU fallback", async () => {
  const pluCalls = [];
  const result = await applyProduceLookupToCorrectionLines(
    [
      makeCorrectionEntry({
        raw_text: "ORGANIC GALA APPLES 4131",
        parsed_name: "GALA APPLES",
        plu_code: 4131,
        organic_flag: true,
      }),
    ],
    { provinceHint: "QC" },
    {
      async findProduceByPlu({ pluCode, languageCode }) {
        pluCalls.push(`${pluCode}:${languageCode}`);
        if (pluCode === 4131 && languageCode === "EN") {
          return {
            plu_code: 4131,
            language_code: "EN",
            commodity: "Apple",
            variety: "Gala",
            display_name: "Gala Apples",
          };
        }
        return null;
      },
      async listProduceByLanguage() {
        return [];
      },
    },
  );

  assert.deepEqual(pluCalls, ["4131:FR", "4131:EN"]);
  assert.equal(result[0].line.produce_match?.match_method, "plu");
  assert.equal(result[0].line.produce_match?.language_code, "EN");
  assert.ok(result[0].parse_flags.includes("produce_lookup_plu_match"));
  assert.ok(result[0].parse_flags.includes("produce_lookup_language_fallback_en"));
});

test("applyProduceLookupToCorrectionLines resolves fuzzy name match in preferred province language", async () => {
  const result = await applyProduceLookupToCorrectionLines(
    [
      makeCorrectionEntry({
        raw_text: "POMMES GALA",
        parsed_name: "Pommes Gala",
        plu_code: null,
        organic_flag: null,
      }),
    ],
    { provinceHint: "QC" },
    {
      async findProduceByPlu() {
        return null;
      },
      async listProduceByLanguage(languageCode) {
        if (languageCode === "FR") {
          return [
            {
              plu_code: 4131,
              language_code: "FR",
              commodity: "Pomme",
              variety: "Gala",
              display_name: "Pommes Gala",
            },
          ];
        }
        return [];
      },
    },
  );

  assert.equal(result[0].line.produce_match?.match_method, "name_fuzzy");
  assert.equal(result[0].line.produce_match?.language_code, "FR");
  assert.equal(result[0].line.produce_match?.display_name, "Pommes Gala");
  assert.ok(result[0].parse_flags.includes("produce_lookup_name_fuzzy_match"));
});

test("applyProduceLookupToCorrectionLines skips non-produce fuzzy lookups", async () => {
  let listCalls = 0;
  const result = await applyProduceLookupToCorrectionLines(
    [
      makeCorrectionEntry({
        raw_text: "USB CABLE 9.99",
        parsed_name: "USB CABLE",
        plu_code: null,
        organic_flag: null,
      }),
    ],
    { provinceHint: "ON" },
    {
      async findProduceByPlu() {
        return null;
      },
      async listProduceByLanguage() {
        listCalls += 1;
        return [];
      },
    },
  );

  assert.equal(listCalls, 0);
  assert.equal(result[0].line.produce_match ?? null, null);
});
