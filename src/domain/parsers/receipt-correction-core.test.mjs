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

test("historical price hint can steer decimal inference toward store-typical price range", () => {
  const result = runReceiptCorrectionCore({
    source: "tabscanner",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "AGED CHEDDAR 14900",
        parsed_name: "AGED CHEDDAR",
        line_cost: 14900,
        unit_cost: 14900,
      }),
    ],
    historical_price_hints: [
      {
        line_number: 1,
        reference_line_cost: 14.95,
        reference_unit_cost: 14.95,
        sample_size: 8,
        source: "receipt_line_history",
      },
    ],
  });

  const line = result.lines[0];
  assert.equal(line.line.line_cost, 14.9);
  assert.ok(line.parse_flags.includes("historical_price_signal_available"));
  assert.ok(actionTypesFor(line).includes("decimal_inferred"));
});

test("historical price hint with sample size below threshold does not affect candidate selection", () => {
  const result = runReceiptCorrectionCore({
    source: "tabscanner",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "AGED CHEDDAR 14900",
        parsed_name: "AGED CHEDDAR",
        line_cost: 14900,
        unit_cost: 14900,
      }),
    ],
    historical_price_hints: [
      {
        line_number: 1,
        reference_line_cost: 14.95,
        reference_unit_cost: 14.95,
        sample_size: 1,
        source: "receipt_line_history",
      },
    ],
  });

  assert.equal(result.lines[0].line.line_cost, 149);
});

test("historical price hint below workflow-aligned threshold (sample size 3) does not steer candidate selection", () => {
  const result = runReceiptCorrectionCore({
    source: "tabscanner",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "AGED CHEDDAR 14900",
        parsed_name: "AGED CHEDDAR",
        line_cost: 14900,
        unit_cost: 14900,
      }),
    ],
    historical_price_hints: [
      {
        line_number: 1,
        reference_line_cost: 14.95,
        reference_unit_cost: 14.95,
        sample_size: 3,
        source: "receipt_line_history",
      },
    ],
  });

  assert.equal(result.lines[0].line.line_cost, 149);
});

test("historical price hint at workflow-aligned threshold (sample size 4) can steer decimal inference", () => {
  const result = runReceiptCorrectionCore({
    source: "tabscanner",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "AGED CHEDDAR 14900",
        parsed_name: "AGED CHEDDAR",
        line_cost: 14900,
        unit_cost: 14900,
      }),
    ],
    historical_price_hints: [
      {
        line_number: 1,
        reference_line_cost: 14.95,
        reference_unit_cost: 14.95,
        sample_size: 4,
        source: "receipt_line_history",
      },
    ],
  });

  const line = result.lines[0];
  assert.equal(line.line.line_cost, 14.9);
  assert.ok(line.parse_flags.includes("historical_price_signal_available"));
});

test("tax interpretation validates Ontario HST structure and math from google places province hint", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "BREAD 4.99",
        parsed_name: "BREAD",
        line_cost: 4.99,
        unit_cost: 4.99,
      }),
      makeLine({
        line_number: 2,
        raw_text: "SNACKS 5.01",
        parsed_name: "SNACKS",
        line_cost: 5.01,
        unit_cost: 5.01,
      }),
    ],
    totals: {
      subtotal: 10.0,
      tax: 1.3,
      total: 11.3,
      province_hint: "ON",
      province_hint_source: "google_places",
      tax_lines: [{ label: "H.S.T.", amount: 1.3 }],
    },
  });

  assert.equal(result.tax_interpretation.province, "ON");
  assert.equal(result.tax_interpretation.province_source, "google_places");
  assert.equal(result.tax_interpretation.structure, "on_hst");
  assert.equal(result.tax_interpretation.status, "pass");
  assert.equal(result.tax_interpretation.zero_tax_grocery_candidate, false);
  assert.equal(result.tax_interpretation.amounts.hst, 1.3);
  assert.equal(result.tax_interpretation.deltas.on_hst, 0);
});

test("tax interpretation validates Quebec TPS/TVQ dual-tax structure and math", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "FROMAGE 100.00",
        parsed_name: "FROMAGE",
        line_cost: 100,
        unit_cost: 100,
      }),
    ],
    totals: {
      subtotal: 100.0,
      tax: 14.98,
      total: 114.98,
      tax_lines: [
        { label: "TPS", amount: 5.0 },
        { label: "TVQ", amount: 9.98 },
      ],
      address_text: "123 Rue Test, Montreal QC H2X 1Y4",
    },
  });

  assert.equal(result.tax_interpretation.province, "QC");
  assert.equal(result.tax_interpretation.province_source, "tax_labels");
  assert.equal(result.tax_interpretation.structure, "qc_gst_qst");
  assert.equal(result.tax_interpretation.status, "pass");
  assert.equal(result.tax_interpretation.amounts.tps, 5.0);
  assert.equal(result.tax_interpretation.amounts.tvq, 9.98);
  assert.equal(result.tax_interpretation.deltas.qc_gst, 0);
  assert.equal(result.tax_interpretation.deltas.qc_qst, 0);
});

