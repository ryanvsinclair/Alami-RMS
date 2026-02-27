import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseReceiptText } from "./receipt.ts";
import { runReceiptCorrectionCore } from "./receipt-correction-core.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.resolve(__dirname, "../../../test/fixtures/receipt-correction");
const SUBTOTAL_LABEL_PATTERN = /^(?:(?:sub|sous)[\s-]*total)\b/i;
const TOTAL_LABEL_PATTERN =
  /^(?:(?:grand[\s-]*)?total(?:\s+(?:due|du|amount|a\s+payer))?|amount\s+due|balance\s+due|montant\s+(?:total|du))\b/i;

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function normalizeTrailingNumericToken(rawToken) {
  if (!rawToken) return null;

  const compactSpaces = rawToken
    .replace(/[$€£]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!compactSpaces) return null;

  if (/^-?\d+\s+\d{2}$/.test(compactSpaces)) {
    return compactSpaces.replace(/\s+/, ".");
  }

  let compact = compactSpaces.replace(/\s+/g, "");
  if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(compact)) {
    compact = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(compact)) {
    compact = compact.replace(/,/g, "");
  } else if (/^-?\d+,\d{1,2}$/.test(compact)) {
    compact = compact.replace(",", ".");
  } else {
    compact = compact.replace(/,(?=\d{3}(?:\D|$))/g, "");
  }

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(compact)) return null;
  return compact;
}

function parseTrailingAmountFromText(text) {
  const match = text.match(/(-?\d(?:[\d,\s]*\d)?(?:[.,]\d{1,2})?)\s*$/);
  if (!match) return null;

  const normalizedToken = normalizeTrailingNumericToken(match[1] ?? "");
  if (!normalizedToken) return null;

  const numeric = Number.parseFloat(normalizedToken);
  if (!Number.isFinite(numeric)) return null;
  return roundCurrency(numeric);
}

function detectTaxLabelFromLine(text) {
  if (/\bH\.?\s*S\.?\s*T\b/i.test(text)) return "HST";
  if (/\bQ\.?\s*S\.?\s*T\b/i.test(text)) return "QST";
  if (/\bT\.?\s*V\.?\s*Q\b/i.test(text)) return "TVQ";
  if (/\bG\.?\s*S\.?\s*T\b/i.test(text)) return "GST";
  if (/\bT\.?\s*P\.?\s*S\b/i.test(text)) return "TPS";
  if (/^(?:sales\s+)?tax(?:e)?\b/i.test(text)) return "Tax";
  return null;
}

function sumTaxLineAmounts(taxLines) {
  const amounts = taxLines
    .map((line) => (line.amount == null ? null : Number(line.amount)))
    .filter((value) => value != null && Number.isFinite(value));

  if (amounts.length === 0) return null;
  return roundCurrency(amounts.reduce((sum, amount) => sum + amount, 0));
}

function extractPrintedTotalsFromRawText(rawText) {
  let subtotal = null;
  let total = null;
  const taxLines = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, " ");
    if (SUBTOTAL_LABEL_PATTERN.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) subtotal = amount;
      continue;
    }

    const taxLabel = detectTaxLabelFromLine(normalized);
    if (taxLabel) {
      const amount = parseTrailingAmountFromText(normalized);
      taxLines.push({ label: taxLabel, amount });
      continue;
    }

    if (TOTAL_LABEL_PATTERN.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) total = amount;
      continue;
    }
  }

  const tax = sumTaxLineAmounts(taxLines);

  if (subtotal == null && tax == null && total == null && taxLines.length === 0) return undefined;
  return {
    subtotal,
    tax,
    total,
    tax_lines: taxLines.length > 0 ? taxLines : undefined,
  };
}

function normalizeTabscannerFixtureLines(tabscannerResult) {
  return tabscannerResult.lineItems.map((tsLine, index) => {
    const qty = tsLine.qty || 1;
    const unitPrice =
      qty > 0
        ? Math.round((tsLine.lineTotal / qty) * 100) / 100
        : tsLine.price ?? null;

    return {
      line_number: index + 1,
      raw_text: tsLine.desc,
      parsed_name: tsLine.descClean || tsLine.desc || null,
      quantity: qty,
      unit: "each",
      line_cost: tsLine.lineTotal,
      unit_cost: unitPrice,
    };
  });
}

function buildCorrectionInputFromFixture(fixture) {
  if (fixture.source === "tabscanner") {
    const ts = fixture.tabscanner_result;
    return {
      source: "tabscanner",
      lines: normalizeTabscannerFixtureLines(ts),
      historical_price_hints: fixture.historical_price_hints ?? undefined,
      totals: {
        subtotal: ts.subTotal ?? null,
        tax: ts.tax ?? null,
        total: ts.total ?? null,
        currency: ts.currency ?? null,
      },
    };
  }

  if (fixture.source === "parsed_text") {
    const extractedTotals = extractPrintedTotalsFromRawText(fixture.raw_text ?? "") ?? {};
    const contextTotals = fixture.correction_context?.totals ?? {};
    return {
      source: "parsed_text",
      lines: parseReceiptText(fixture.raw_text ?? ""),
      historical_price_hints: fixture.historical_price_hints ?? undefined,
      totals: {
        ...extractedTotals,
        ...contextTotals,
      },
    };
  }

  throw new Error(`Unsupported fixture source: ${fixture.source}`);
}

function getChangedLineNumbers(coreResult) {
  return coreResult.lines
    .filter((entry) => entry.correction_actions.length > 0)
    .map((entry) => entry.line.line_number)
    .sort((a, b) => a - b);
}

