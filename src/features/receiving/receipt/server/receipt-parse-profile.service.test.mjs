import test from "node:test";
import assert from "node:assert/strict";

const parseProfileModule = await import("./receipt-parse-profile.service.ts");

const buildReceiptParseProfileKey =
  parseProfileModule.buildReceiptParseProfileKey ??
  parseProfileModule.default?.buildReceiptParseProfileKey;
const deriveProvinceHintFromProfileSignals =
  parseProfileModule.deriveProvinceHintFromProfileSignals ??
  parseProfileModule.default?.deriveProvinceHintFromProfileSignals;
const resolveReceiptParseProfilePrior =
  parseProfileModule.resolveReceiptParseProfilePrior ??
  parseProfileModule.default?.resolveReceiptParseProfilePrior;
const recordReceiptParseProfileFromCorrection =
  parseProfileModule.recordReceiptParseProfileFromCorrection ??
  parseProfileModule.default?.recordReceiptParseProfileFromCorrection;
const recordReceiptParseProfileLineReviewFeedback =
  parseProfileModule.recordReceiptParseProfileLineReviewFeedback ??
  parseProfileModule.default?.recordReceiptParseProfileLineReviewFeedback;

if (
  typeof buildReceiptParseProfileKey !== "function" ||
  typeof deriveProvinceHintFromProfileSignals !== "function" ||
  typeof resolveReceiptParseProfilePrior !== "function" ||
  typeof recordReceiptParseProfileFromCorrection !== "function" ||
  typeof recordReceiptParseProfileLineReviewFeedback !== "function"
) {
  throw new Error("Unable to load receipt parse profile service functions");
}

function createCorrectionSummary(overrides = {}) {
  return {
    parser_version: "v1-test",
    mode: "shadow",
    source: "parsed_text",
    line_count: 5,
    changed_line_count: 2,
    correction_actions_applied: 3,
    totals_check_status: "pass",
    totals_delta_to_total: 0,
    totals_line_sum: 42.5,
    tax_validation_status: "pass",
    tax_structure: "on_hst",
    tax_province: "ON",
    tax_province_source: "google_places",
    tax_zero_grocery_candidate: false,
    tax_flag_counts: { province_signal_conflict_tax_labels: 1 },
    tax_label_counts: { HST: 1 },
    parse_confidence_band_counts: { high: 4, medium: 1, low: 0, none: 0 },
    lines_with_parse_flags_count: 2,
    lines_with_correction_actions_count: 2,
    historical_hint_lines_count: 0,
    historical_hint_sample_size_total: 0,
    historical_hint_max_sample_size: 0,
    historical_hint_lines_applied_count: 0,
    parse_flag_counts: { decimal_inferred: 2 },
    correction_action_type_counts: { infer_decimal_shift_2: 2 },
    ...overrides,
  };
}

function createInMemoryRepository(initialRecord = null) {
  let record = initialRecord;
  return {
    get current() {
      return record;
    },
    async findByKey({ businessId, profileKey }) {
      if (!record) return null;
      if (record.business_id !== businessId || record.profile_key !== profileKey) return null;
      return record;
    },
    async upsert(params) {
      record = {
        id: "profile-1",
        business_id: params.businessId,
        supplier_id: params.supplierId ?? null,
        google_place_id: params.googlePlaceId ?? null,
        profile_key: params.profileKey,
        signals: params.signals,
        stats: params.stats,
        version: params.version,
      };
      return record;
    },
  };
}

test("buildReceiptParseProfileKey prefers google place id over supplier id", () => {
  const placeKey = buildReceiptParseProfileKey({
    supplierId: "supplier-123",
    googlePlaceId: "ChIJ123",
  });
  assert.equal(placeKey, "place:ChIJ123");

  const supplierKey = buildReceiptParseProfileKey({
    supplierId: "supplier-123",
    googlePlaceId: null,
  });
  assert.equal(supplierKey, "supplier:supplier-123");

  const none = buildReceiptParseProfileKey({
    supplierId: null,
    googlePlaceId: null,
  });
  assert.equal(none, null);
});

test("deriveProvinceHintFromProfileSignals requires dominance and minimum sample size", () => {
  const dominantOn = deriveProvinceHintFromProfileSignals({
    province_counts: { ON: 3, QC: 1 },
  });
  assert.equal(dominantOn, "ON");

  const noDominance = deriveProvinceHintFromProfileSignals({
    province_counts: { ON: 1, QC: 1 },
  });
  assert.equal(noDominance, null);
});

test("recordReceiptParseProfileFromCorrection accumulates signals and powers profile priors", async () => {
  const repository = createInMemoryRepository();
  const baseSummary = createCorrectionSummary();

  await recordReceiptParseProfileFromCorrection(
    {
      businessId: "business-1",
      supplierId: "supplier-1",
      googlePlaceId: "ChIJ123",
      receiptId: "receipt-1",
      summary: baseSummary,
    },
    repository,
  );

  const afterFirst = repository.current;
  assert.equal(afterFirst?.profile_key, "place:ChIJ123");
  assert.equal(afterFirst?.signals?.province_counts?.ON, 1);
  assert.equal(afterFirst?.stats?.receipts_observed, 1);
  assert.equal(afterFirst?.stats?.last_receipt_id, "receipt-1");

  await recordReceiptParseProfileFromCorrection(
    {
      businessId: "business-1",
      supplierId: "supplier-1",
      googlePlaceId: "ChIJ123",
      receiptId: "receipt-2",
      summary: createCorrectionSummary({
        tax_label_counts: { HST: 2 },
        parse_flag_counts: { decimal_inferred: 1, split_numeric_token_detected: 1 },
      }),
    },
    repository,
  );

  const prior = await resolveReceiptParseProfilePrior(
    {
      businessId: "business-1",
      supplierId: "supplier-1",
      googlePlaceId: "ChIJ123",
    },
    repository,
  );
  assert.equal(prior.provinceHint, "ON");
  assert.equal(repository.current?.signals?.tax_label_counts?.HST, 3);
  assert.equal(repository.current?.stats?.receipts_observed, 2);
});

test("recordReceiptParseProfileLineReviewFeedback tracks confirmed and skipped edits", async () => {
  const repository = createInMemoryRepository({
    id: "profile-1",
    business_id: "business-1",
    supplier_id: "supplier-1",
    google_place_id: "ChIJ123",
    profile_key: "place:ChIJ123",
    signals: {},
    stats: { receipts_observed: 1 },
    version: 1,
  });

  await recordReceiptParseProfileLineReviewFeedback(
    {
      businessId: "business-1",
      supplierId: "supplier-1",
      googlePlaceId: "ChIJ123",
      status: "confirmed",
    },
    repository,
  );
  await recordReceiptParseProfileLineReviewFeedback(
    {
      businessId: "business-1",
      supplierId: "supplier-1",
      googlePlaceId: "ChIJ123",
      status: "skipped",
    },
    repository,
  );

  assert.equal(repository.current?.stats?.confirmed_line_edits, 1);
  assert.equal(repository.current?.stats?.skipped_line_edits, 1);
});
