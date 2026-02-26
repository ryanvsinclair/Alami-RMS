import assert from "node:assert/strict";
import test from "node:test";

import { runReceiptCorrectionCore } from "./receipt-correction-core.ts";

function makeLine(overrides = {}) {
  return {
    line_number: 1,
    raw_text: "ITEM",
    parsed_name: "ITEM",
    quantity: 1,
    unit: "each",
    line_cost: null,
    unit_cost: null,
    ...overrides,
  };
}

function actionTypesFor(lineResult) {
  return lineResult.correction_actions.map((action) => action.type);
}

test("infers missing decimal from integer-like OCR price and passes totals consistency", () => {
  const result = runReceiptCorrectionCore({
    source: "tabscanner",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "5523795 TERRA DATES",
        parsed_name: "TERRA DATES",
        line_cost: 949,
        unit_cost: 949,
      }),
      makeLine({
        line_number: 2,
        raw_text: "BANANAS",
        parsed_name: "BANANAS",
        line_cost: 14.97,
        unit_cost: 14.97,
      }),
    ],
    totals: {
      subtotal: 24.46,
      tax: 1.22,
      total: 25.68,
      currency: "CAD",
    },
  });

  assert.equal(result.lines[0].line.line_cost, 9.49);
  assert.equal(result.lines[0].line.unit_cost, 9.49);
  assert.ok(result.lines[0].parse_flags.includes("decimal_inferred"));
  assert.ok(actionTypesFor(result.lines[0]).includes("decimal_inferred"));
  assert.equal(result.totals_check.status, "pass");
  assert.equal(result.totals_check.delta_to_total, 0);
  assert.equal(result.stats.changed_line_count, 1);
});

test("recovers split numeric token from raw text and marks split-token correction", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "MILK 2% 9 49",
        parsed_name: "MILK 2",
      }),
    ],
  });

  const line = result.lines[0];
  assert.equal(line.line.line_cost, 9.49);
  assert.equal(line.line.unit_cost, 9.49);
  assert.equal(line.parse_confidence_band, "high");
  assert.ok(line.parse_flags.includes("split_numeric_token_detected"));
  assert.ok(line.parse_flags.includes("line_cost_inferred"));
  assert.ok(line.parse_flags.includes("dual_numeric_interpretation_considered"));
  assert.ok(actionTypesFor(line).includes("split_numeric_joined"));
  assert.equal(result.totals_check.status, "not_evaluated");
  assert.equal(result.stats.changed_line_count, 1);
});

test("totals outlier recheck can switch from locally plausible candidate to better total-consistent candidate", () => {
  const result = runReceiptCorrectionCore({
    source: "tabscanner",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "5523795 TERRA DATES",
        parsed_name: "TERRA DATES",
        line_cost: 14900,
        unit_cost: 14900,
      }),
      makeLine({
        line_number: 2,
        raw_text: "SPARKLING WATER",
        parsed_name: "SPARKLING WATER",
        line_cost: 5.49,
        unit_cost: 5.49,
      }),
    ],
    totals: {
      subtotal: 6.98,
      tax: 0,
      total: 6.98,
      currency: "CAD",
    },
  });

  const correctedLine = result.lines[0];
  assert.equal(correctedLine.line.line_cost, 1.49);
  assert.ok(correctedLine.parse_flags.includes("totals_outlier_recheck_selected"));
  assert.ok(actionTypesFor(correctedLine).includes("decimal_inferred"));
  assert.ok(actionTypesFor(correctedLine).includes("totals_outlier_recheck"));
  assert.equal(result.totals_check.status, "pass");
  assert.equal(result.totals_check.delta_to_total, 0);
  assert.deepEqual(result.totals_check.outlier_line_numbers, [1]);
});
