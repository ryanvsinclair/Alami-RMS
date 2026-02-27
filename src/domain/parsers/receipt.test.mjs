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
