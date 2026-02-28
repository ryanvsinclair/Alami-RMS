import test from "node:test";
import assert from "node:assert/strict";

const trustModule = await import("./trust.service.ts");
const { createTrustService } = trustModule;

function daysAgo(baseDate, days) {
  return new Date(baseDate.getTime() - (days * 24 * 60 * 60 * 1000));
}

function makeTrustPrisma(seed = {}) {
  const state = {
    drafts: (seed.drafts ?? []).map((draft) => ({
      status: "pending_review",
      anomaly_flags: [],
      parsed_line_items: [],
      ...draft,
    })),
    vendorProfiles: (seed.vendorProfiles ?? []).map((vendor) => ({
      trust_threshold_override: null,
      auto_post_enabled: false,
      ...vendor,
    })),
  };

  const prisma = {
    documentDraft: {
      async findFirst(args = {}) {
        const where = args.where ?? {};
        return (
          state.drafts.find((draft) => (
            (!where.id || draft.id === where.id) &&
            (!where.business_id || draft.business_id === where.business_id)
          )) ?? null
        );
      },
      async findMany(args = {}) {
        const where = args.where ?? {};
        const rows = state.drafts.filter((draft) => {
          if (where.business_id && draft.business_id !== where.business_id) return false;
          if (where.vendor_profile_id && draft.vendor_profile_id !== where.vendor_profile_id) return false;
          if (where.status && draft.status !== where.status) return false;
          if (where.parsed_date?.gte && (!draft.parsed_date || draft.parsed_date < where.parsed_date.gte)) return false;
          return true;
        });
        return rows;
      },
      async update(args = {}) {
        const id = args.where?.id;
        const index = state.drafts.findIndex((draft) => draft.id === id);
        if (index < 0) throw new Error("Document draft not found");
        state.drafts[index] = {
          ...state.drafts[index],
          ...(args.data ?? {}),
        };
        return state.drafts[index];
      },
    },
    vendorProfile: {
      async findFirst(args = {}) {
        const where = args.where ?? {};
        return (
          state.vendorProfiles.find((vendor) => (
            (!where.id || vendor.id === where.id) &&
            (!where.business_id || vendor.business_id === where.business_id)
          )) ?? null
        );
      },
      async update(args = {}) {
        const id = args.where?.id;
        const index = state.vendorProfiles.findIndex((vendor) => vendor.id === id);
        if (index < 0) throw new Error("Vendor profile not found");
        state.vendorProfiles[index] = {
          ...state.vendorProfiles[index],
          ...(args.data ?? {}),
        };
        return state.vendorProfiles[index];
      },
    },
  };

  return { prisma, state };
}

function makeVendor(overrides = {}) {
  return {
    id: "vp_1",
    business_id: "biz_1",
    vendor_name: "Sysco",
    trust_state: "trusted",
    total_posted: 5,
    auto_post_enabled: true,
    trust_threshold_override: null,
    ...overrides,
  };
}

function makeDraft(overrides = {}) {
  return {
    id: "draft_1",
    business_id: "biz_1",
    vendor_profile_id: "vp_1",
    status: "pending_review",
    parsed_vendor_name: "Sysco",
    parsed_date: new Date("2026-02-28T12:00:00.000Z"),
    parsed_total: 20,
    parsed_line_items: [{ description: "Carrots", quantity: 1, unit_cost: 2, line_total: 2 }],
    confidence_score: 0.9,
    anomaly_flags: [],
    ...overrides,
  };
}

test("evaluateAutoPostEligibility returns eligible for trusted vendor with high confidence and no anomalies", async () => {
  const { prisma } = makeTrustPrisma();
  const service = createTrustService({ prismaClient: prisma });
  const result = service.evaluateAutoPostEligibility(
    makeVendor(),
    { confidence_score: 0.95, anomaly_flags: [] },
  );
  assert.deepEqual(result, { eligible: true, reason: null });
});

test("evaluateAutoPostEligibility returns auto_post_disabled when vendor toggle is off", async () => {
  const { prisma } = makeTrustPrisma();
  const service = createTrustService({ prismaClient: prisma });
  const result = service.evaluateAutoPostEligibility(
    makeVendor({ auto_post_enabled: false }),
    { confidence_score: 0.95, anomaly_flags: [] },
  );
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "auto_post_disabled");
});

test("evaluateAutoPostEligibility returns low_confidence when score below threshold", async () => {
  const { prisma } = makeTrustPrisma();
  const service = createTrustService({ prismaClient: prisma });
  const result = service.evaluateAutoPostEligibility(
    makeVendor(),
    { confidence_score: 0.4, anomaly_flags: [] },
  );
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "low_confidence");
});

test("evaluateAutoPostEligibility returns anomaly_detected when anomaly flags are present", async () => {
  const { prisma } = makeTrustPrisma();
  const service = createTrustService({ prismaClient: prisma });
  const result = service.evaluateAutoPostEligibility(
    makeVendor(),
    { confidence_score: 0.95, anomaly_flags: ["large_total"] },
  );
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "anomaly_detected");
});

