import test from "node:test";
import assert from "node:assert/strict";

const analyticsModule = await import("./document-analytics.service.ts");
const { createDocumentAnalyticsService } = analyticsModule;

function daysAgo(baseDate, days) {
  return new Date(baseDate.getTime() - (days * 24 * 60 * 60 * 1000));
}

function makeDraft(overrides = {}) {
  return {
    id: "draft_default",
    business_id: "biz_1",
    vendor_profile_id: "vp_a",
    status: "posted",
    parsed_vendor_name: "Vendor A",
    parsed_total: 10,
    parsed_tax: 1,
    parsed_date: new Date("2026-02-20T00:00:00.000Z"),
    posted_at: new Date("2026-02-20T00:00:00.000Z"),
    parsed_line_items: [
      { description: "Carrots", quantity: 2, unit_cost: 1.5, line_total: 3 },
    ],
    financial_transaction_id: "ft_default",
    vendor_profile: null,
    ...overrides,
  };
}

function makeVendorProfile(overrides = {}) {
  return {
    id: "vp_a",
    business_id: "biz_1",
    vendor_name: "Vendor A",
    default_category: { id: "cat_a", name: "Produce" },
    ...overrides,
  };
}

function makeFinancialTransaction(overrides = {}) {
  return {
    id: "ft_default",
    business_id: "biz_1",
    source: "document_intake",
    type: "expense",
    amount: 10,
    occurred_at: new Date("2026-02-20T00:00:00.000Z"),
    metadata: { vendor_profile_id: "vp_a" },
    ...overrides,
  };
}

function createBaselineSeed({ baseDate, postedDraftCount = 20 } = {}) {
  const drafts = [];
  const financialTransactions = [];

  for (let index = 0; index < postedDraftCount; index += 1) {
    const draftId = `baseline_draft_${index + 1}`;
    const transactionId = `baseline_ft_${index + 1}`;
    const postedAt = daysAgo(baseDate, (index % 14) + 1);

    drafts.push(
      makeDraft({
        id: draftId,
        parsed_total: 5,
        parsed_tax: 0,
        posted_at: postedAt,
        parsed_date: postedAt,
        financial_transaction_id: transactionId,
      }),
    );

    financialTransactions.push(
      makeFinancialTransaction({
        id: transactionId,
        amount: 5,
        occurred_at: postedAt,
      }),
    );
  }

  return {
    drafts,
    financialTransactions,
  };
}

function makeAnalyticsPrisma(seed = {}) {
  const state = {
    drafts: (seed.drafts ?? []).map((draft) => ({ ...draft })),
    mappings: (seed.mappings ?? []).map((mapping) => ({ ...mapping })),
    inventoryTransactions: (seed.inventoryTransactions ?? []).map((record) => ({ ...record })),
    inventoryItems: (seed.inventoryItems ?? []).map((item) => ({ ...item })),
    financialTransactions: (seed.financialTransactions ?? []).map((record) => ({ ...record })),
    vendorProfiles: (seed.vendorProfiles ?? []).map((vendor) => ({ ...vendor })),
  };

  function draftMatchesWhere(draft, where = {}) {
    if (where.business_id && draft.business_id !== where.business_id) return false;
    if (typeof where.status === "string" && draft.status !== where.status) return false;
    if (where.status?.in && !where.status.in.includes(draft.status)) return false;
    return true;
  }

  function transactionMatchesWhere(transaction, where = {}) {
    if (where.business_id && transaction.business_id !== where.business_id) return false;
    if (where.source && transaction.source !== where.source) return false;
    if (where.type && transaction.type !== where.type) return false;

    const occurredAt = transaction.occurred_at;
    if (where.occurred_at?.gte && occurredAt < where.occurred_at.gte) return false;
    if (where.occurred_at?.lte && occurredAt > where.occurred_at.lte) return false;

    return true;
  }

  const prisma = {
    documentDraft: {
      async findMany(args = {}) {
        const where = args.where ?? {};
        const take = args.take ?? undefined;
        const vendorById = new Map(
          state.vendorProfiles.map((vendor) => [vendor.id, vendor]),
        );

        const rows = state.drafts
          .filter((draft) => draftMatchesWhere(draft, where))
          .map((draft) => ({
            ...draft,
            vendor_profile: draft.vendor_profile_id
              ? (vendorById.get(draft.vendor_profile_id) ?? null)
              : null,
          }))
          .sort((left, right) => right.posted_at.getTime() - left.posted_at.getTime());

        return typeof take === "number" ? rows.slice(0, take) : rows;
      },
      async count(args = {}) {
        const where = args.where ?? {};
        return state.drafts.filter((draft) => draftMatchesWhere(draft, where)).length;
      },
    },
    documentVendorItemMapping: {
      async findMany(args = {}) {
        const where = args.where ?? {};
        return state.mappings.filter((mapping) => {
          if (where.business_id && mapping.business_id !== where.business_id) return false;
          if (where.vendor_profile_id && mapping.vendor_profile_id !== where.vendor_profile_id) return false;
          if (where.inventory_item_id && mapping.inventory_item_id !== where.inventory_item_id) return false;
          return true;
        });
      },
    },
    inventoryTransaction: {
      async findMany(args = {}) {
        const where = args.where ?? {};
        return state.inventoryTransactions.filter((transaction) => {
          if (where.business_id && transaction.business_id !== where.business_id) return false;
          if (where.transaction_type && transaction.transaction_type !== where.transaction_type) return false;
          if (where.input_method && transaction.input_method !== where.input_method) return false;
          if (where.created_at?.gte && transaction.created_at < where.created_at.gte) return false;
          return true;
        });
      },
    },
    inventoryItem: {
      async findMany(args = {}) {
        const where = args.where ?? {};
        return state.inventoryItems.filter((item) => {
          if (where.business_id && item.business_id !== where.business_id) return false;
          if (typeof where.is_active === "boolean" && item.is_active !== where.is_active) return false;
          return true;
        });
      },
    },
    financialTransaction: {
      async findMany(args = {}) {
        const where = args.where ?? {};
        return state.financialTransactions.filter((transaction) =>
          transactionMatchesWhere(transaction, where));
      },
    },
    vendorProfile: {
      async findMany(args = {}) {
        const where = args.where ?? {};
        return state.vendorProfiles.filter((vendor) => {
          if (where.business_id && vendor.business_id !== where.business_id) return false;
          return true;
        });
      },
    },
  };

  return { prisma, state };
}