function findLineResult(coreResult, lineNumber) {
  const line = coreResult.lines.find((entry) => entry.line.line_number === lineNumber);
  if (!line) {
    throw new Error(`Line ${lineNumber} not found in correction result`);
  }
  return line;
}

function assertFixtureExpectations(fixture, coreResult) {
  const assertions = fixture.expected?.assertions;
  assert.ok(assertions, `Fixture ${fixture.id} is missing expected.assertions`);

  if (assertions.totals_status != null) {
    assert.equal(
      coreResult.totals_check.status,
      assertions.totals_status,
      `${fixture.id}: totals status mismatch`
    );
  }

  if (assertions.totals_delta_to_total != null) {
    assert.equal(
      coreResult.totals_check.delta_to_total,
      assertions.totals_delta_to_total,
      `${fixture.id}: totals delta mismatch`
    );
  }

  if (assertions.changed_line_numbers != null) {
    assert.deepEqual(
      getChangedLineNumbers(coreResult),
      [...assertions.changed_line_numbers].sort((a, b) => a - b),
      `${fixture.id}: changed line numbers mismatch`
    );
  }

  if (assertions.outlier_line_numbers != null) {
    assert.deepEqual(
      [...coreResult.totals_check.outlier_line_numbers].sort((a, b) => a - b),
      [...assertions.outlier_line_numbers].sort((a, b) => a - b),
      `${fixture.id}: outlier line numbers mismatch`
    );
  }

  for (const expectedLineCost of assertions.expected_line_costs ?? []) {
    const line = findLineResult(coreResult, expectedLineCost.line_number);
    assert.equal(
      roundCurrency(line.line.line_cost ?? Number.NaN),
      roundCurrency(expectedLineCost.line_cost),
      `${fixture.id}: line ${expectedLineCost.line_number} line_cost mismatch`
    );
  }

  for (const expectedFlags of assertions.required_parse_flags ?? []) {
    const line = findLineResult(coreResult, expectedFlags.line_number);
    for (const flag of expectedFlags.flags) {
      assert.ok(
        line.parse_flags.includes(flag),
        `${fixture.id}: line ${expectedFlags.line_number} missing parse flag '${flag}'`
      );
    }
  }

  for (const expectedProduce of assertions.expected_produce_fields ?? []) {
    const line = findLineResult(coreResult, expectedProduce.line_number);

    if (Object.hasOwn(expectedProduce, "plu_code")) {
      assert.equal(
        line.line.plu_code ?? null,
        expectedProduce.plu_code ?? null,
        `${fixture.id}: line ${expectedProduce.line_number} produce plu_code mismatch`
      );
    }

    if (Object.hasOwn(expectedProduce, "organic_flag")) {
      assert.equal(
        line.line.organic_flag ?? null,
        expectedProduce.organic_flag ?? null,
        `${fixture.id}: line ${expectedProduce.line_number} produce organic_flag mismatch`
      );
    }

    if (Object.hasOwn(expectedProduce, "parsed_name")) {
      assert.equal(
        line.line.parsed_name ?? null,
        expectedProduce.parsed_name ?? null,
        `${fixture.id}: line ${expectedProduce.line_number} produce parsed_name mismatch`
      );
    }
  }

  if (assertions.tax_interpretation != null) {
    const expectedTax = assertions.tax_interpretation;

    if (expectedTax.status != null) {
      assert.equal(
        coreResult.tax_interpretation.status,
        expectedTax.status,
        `${fixture.id}: tax interpretation status mismatch`
      );
    }

    if (Object.hasOwn(expectedTax, "province")) {
      assert.equal(
        coreResult.tax_interpretation.province ?? null,
        expectedTax.province ?? null,
        `${fixture.id}: tax interpretation province mismatch`
      );
    }

    if (expectedTax.province_source != null) {
      assert.equal(
        coreResult.tax_interpretation.province_source,
        expectedTax.province_source,
        `${fixture.id}: tax interpretation province source mismatch`
      );
    }

    if (expectedTax.structure != null) {
      assert.equal(
        coreResult.tax_interpretation.structure,
        expectedTax.structure,
        `${fixture.id}: tax interpretation structure mismatch`
      );
    }

    if (Object.hasOwn(expectedTax, "zero_tax_grocery_candidate")) {
      assert.equal(
        coreResult.tax_interpretation.zero_tax_grocery_candidate,
        expectedTax.zero_tax_grocery_candidate,
        `${fixture.id}: tax interpretation zero-tax candidate mismatch`
      );
    }

    for (const flag of expectedTax.required_flags ?? []) {
      assert.ok(
        coreResult.tax_interpretation.flags.includes(flag),
        `${fixture.id}: tax interpretation missing flag '${flag}'`
      );
    }
  }
}

const fixtureFiles = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort((a, b) => a.localeCompare(b));

test("receipt correction fixture corpus includes at least 10 runnable JSON scenarios", () => {
  assert.ok(fixtureFiles.length >= 10, `Expected >=10 fixture JSON files, found ${fixtureFiles.length}`);
});

for (const fixtureFile of fixtureFiles) {
  test(`receipt correction fixture: ${fixtureFile}`, () => {
    const raw = fs.readFileSync(path.join(FIXTURE_DIR, fixtureFile), "utf8");
    const fixture = JSON.parse(raw);
    const input = buildCorrectionInputFromFixture(fixture);
    const coreResult = runReceiptCorrectionCore(input);
    assertFixtureExpectations(fixture, coreResult);
  });
}