test("computeAnomalyFlags adds large_total when parsed total exceeds vendor p95 baseline", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const historicalDrafts = [10, 11, 12, 13, 14].map((total, index) =>
    makeDraft({
      id: `hist_${index + 1}`,
      status: "posted",
      parsed_total: total,
      parsed_date: daysAgo(now, index + 1),
      parsed_line_items: [{ description: "X", quantity: 1, unit_cost: 1, line_total: 1 }],
    }),
  );
  const { prisma } = makeTrustPrisma({
    drafts: historicalDrafts,
    vendorProfiles: [makeVendor()],
  });
  const service = createTrustService({ prismaClient: prisma, now: () => now });

  const flags = await service.computeAnomalyFlags("biz_1", "vp_1", {
    vendorName: "Sysco",
    parsedDate: now,
    parsedTotal: 30,
    confidenceScore: 0.95,
    parsedLineItems: [{ description: "X", quantity: 1, unit_cost: 1, line_total: 1 }],
  });

  assert.ok(flags.includes("large_total"));
});

test("computeAnomalyFlags adds duplicate_suspected for same vendor total/date window", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const { prisma } = makeTrustPrisma({
    drafts: [
      makeDraft({
        id: "posted_1",
        status: "posted",
        parsed_total: 20,
        parsed_date: daysAgo(now, 2),
      }),
    ],
    vendorProfiles: [makeVendor()],
  });
  const service = createTrustService({ prismaClient: prisma, now: () => now });

  const flags = await service.computeAnomalyFlags("biz_1", "vp_1", {
    vendorName: "Sysco",
    parsedDate: now,
    parsedTotal: 20,
    confidenceScore: 0.95,
    parsedLineItems: [{ description: "Carrots", quantity: 1, unit_cost: 2, line_total: 2 }],
  });

  assert.ok(flags.includes("duplicate_suspected"));
});

test("computeAnomalyFlags adds new_format when confidence is below 0.7 for experienced vendor", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const { prisma } = makeTrustPrisma({
    drafts: [],
    vendorProfiles: [makeVendor({ total_posted: 3 })],
  });
  const service = createTrustService({ prismaClient: prisma, now: () => now });

  const flags = await service.computeAnomalyFlags("biz_1", "vp_1", {
    vendorName: "Sysco",
    parsedDate: now,
    parsedTotal: 10,
    confidenceScore: 0.65,
    parsedLineItems: [{ description: "Carrots", quantity: 1, unit_cost: 2, line_total: 2 }],
  });

  assert.ok(flags.includes("new_format"));
});

test("attemptAutoPost keeps draft in pending_review when ineligible", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  let postCalled = false;
  const { prisma, state } = makeTrustPrisma({
    drafts: [makeDraft({ confidence_score: 0.4 })],
    vendorProfiles: [makeVendor()],
  });
  const service = createTrustService({
    prismaClient: prisma,
    now: () => now,
    postDraftFn: async () => {
      postCalled = true;
      return { financialTransactionId: "ft_1", inventoryTransactionsCreated: 0 };
    },
  });

  const result = await service.attemptAutoPost("biz_1", "draft_1");
  assert.equal(result.autoPosted, false);
  assert.equal(result.reason, "low_confidence");
  assert.equal(postCalled, false);
  assert.equal(state.drafts[0].status, "pending_review");
});

test("attemptAutoPost posts draft when eligible and sets autoPosted flow", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  let calledArgs = null;
  const { prisma } = makeTrustPrisma({
    drafts: [makeDraft({ confidence_score: 0.95, anomaly_flags: [] })],
    vendorProfiles: [makeVendor()],
  });
  const service = createTrustService({
    prismaClient: prisma,
    now: () => now,
    postDraftFn: async (businessId, draftId, userId, options) => {
      calledArgs = { businessId, draftId, userId, options };
      return { financialTransactionId: "ft_1", inventoryTransactionsCreated: 1 };
    },
  });

  const result = await service.attemptAutoPost("biz_1", "draft_1");
  assert.equal(result.autoPosted, true);
  assert.equal(result.reason, null);
  assert.equal(result.postResult?.financialTransactionId, "ft_1");
  assert.deepEqual(calledArgs, {
    businessId: "biz_1",
    draftId: "draft_1",
    userId: "system:auto-post",
    options: { autoPosted: true },
  });
});

test("evaluateAutoPostEligibility respects trust_threshold_override over global threshold", async () => {
  const { prisma } = makeTrustPrisma();
  const service = createTrustService({
    prismaClient: prisma,
    globalTrustThreshold: 5,
  });

  const belowOverride = service.evaluateAutoPostEligibility(
    makeVendor({ total_posted: 1, trust_threshold_override: 2 }),
    { confidence_score: 0.95, anomaly_flags: [] },
  );
  assert.equal(belowOverride.eligible, false);
  assert.equal(belowOverride.reason, "below_trust_threshold");

  const atOverride = service.evaluateAutoPostEligibility(
    makeVendor({ total_posted: 2, trust_threshold_override: 2 }),
    { confidence_score: 0.95, anomaly_flags: [] },
  );
  assert.equal(atOverride.eligible, true);
  assert.equal(atOverride.reason, null);
});
