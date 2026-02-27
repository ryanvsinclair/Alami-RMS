import test from "node:test";
import assert from "node:assert/strict";

const workflowModule = await import("./receipt-workflow.service.ts");

const buildHistoricalPriceHintsFromSamples =
  workflowModule.buildHistoricalPriceHintsFromSamples ??
  workflowModule.default?.buildHistoricalPriceHintsFromSamples;

if (typeof buildHistoricalPriceHintsFromSamples !== "function") {
  throw new Error("Unable to load buildHistoricalPriceHintsFromSamples");
}

function makeLine(overrides = {}) {
  return {
    line_number: 1,
    raw_text: "MILK 2% 4.99",
    parsed_name: "MILK 2%",
    quantity: 1,
    unit: "each",
    line_cost: 4.99,
    unit_cost: 4.99,
    ...overrides,
  };
}

function makeSample(overrides = {}) {
  return {
    parsed_name: "MILK 2%",
    line_cost: 5.0,
    unit_cost: 5.0,
    status: "matched",
    matched_item_id: "item-1",
    ...overrides,
  };
}

test("buildHistoricalPriceHintsFromSamples prioritizes feedback-aligned priors over unresolved noise", () => {
  const hints = buildHistoricalPriceHintsFromSamples({
    lines: [makeLine({ parsed_name: "MILK 2%" })],
    samples: [
      makeSample({ line_cost: 10.0, unit_cost: 10.0, status: "confirmed", matched_item_id: "item-1" }),
      makeSample({ line_cost: 11.0, unit_cost: 11.0, status: "matched", matched_item_id: "item-1" }),
      makeSample({ line_cost: 7.0, unit_cost: 7.0, status: "unresolved", matched_item_id: null }),
      makeSample({ line_cost: 7.2, unit_cost: 7.2, status: "unresolved", matched_item_id: null }),
      makeSample({ line_cost: 7.3, unit_cost: 7.3, status: "unresolved", matched_item_id: null }),
      makeSample({ line_cost: 7.4, unit_cost: 7.4, status: "suggested", matched_item_id: null }),
    ],
  });

  assert.equal(hints.length, 1);
  assert.equal(hints[0].reference_line_cost, 10.5);
  assert.equal(hints[0].sample_size, 2);
  assert.equal(hints[0].source, "manual");
});

test("buildHistoricalPriceHintsFromSamples falls back to fuzzy-name bucket when exact key is missing", () => {
  const hints = buildHistoricalPriceHintsFromSamples({
    lines: [makeLine({ parsed_name: "ORGANIC GALA APPLE", raw_text: "ORGANIC GALA APPLE 5.49", line_cost: 5.49 })],
    samples: [
      makeSample({
        parsed_name: "ORGANIC GALA APPLES",
        line_cost: 5.4,
        status: "confirmed",
        matched_item_id: "item-2",
      }),
      makeSample({
        parsed_name: "ORGANIC GALA APPLES",
        line_cost: 5.5,
        status: "matched",
        matched_item_id: "item-2",
      }),
    ],
  });

  assert.equal(hints.length, 1);
  assert.equal(hints[0].reference_line_cost, 5.45);
  assert.equal(hints[0].source, "manual");
});

test("buildHistoricalPriceHintsFromSamples blocks weak far-price priors for price-proximity safety", () => {
  const hints = buildHistoricalPriceHintsFromSamples({
    lines: [makeLine({ parsed_name: "MILK 2%", line_cost: 4.0, unit_cost: 4.0 })],
    samples: [
      makeSample({ line_cost: 59.0, unit_cost: 59.0, status: "confirmed", matched_item_id: "item-9" }),
      makeSample({ line_cost: 61.0, unit_cost: 61.0, status: "matched", matched_item_id: "item-9" }),
    ],
  });

  assert.equal(hints.length, 0);
});
