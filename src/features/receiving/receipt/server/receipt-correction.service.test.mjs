import test from "node:test";
import assert from "node:assert/strict";

const correctionModule = await import("./receipt-correction.service.ts");

const runReceiptPostOcrCorrection =
  correctionModule.runReceiptPostOcrCorrection ??
  correctionModule.default?.runReceiptPostOcrCorrection;

if (typeof runReceiptPostOcrCorrection !== "function") {
  throw new Error("Unable to load runReceiptPostOcrCorrection");
}

function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function makeLine(overrides = {}) {
  return {
    line_number: 1,
    raw_text: "MILK 5.00",
    parsed_name: "MILK",
    quantity: 1,
    unit: "each",
    line_cost: 5.0,
    unit_cost: 5.0,
    ...overrides,
  };
}

test("runReceiptPostOcrCorrection falls back enforce->shadow when rollout guard fails totals check", async () => {
  await withEnv(
    {
      RECEIPT_POST_OCR_CORRECTION_MODE: "enforce",
      RECEIPT_CORRECTION_ENFORCE_REQUIRE_TOTALS_PASS: "true",
      RECEIPT_CORRECTION_ENFORCE_ALLOW_TAX_WARN: "false",
      RECEIPT_CORRECTION_ENFORCE_MAX_LOW_CONFIDENCE_LINES: "0",
    },
    async () => {
      const result = await runReceiptPostOcrCorrection({
        businessId: "biz-1",
        source: "parsed_text",
        lines: [makeLine()],
        totals: { total: 20, tax: 0 },
      });

      assert.equal(result.summary.requested_mode, "enforce");
      assert.equal(result.mode, "shadow");
      assert.equal(result.summary.mode, "shadow");
      assert.equal(result.summary.rollout_guard_status, "fallback_to_shadow");
      assert.ok((result.summary.rollout_guard_reason_counts.totals_not_pass ?? 0) >= 1);
      assert.equal(result.lines[0]?.line_cost, 5.0);
    },
  );
});

test("runReceiptPostOcrCorrection keeps enforce mode when rollout guard passes", async () => {
  await withEnv(
    {
      RECEIPT_POST_OCR_CORRECTION_MODE: "enforce",
      RECEIPT_CORRECTION_ENFORCE_REQUIRE_TOTALS_PASS: "true",
      RECEIPT_CORRECTION_ENFORCE_ALLOW_TAX_WARN: "true",
      RECEIPT_CORRECTION_ENFORCE_MAX_LOW_CONFIDENCE_LINES: "1",
    },
    async () => {
      const result = await runReceiptPostOcrCorrection({
        businessId: "biz-1",
        source: "parsed_text",
        lines: [makeLine()],
        totals: { total: 5, tax: 0 },
      });

      assert.equal(result.summary.requested_mode, "enforce");
      assert.equal(result.mode, "enforce");
      assert.equal(result.summary.mode, "enforce");
      assert.equal(result.summary.rollout_guard_status, "pass");
      assert.deepEqual(result.summary.rollout_guard_reason_counts, {});
    },
  );
});