test("getVendorSpendSummary returns sorted vendor totals and readiness metadata", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const baseline = createBaselineSeed({ baseDate: now, postedDraftCount: 22 });

  const drafts = baseline.drafts.map((draft, index) => {
    if (index < 12) {
      return {
        ...draft,
        vendor_profile_id: "vp_a",
        parsed_vendor_name: "Vendor A",
        parsed_total: 10,
      };
    }

    return {
      ...draft,
      vendor_profile_id: "vp_b",
      parsed_vendor_name: "Vendor B",
      parsed_total: 6,
    };
  });

  const vendorProfiles = [
    makeVendorProfile({ id: "vp_a", vendor_name: "Vendor A" }),
    makeVendorProfile({ id: "vp_b", vendor_name: "Vendor B" }),
  ];

  const { prisma } = makeAnalyticsPrisma({
    drafts,
    financialTransactions: baseline.financialTransactions,
    vendorProfiles,
  });

  const service = createDocumentAnalyticsService({
    prismaClient: prisma,
    now: () => now,
  });

  const result = await service.getVendorSpendSummary("biz_1", {
    period: { days: 30 },
  });

  assert.equal(result.minimumDataSatisfied, true);
  assert.equal(result.totalPostedDraftCount, 22);
  assert.equal(result.summary[0].vendorId, "vp_a");
  assert.equal(result.summary[0].totalSpend, 120);
  assert.equal(result.summary[1].vendorId, "vp_b");
  assert.equal(result.summary[1].totalSpend, 60);
});

test("getPriceTrends enforces analytics threshold when fewer than 20 posted drafts exist", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const baseline = createBaselineSeed({ baseDate: now, postedDraftCount: 5 });
  const { prisma } = makeAnalyticsPrisma({
    drafts: baseline.drafts,
    financialTransactions: baseline.financialTransactions,
    vendorProfiles: [makeVendorProfile({ id: "vp_a" })],
  });

  const service = createDocumentAnalyticsService({ prismaClient: prisma, now: () => now });

  await assert.rejects(
    () => service.getPriceTrends("biz_1", "vp_a", { period: { days: 30 } }),
    /requires at least 20 posted drafts/,
  );
});

test("getPriceTrends filters by mapping inventory item and raw line item name", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const baseline = createBaselineSeed({ baseDate: now, postedDraftCount: 20 });

  const drafts = baseline.drafts.map((draft, index) => ({
    ...draft,
    id: `trend_draft_${index + 1}`,
    vendor_profile_id: "vp_a",
    parsed_line_items: [
      { description: "Carrots", quantity: 1, unit_cost: 2 + index, line_total: 2 + index },
      { description: "Onions", quantity: 1, unit_cost: 1 + index, line_total: 1 + index },
    ],
  }));

  const { prisma } = makeAnalyticsPrisma({
    drafts,
    financialTransactions: baseline.financialTransactions,
    vendorProfiles: [makeVendorProfile({ id: "vp_a" })],
    mappings: [
      {
        business_id: "biz_1",
        vendor_profile_id: "vp_a",
        inventory_item_id: "inv_carrots",
        raw_line_item_name: "carrots",
      },
    ],
  });

  const service = createDocumentAnalyticsService({ prismaClient: prisma, now: () => now });

  const mappedTrend = await service.getPriceTrends("biz_1", "vp_a", {
    period: { days: 90 },
    inventoryItemId: "inv_carrots",
  });

  assert.ok(mappedTrend.points.length > 0);
  assert.ok(mappedTrend.points.every((point) => point.description.toLowerCase() === "carrots"));
  assert.ok(mappedTrend.availableItemNames.includes("Onions"));

  const onionTrend = await service.getPriceTrends("biz_1", "vp_a", {
    period: { days: 90 },
    rawLineItemName: "Onions",
  });
  assert.ok(onionTrend.points.length > 0);
  assert.ok(onionTrend.points.every((point) => point.description === "Onions"));
});

