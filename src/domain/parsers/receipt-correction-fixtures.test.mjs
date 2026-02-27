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

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function parseTrailingAmountFromText(text) {
  const match = text.match(/(-?\d[\d,]*)(?:\.(\d{1,2}))?\s*$/);
  if (!match) return null;

  const whole = (match[1] ?? "").replace(/,/g, "");
  const fractional = match[2] ?? "";
  const numeric = Number.parseFloat(
    fractional.length > 0 ? `${whole}.${fractional}` : whole
  );
  if (!Number.isFinite(numeric)) return null;
  return roundCurrency(numeric);
}

function detectTaxLabelFromLine(text) {
  if (/\bH\.?\s*S\.?\s*T\b/i.test(text)) return "HST";
  if (/\bQST\b/i.test(text)) return "QST";
  if (/\bTVQ\b/i.test(text)) return "TVQ";
  if (/\bGST\b/i.test(text)) return "GST";
  if (/\bTPS\b/i.test(text)) return "TPS";
  if (/^(?:sales\s+)?tax\b/i.test(text)) return "Tax";
  return null;
}

function extractPrintedTotalsFromRawText(rawText) {
  let subtotal = null;
  let tax = null;
  let total = null;

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, " ");
    if (/^sub\s*total\b/i.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) subtotal = amount;
      continue;
    }

    const taxLabel = detectTaxLabelFromLine(normalized);
    if (taxLabel) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) tax = amount;
      continue;
    }

    if (/^(?:grand\s+)?total\b/i.test(normalized)) {
      const amount = parseTrailingAmountFromText(normalized);
      if (amount != null) total = amount;
      continue;
    }
  }

  if (subtotal == null && tax == null && total == null) return undefined;
  return { subtotal, tax, total };
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
    return {
      source: "parsed_text",
      lines: parseReceiptText(fixture.raw_text ?? ""),
      historical_price_hints: fixture.historical_price_hints ?? undefined,
      totals: extractPrintedTotalsFromRawText(fixture.raw_text ?? ""),
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