test("tax interpretation prioritizes google places province hint when tax labels conflict", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "FROMAGE 10.00",
        parsed_name: "FROMAGE",
        line_cost: 10,
        unit_cost: 10,
      }),
    ],
    totals: {
      subtotal: 10.0,
      tax: 1.5,
      total: 11.5,
      province_hint: "ON",
      province_hint_source: "google_places",
      tax_lines: [
        { label: "TPS", amount: 0.5 },
        { label: "TVQ", amount: 1.0 },
      ],
      address_text: "123 Rue Test, Montreal QC H2X 1Y4",
    },
  });

  assert.equal(result.tax_interpretation.province, "ON");
  assert.equal(result.tax_interpretation.province_source, "google_places");
  assert.equal(result.tax_interpretation.structure, "qc_gst_qst");
  assert.equal(result.tax_interpretation.status, "warn");
  assert.ok(
    result.tax_interpretation.flags.includes("province_signal_conflict_tax_labels")
  );
  assert.ok(
    result.tax_interpretation.flags.includes("province_signal_conflict_address_fallback")
  );
  assert.ok(result.tax_interpretation.flags.includes("tax_structure_unexpected_for_on"));
});

test("tax interpretation flags Quebec HST-only structure as mismatch/incomplete", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "FROMAGE 10.00",
        parsed_name: "FROMAGE",
        line_cost: 10,
        unit_cost: 10,
      }),
    ],
    totals: {
      subtotal: 10.0,
      tax: 1.3,
      total: 11.3,
      province_hint: "QC",
      province_hint_source: "google_places",
      tax_lines: [{ label: "HST", amount: 1.3 }],
    },
  });

  assert.equal(result.tax_interpretation.province, "QC");
  assert.equal(result.tax_interpretation.province_source, "google_places");
  assert.equal(result.tax_interpretation.structure, "on_hst");
  assert.equal(result.tax_interpretation.status, "warn");
  assert.ok(result.tax_interpretation.flags.includes("hst_unexpected_for_qc"));
  assert.ok(result.tax_interpretation.flags.includes("missing_qc_tax_components"));
  assert.ok(
    result.tax_interpretation.flags.includes("province_signal_conflict_tax_labels")
  );
});

test("tax interpretation treats subtotal-equals-total with no tax lines as zero-tax candidate instead of warning", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "MILK 4.99",
        parsed_name: "MILK",
        line_cost: 4.99,
        unit_cost: 4.99,
      }),
      makeLine({
        line_number: 2,
        raw_text: "BREAD 3.00",
        parsed_name: "BREAD",
        line_cost: 3.0,
        unit_cost: 3.0,
      }),
    ],
    totals: {
      subtotal: 7.99,
      total: 7.99,
      tax: 0,
      province_hint: "ON",
      province_hint_source: "google_places",
    },
  });

  assert.equal(result.tax_interpretation.status, "pass");
  assert.equal(result.tax_interpretation.structure, "no_tax_line");
  assert.equal(result.tax_interpretation.zero_tax_grocery_candidate, true);
  assert.ok(
    result.tax_interpretation.flags.includes("zero_tax_subtotal_equals_total_candidate")
  );
});

test("produce normalization strips 9-prefix PLU and marks organic produce flags", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "ORGANIC BANANAS 94131 4.99",
        parsed_name: "ORGANIC BANANAS 94131",
        line_cost: 4.99,
        unit_cost: 4.99,
      }),
    ],
  });

  const line = result.lines[0];
  assert.equal(line.line.plu_code, 4131);
  assert.equal(line.line.organic_flag, true);
  assert.equal(line.line.parsed_name, "BANANAS 94131");
  assert.ok(line.parse_flags.includes("plu_9prefix_normalized"));
  assert.ok(line.parse_flags.includes("organic_keyword_stripped"));
  assert.ok(actionTypesFor(line).includes("plu_9prefix_normalized"));
  assert.ok(actionTypesFor(line).includes("organic_keyword_stripped"));
});

test("produce normalization strips French organic keywords without forcing non-produce lines", () => {
  const result = runReceiptCorrectionCore({
    source: "parsed_text",
    lines: [
      makeLine({
        line_number: 1,
        raw_text: "POMMES BIO 3.99",
        parsed_name: "POMMES BIO",
        line_cost: 3.99,
        unit_cost: 3.99,
      }),
      makeLine({
        line_number: 2,
        raw_text: "123456 ORGANIC GRANOLA 5.99",
        parsed_name: "ORGANIC GRANOLA",
        line_cost: 5.99,
        unit_cost: 5.99,
      }),
    ],
  });

  const produceLine = result.lines[0];
  assert.equal(produceLine.line.parsed_name, "POMMES");
  assert.equal(produceLine.line.organic_flag, true);
  assert.ok(produceLine.parse_flags.includes("organic_keyword_stripped"));

  const nonProduceLine = result.lines[1];
  assert.equal(nonProduceLine.line.organic_flag ?? null, null);
  assert.ok(!nonProduceLine.parse_flags.includes("organic_keyword_stripped"));
});
