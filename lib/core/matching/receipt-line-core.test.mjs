import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReceiptItemAliasLookupWhere,
  buildReceiptItemAliasUpsertArgs,
  extractReceiptStoreLineCode,
  normalizeReceiptAliasText,
  resolveReceiptLineMatchCore,
} from "./receipt-line-core.ts";

function makeMatch(overrides = {}) {
  return {
    inventory_item_id: "item_1",
    item_name: "Coke",
    score: 0.9,
    confidence: "high",
    match_source: "fuzzy_name",
    ...overrides,
  };
}

test("normalizeReceiptAliasText lowercases, strips punctuation, and collapses spaces", () => {
  assert.equal(
    normalizeReceiptAliasText("  CHKN-BRST!!   Boneless  "),
    "chkn brst boneless"
  );
});

test("extractReceiptStoreLineCode returns leading store code when present", () => {
  assert.equal(
    extractReceiptStoreLineCode("5523795 TERRA DATES $9.49"),
    "5523795"
  );
  assert.equal(
    extractReceiptStoreLineCode("AB1234 SPONGES 2PK 4.99"),
    "ab1234"
  );
});

test("extractReceiptStoreLineCode ignores likely quantities/non-codes", () => {
  assert.equal(extractReceiptStoreLineCode("2 x milk $6.44"), null);
  assert.equal(extractReceiptStoreLineCode("milk 2% 4lt"), null);
  assert.equal(extractReceiptStoreLineCode("123 total"), null);
});

test("buildReceiptItemAliasLookupWhere returns null without place id or usable text", () => {
  assert.equal(
    buildReceiptItemAliasLookupWhere({
      businessId: "biz_1",
      googlePlaceId: null,
      searchText: "Milk",
    }),
    null
  );

  assert.equal(
    buildReceiptItemAliasLookupWhere({
      businessId: "biz_1",
      googlePlaceId: "place_1",
      searchText: "!!!",
    }),
    null
  );
});

test("buildReceiptItemAliasLookupWhere normalizes alias text and scopes by business/place", () => {
  const where = buildReceiptItemAliasLookupWhere({
    businessId: "biz_1",
    googlePlaceId: "place_1",
    searchText: "  Coke Zero 12pk ",
  });

  assert.deepEqual(where, {
    business_id: "biz_1",
    google_place_id: "place_1",
    alias_text: "coke zero 12pk",
    inventory_item: {
      business_id: "biz_1",
      is_active: true,
    },
  });
});

test("buildReceiptItemAliasUpsertArgs normalizes raw text and uses composite unique key", () => {
  const args = buildReceiptItemAliasUpsertArgs({
    businessId: "biz_1",
    googlePlaceId: "place_1",
    inventoryItemId: "item_9",
    rawText: "  COKE-ZERO 12PK  ",
    confidence: "high",
  });

  assert.deepEqual(args, {
    where: {
      business_id_google_place_id_alias_text: {
        business_id: "biz_1",
        google_place_id: "place_1",
        alias_text: "coke zero 12pk",
      },
    },
    create: {
      business_id: "biz_1",
      google_place_id: "place_1",
      alias_text: "coke zero 12pk",
      inventory_item_id: "item_9",
      confidence: "high",
    },
    update: {
      inventory_item_id: "item_9",
      confidence: "high",
    },
  });
});

test("resolveReceiptLineMatchCore prioritizes place alias and skips fuzzy lookup", async () => {
  let fuzzyCalled = false;

  const result = await resolveReceiptLineMatchCore({
    rawText: "COKE ZERO 12PK",
    parsedName: "Coke Zero 12pk",
    profile: "receipt",
    async findPlaceAliasMatch(searchText) {
      assert.equal(searchText, "Coke Zero 12pk");
      return makeMatch({
        inventory_item_id: "item_alias",
        item_name: "Coke Zero",
        confidence: "high",
        match_source: "receipt_place_alias",
        score: 1,
      });
    },
    async matchTextCandidates() {
      fuzzyCalled = true;
      return [makeMatch()];
    },
  });

  assert.equal(fuzzyCalled, false);
  assert.equal(result.matched_item_id, "item_alias");
  assert.equal(result.confidence, "high");
  assert.equal(result.status, "matched");
  assert.equal(result.topMatch?.match_source, "receipt_place_alias");
});

test("resolveReceiptLineMatchCore prioritizes store line code alias before text alias", async () => {
  let textAliasCalled = false;
  let fuzzyCalled = false;

  const result = await resolveReceiptLineMatchCore({
    rawText: "5523795 TERRA DATES $9.49",
    parsedName: "terra dates",
    profile: "receipt",
    async findPlaceCodeAliasMatch(lineCode) {
      assert.equal(lineCode, "5523795");
      return makeMatch({
        inventory_item_id: "item_code",
        item_name: "Terra Dates",
        confidence: "high",
        score: 1,
        match_source: "receipt_place_code_alias",
      });
    },
    async findPlaceAliasMatch() {
      textAliasCalled = true;
      return makeMatch({
        inventory_item_id: "item_text",
        item_name: "Wrong Path",
        match_source: "receipt_place_alias",
      });
    },
    async matchTextCandidates() {
      fuzzyCalled = true;
      return [makeMatch()];
    },
  });

  assert.equal(textAliasCalled, false);
  assert.equal(fuzzyCalled, false);
  assert.equal(result.matched_item_id, "item_code");
  assert.equal(result.topMatch?.match_source, "receipt_place_code_alias");
});

test("resolveReceiptLineMatchCore maps medium fuzzy matches to suggested only for receipt profile", async () => {
  const fuzzyMatch = makeMatch({
    inventory_item_id: "item_medium",
    confidence: "medium",
    score: 0.62,
    match_source: "fuzzy_alias",
  });

  const receiptResult = await resolveReceiptLineMatchCore({
    rawText: "CHK BRST",
    profile: "receipt",
    async findPlaceAliasMatch() {
      return null;
    },
    async matchTextCandidates() {
      return [fuzzyMatch];
    },
  });

  assert.equal(receiptResult.matched_item_id, "item_medium");
  assert.equal(receiptResult.confidence, "medium");
  assert.equal(receiptResult.status, "suggested");

  const shoppingResult = await resolveReceiptLineMatchCore({
    rawText: "CHK BRST",
    profile: "shopping",
    async findPlaceAliasMatch() {
      return null;
    },
    async matchTextCandidates() {
      return [fuzzyMatch];
    },
  });

  assert.equal(shoppingResult.matched_item_id, "item_medium");
  assert.equal(shoppingResult.confidence, "medium");
  assert.equal(shoppingResult.status, "unresolved");
});

test("resolveReceiptLineMatchCore returns unresolved when no alias or fuzzy matches exist", async () => {
  const result = await resolveReceiptLineMatchCore({
    rawText: "UNKNOWN ITEM",
    profile: "receipt",
    async findPlaceAliasMatch() {
      return null;
    },
    async matchTextCandidates() {
      return [];
    },
  });

  assert.deepEqual(result, {
    matched_item_id: null,
    confidence: "none",
    status: "unresolved",
    topMatch: null,
  });
});