test("getReorderSignals returns only items estimated to reorder within seven days", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const baseline = createBaselineSeed({ baseDate: now, postedDraftCount: 20 });
  const { prisma } = makeAnalyticsPrisma({
    drafts: baseline.drafts,
    financialTransactions: baseline.financialTransactions,
    vendorProfiles: [makeVendorProfile({ id: "vp_a" })],
    inventoryItems: [
      { id: "inv_a", business_id: "biz_1", name: "Carrots", is_active: true },
      { id: "inv_b", business_id: "biz_1", name: "Rice", is_active: true },
    ],
    inventoryTransactions: [
      {
        business_id: "biz_1",
        inventory_item_id: "inv_a",
        transaction_type: "purchase",
        input_method: "receipt",
        created_at: daysAgo(now, 25),
      },
      {
        business_id: "biz_1",
        inventory_item_id: "inv_a",
        transaction_type: "purchase",
        input_method: "receipt",
        created_at: daysAgo(now, 15),
      },
      {
        business_id: "biz_1",
        inventory_item_id: "inv_a",
        transaction_type: "purchase",
        input_method: "receipt",
        created_at: daysAgo(now, 5),
      },
      {
        business_id: "biz_1",
        inventory_item_id: "inv_b",
        transaction_type: "purchase",
        input_method: "receipt",
        created_at: daysAgo(now, 90),
      },
      {
        business_id: "biz_1",
        inventory_item_id: "inv_b",
        transaction_type: "purchase",
        input_method: "receipt",
        created_at: daysAgo(now, 30),
      },
    ],
  });

  const service = createDocumentAnalyticsService({ prismaClient: prisma, now: () => now });

  const result = await service.getReorderSignals("biz_1");
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].inventoryItemId, "inv_a");
  assert.ok(result.signals[0].estimatedDaysUntilReorder <= 7);
});

test("getTaxSummary only includes drafts linked to document_intake expense transactions", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const baseline = createBaselineSeed({
    baseDate: new Date("2025-01-01T00:00:00.000Z"),
    postedDraftCount: 20,
  });

  const focusedDrafts = [
    makeDraft({
      id: "draft_doc",
      parsed_tax: 7,
      parsed_total: 70,
      financial_transaction_id: "ft_doc",
      posted_at: daysAgo(now, 3),
      parsed_date: daysAgo(now, 3),
    }),
    makeDraft({
      id: "draft_manual",
      parsed_tax: 9,
      parsed_total: 90,
      financial_transaction_id: "ft_manual",
      posted_at: daysAgo(now, 2),
      parsed_date: daysAgo(now, 2),
    }),
  ];

  const { prisma } = makeAnalyticsPrisma({
    drafts: [...baseline.drafts, ...focusedDrafts],
    vendorProfiles: [makeVendorProfile({ id: "vp_a" })],
    financialTransactions: [
      ...baseline.financialTransactions,
      makeFinancialTransaction({
        id: "ft_doc",
        source: "document_intake",
        amount: 70,
        occurred_at: daysAgo(now, 3),
      }),
      makeFinancialTransaction({
        id: "ft_manual",
        source: "manual",
        amount: 90,
        occurred_at: daysAgo(now, 2),
      }),
    ],
  });

  const service = createDocumentAnalyticsService({ prismaClient: prisma, now: () => now });

  const result = await service.getTaxSummary("biz_1", { period: { days: 90 } });
  assert.equal(result.totalTax, 7);
  assert.equal(result.postedDraftCount, 1);
});

test("getCogsSummary groups document_intake expenses by vendor default category", async () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const baseline = createBaselineSeed({ baseDate: now, postedDraftCount: 20 });

  const { prisma } = makeAnalyticsPrisma({
    drafts: baseline.drafts,
    financialTransactions: [
      ...baseline.financialTransactions,
      makeFinancialTransaction({
        id: "ft_produce",
        amount: 120,
        metadata: { vendor_profile_id: "vp_a" },
      }),
      makeFinancialTransaction({
        id: "ft_beverage",
        amount: 80,
        metadata: { vendor_profile_id: "vp_b" },
      }),
      makeFinancialTransaction({
        id: "ft_uncat",
        amount: 25,
        metadata: null,
      }),
    ],
    vendorProfiles: [
      makeVendorProfile({ id: "vp_a", default_category: { id: "cat_a", name: "Produce" } }),
      makeVendorProfile({ id: "vp_b", default_category: { id: "cat_b", name: "Beverage" } }),
    ],
  });

  const service = createDocumentAnalyticsService({ prismaClient: prisma, now: () => now });

  const result = await service.getCogsSummary("biz_1", { period: { days: 90 } });
  const byCategory = new Map(result.byCategory.map((entry) => [entry.categoryName, entry.totalExpense]));

  assert.equal(byCategory.get("Produce"), 220);
  assert.equal(byCategory.get("Beverage"), 80);
  assert.equal(byCategory.get("Uncategorized"), 25);
});
