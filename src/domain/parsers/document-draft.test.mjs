import test from "node:test";
import assert from "node:assert/strict";

const parserModule = await import("./document-draft.ts");

const {
  parseDocumentFromPostmark,
  parseDocumentFromText,
  parseDocumentFromJson,
  scoreDocumentConfidence,
  stripHtml,
} = parserModule;

function makePostmarkPayload(overrides = {}) {
  return {
    TextBody: "",
    HtmlBody: "",
    Date: "Sat, 28 Feb 2026 22:10:00 +0000",
    FromFull: {
      Name: "Metro Produce",
      Email: "billing@metroproduce.test",
    },
    ...overrides,
  };
}

test("parseDocumentFromPostmark extracts vendor/date/total from realistic text body", () => {
  const payload = makePostmarkPayload({
    TextBody: [
      "Metro Produce Ltd.",
      "Invoice Date: 2026-02-26",
      "Green Apples 2 x 6.00 12.00",
      "Bananas 1 x 8.00 8.00",
      "HST 13%: $2.60",
      "Grand Total: $22.60",
    ].join("\n"),
  });

  const parsed = parseDocumentFromPostmark(payload);
  assert.equal(parsed.vendor_name, "Metro Produce Ltd.");
  assert.equal(parsed.date, "2026-02-26");
  assert.equal(parsed.total, 22.6);
  assert.equal(parsed.tax, 2.6);
  assert.ok(parsed.line_items.length >= 2);
});

test("parseDocumentFromPostmark falls back to HtmlBody when TextBody is empty", () => {
  const payload = makePostmarkPayload({
    TextBody: "   ",
    HtmlBody: "<div>Vendor: Farm Hub</div><div>Date: 2026-02-20</div><div>Total: $18.99</div>",
  });

  const parsed = parseDocumentFromPostmark(payload);
  assert.equal(parsed.vendor_name, "Farm Hub");
  assert.equal(parsed.date, "2026-02-20");
  assert.equal(parsed.total, 18.99);
});

test("parseDocumentFromPostmark vendor fallback uses FromFull.Name when body has no candidate", () => {
  const payload = makePostmarkPayload({
    TextBody: "Invoice #991\nTotal: $35.00",
    FromFull: {
      Name: "Fallback Vendor Name",
      Email: "billing@fallback.test",
    },
  });

  const parsed = parseDocumentFromPostmark(payload);
  assert.equal(parsed.vendor_name, "Fallback Vendor Name");
});

test("parseDocumentFromPostmark date fallback uses payload Date when no date exists in body", () => {
  const payload = makePostmarkPayload({
    TextBody: "Vendor: Date Fallback Inc\nGrand Total: $54.20",
    Date: "Thu, 25 Feb 2026 14:00:00 +0000",
  });

  const parsed = parseDocumentFromPostmark(payload);
  assert.equal(parsed.date, "2026-02-25");
});

test("parseDocumentFromText extracts total amount from Grand Total line", () => {
  const parsed = parseDocumentFromText("Grand Total: $1,234.56");
  assert.equal(parsed.total, 1234.56);
});

test("parseDocumentFromText extracts tax amount from tax labels", () => {
  const parsed = parseDocumentFromText("HST 13%: $160.49");
  assert.equal(parsed.tax, 160.49);
});

test("scoreDocumentConfidence returns high when required fields exist and totals are consistent", () => {
  const result = scoreDocumentConfidence({
    vendor_name: "Confidence Foods",
    date: "2026-02-24",
    total: 22.6,
    tax: 2.6,
    line_items: [
      { description: "Apples", quantity: 2, unit_cost: 6, line_total: 12 },
      { description: "Bananas", quantity: 1, unit_cost: 8, line_total: 8 },
    ],
  });

  assert.equal(result.band, "high");
  assert.equal(result.score, 1);
});

test("scoreDocumentConfidence returns low when total is missing", () => {
  const result = scoreDocumentConfidence({
    vendor_name: "No Total Vendor",
    date: "2026-02-24",
    total: null,
    tax: 1.5,
    line_items: [{ description: "Line", quantity: 1, unit_cost: 2, line_total: 2 }],
  });

  assert.equal(result.band, "low");
  assert.ok(result.flags.includes("missing_total"));
});

test("scoreDocumentConfidence adds totals_inconsistent flag when total mismatch exceeds tolerance", () => {
  const result = scoreDocumentConfidence({
    vendor_name: "Mismatch Vendor",
    date: "2026-02-24",
    total: 40,
    tax: 2,
    line_items: [
      { description: "Item A", quantity: 1, unit_cost: 10, line_total: 10 },
      { description: "Item B", quantity: 1, unit_cost: 8, line_total: 8 },
    ],
  });

  assert.ok(result.flags.includes("totals_inconsistent"));
});

test("parseDocumentFromJson parses structured payload happy path", () => {
  const parsed = parseDocumentFromJson({
    vendor_name: "JSON Vendor",
    date: "2026-02-22",
    total: 44.5,
    tax: 4.5,
    line_items: [
      { description: "Milk", quantity: 2, unit_cost: 10, line_total: 20 },
      { description: "Bread", quantity: 1, unit_cost: 20, line_total: 20 },
    ],
  });

  assert.equal(parsed.vendor_name, "JSON Vendor");
  assert.equal(parsed.date, "2026-02-22");
  assert.equal(parsed.total, 44.5);
  assert.equal(parsed.tax, 4.5);
  assert.equal(parsed.line_items.length, 2);
});

test("parseDocumentFromJson returns null defaults when fields are missing", () => {
  const parsed = parseDocumentFromJson({ foo: "bar" });
  assert.equal(parsed.vendor_name, null);
  assert.equal(parsed.date, null);
  assert.equal(parsed.total, null);
  assert.equal(parsed.tax, null);
  assert.deepEqual(parsed.line_items, []);
});

test("stripHtml removes tags and decodes common entities", () => {
  const result = stripHtml("<div>Metro &amp; Co&nbsp;Invoice</div><p>Total: &lt;$22.60&gt;</p>");
  assert.equal(result.replace(/\s+/g, " ").trim(), "Metro & Co Invoice Total: <$22.60>");
});
