import assert from "node:assert/strict";
import test from "node:test";

import { parseReceiptText } from "./receipt.ts";

test("parseReceiptText skips subtotal/tax/total lines including dotted H.S.T. labels", () => {
  const lines = parseReceiptText(
    [
      "FRESH SALSA 12.99",
      "MULTIGRAIN BREAD 4.29",
      "Sub Total 17.28",
      "H.S.T. 2.25",
      "Total 19.53",
    ].join("\n")
  );

  assert.equal(lines.length, 2);
  assert.equal(lines[0].parsed_name, "FRESH SALSA");
  assert.equal(lines[1].parsed_name, "MULTIGRAIN BREAD");
  assert.equal(lines[0].line_cost, 12.99);
  assert.equal(lines[1].line_cost, 4.29);
});

test("parseReceiptText skips Quebec TPS/TVQ tax lines and grand total noise", () => {
  const lines = parseReceiptText(
    [
      "FROMAGE 10.00",
      "PAIN 2.00",
      "Subtotal 12.00",
      "TPS 0.60",
      "TVQ 1.20",
      "Grand Total 13.80",
    ].join("\n")
  );

  assert.equal(lines.length, 2);
  assert.equal(lines[0].parsed_name, "FROMAGE");
  assert.equal(lines[1].parsed_name, "PAIN");
  assert.equal(lines[0].line_cost, 10.0);
  assert.equal(lines[1].line_cost, 2.0);
});

test("parseReceiptText skips subtotal/total label variants and French tax labels", () => {
  const lines = parseReceiptText(
    [
      "POMMES 6.99",
      "PAIN 2.99",
      "Sub-Total : 9 98",
      "Taxe 13 % 1 30",
      "Total Due 11 28",
      "Montant total 11,28",
    ].join("\n")
  );

  assert.equal(lines.length, 2);
  assert.equal(lines[0].parsed_name, "POMMES");
  assert.equal(lines[1].parsed_name, "PAIN");
  assert.equal(lines[0].line_cost, 6.99);
  assert.equal(lines[1].line_cost, 2.99);
});

test("parseReceiptText merges wrapped item descriptions with next-line numeric clusters", () => {
  const lines = parseReceiptText(
    [
      "ORGANIC AVOCADO HASS",
      "2 x 3.49 6.98",
      "Sub Total 6.98",
      "HST 0.91",
      "Total 7.89",
    ].join("\n")
  );

  assert.equal(lines.length, 1);
  assert.equal(lines[0].parsed_name, "ORGANIC AVOCADO HASS");
  assert.equal(lines[0].quantity, 2);
  assert.equal(lines[0].line_cost, 6.98);
  assert.equal(lines[0].unit_cost, 3.49);
});

test("parseReceiptText strips SKU prefix with store-profile hint and parses qty x unit-price clusters", () => {
  const lines = parseReceiptText("4011 BANANAS 2 x 1.49 2.98", {
    skuPositionHint: "prefix",
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].parsed_name, "BANANAS");
  assert.equal(lines[0].quantity, 2);
  assert.equal(lines[0].line_cost, 2.98);
  assert.equal(lines[0].unit_cost, 1.49);
});

test("parseReceiptText uses province hint to classify generic tax lines as non-item summary lines", () => {
  const lines = parseReceiptText(
    [
      "CROISSANT 3.49",
      "Tax 13% 0.45",
      "Total 3.94",
    ].join("\n"),
    { provinceHint: "ON" }
  );

  assert.equal(lines.length, 1);
  assert.equal(lines[0].parsed_name, "CROISSANT");
  assert.equal(lines[0].line_cost, 3.49);
});

test("parseReceiptText honors store-profile SKU suffix hint for suffix-coded item rows", () => {
  const lines = parseReceiptText("ALMOND MILK 00041234 4.99", {
    skuPositionHint: "suffix",
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].parsed_name, "ALMOND MILK");
  assert.equal(lines[0].line_cost, 4.99);
});
