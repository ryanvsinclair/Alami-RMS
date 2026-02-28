import test from "node:test";
import assert from "node:assert/strict";

const postModule = await import("./document-post.service.ts");
const reviewModule = await import("./draft-review.service.ts");

const { createDocumentPostService } = postModule;
const { createDraftReviewService } = reviewModule;

function makeInMemoryPrisma(seed = {}) {
  const state = {
    drafts: (seed.drafts ?? []).map((draft) => ({
      auto_posted: false,
      posted_at: null,
      posted_by_user_id: null,
      financial_transaction_id: null,
      parse_flags: null,
      anomaly_flags: null,
      confidence_band: null,
      confidence_score: null,
      parsed_tax: null,
      ...draft,
    })),
    vendorProfiles: (seed.vendorProfiles ?? []).map((vendor) => ({
      trust_threshold_override: null,
      auto_post_enabled: false,
      trust_threshold_met_at: null,
      last_document_at: null,
      ...vendor,
    })),
    mappings: (seed.mappings ?? []).map((mapping, index) => ({
      id: mapping.id ?? `map_${index + 1}`,
      confirmed_count: mapping.confirmed_count ?? 1,
      ...mapping,
    })),
    financialTransactions: (seed.financialTransactions ?? []).map((record, index) => ({
      id: record.id ?? `ft_${index + 1}`,
      created_at: record.created_at ?? new Date(),
      ...record,
    })),
    inventoryTransactions: (seed.inventoryTransactions ?? []).map((record, index) => ({
      id: record.id ?? `it_${index + 1}`,
      created_at: record.created_at ?? new Date(),
      ...record,
    })),
    inventoryItems: (seed.inventoryItems ?? []).map((item, index) => ({
      id: item.id ?? `inv_${index + 1}`,
      name: item.name ?? `Item ${index + 1}`,
      business_id: item.business_id ?? "biz_1",
      is_active: item.is_active ?? true,
      ...item,
    })),
  };

  let financialCounter = state.financialTransactions.length;
  let inventoryCounter = state.inventoryTransactions.length;

  function matchesStatus(status, where) {
    if (!where?.status) return true;
    if (where.status.in) {
      return where.status.in.includes(status);
    }
    if (typeof where.status === "string") {
      return where.status === status;
    }
    return true;
  }

  const client = {
    async $transaction(callback) {
      return callback(client);
    },
    documentDraft: {
      async findFirst(args = {}) {
        const where = args.where ?? {};
        return (
          state.drafts.find((draft) => {
            if (where.id && draft.id !== where.id) return false;
            if (where.business_id && draft.business_id !== where.business_id) return false;
            if (!matchesStatus(draft.status, where)) return false;
            return true;
          }) ?? null
        );
      },
      async count(args = {}) {
        const where = args.where ?? {};
        return state.drafts.filter((draft) => {
          if (where.business_id && draft.business_id !== where.business_id) return false;
          if (!matchesStatus(draft.status, where)) return false;
          return true;
        }).length;
      },
      async update(args = {}) {
        const id = args.where?.id;
        const index = state.drafts.findIndex((draft) => draft.id === id);
        if (index < 0) throw new Error("Document draft not found");
        const current = state.drafts[index];
        state.drafts[index] = {
          ...current,
          ...(args.data ?? {}),
        };
        return state.drafts[index];
      },
      async findMany() {
        return state.drafts.slice();
      },
    },
    financialTransaction: {
      async upsert(args = {}) {
        const key = args.where?.business_id_source_external_id;
        const existing = state.financialTransactions.find((record) => (
          record.business_id === key.business_id &&
          record.source === key.source &&
          record.external_id === key.external_id
        ));
        if (existing) return existing;

        financialCounter += 1;
        const created = {
          id: `ft_${financialCounter}`,
          created_at: new Date(),
          ...(args.create ?? {}),
        };
        state.financialTransactions.push(created);
        return created;
      },
    },
    documentVendorItemMapping: {
      async findFirst(args = {}) {
        const where = args.where ?? {};
        return (
          state.mappings.find((mapping) => (
            (!where.business_id || mapping.business_id === where.business_id) &&
            (!where.vendor_profile_id || mapping.vendor_profile_id === where.vendor_profile_id) &&
            (!where.raw_line_item_name || mapping.raw_line_item_name === where.raw_line_item_name)
          )) ?? null
        );
      },
      async findMany() {
        return state.mappings.slice();
      },
    },
    inventoryTransaction: {
      async create(args = {}) {
        inventoryCounter += 1;
        const created = {
          id: `it_${inventoryCounter}`,
          created_at: new Date(),
          ...(args.data ?? {}),
        };
        state.inventoryTransactions.push(created);
        return created;
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
        const current = state.vendorProfiles[index];
        const data = args.data ?? {};

        const next = { ...current };
        for (const [key, value] of Object.entries(data)) {
          if (key === "total_posted" && value && typeof value === "object" && "increment" in value) {
            next.total_posted += value.increment;
          } else {
            next[key] = value;
          }
        }
        state.vendorProfiles[index] = next;
        return next;
      },
      async findMany() {
        return state.vendorProfiles.slice();
      },
    },
    inventoryItem: {
      async findMany() {
        return state.inventoryItems.slice();
      },
    },
  };

  return { prisma: client, state };
}

function createPendingDraft(overrides = {}) {
  return {
    id: "draft_1",
    business_id: "biz_1",
    status: "pending_review",
    parsed_vendor_name: "Sysco",
    parsed_total: 42.5,
    parsed_date: new Date("2026-02-28T00:00:00.000Z"),
    parsed_line_items: [],
    vendor_profile_id: null,
    raw_content_type: "application/json",
    raw_storage_path: "biz_1/draft_1/raw.json",
    inbound_channel: "email",
    ...overrides,
  };
}

test("postDraft on pending_review draft creates financial transaction and marks draft posted", async () => {
  const { prisma, state } = makeInMemoryPrisma({
    drafts: [createPendingDraft()],
  });
  const service = createDocumentPostService({
    prismaClient: prisma,
    now: () => new Date("2026-02-28T09:00:00.000Z"),
  });

  const result = await service.postDraft("biz_1", "draft_1", "user_1");
  assert.ok(result.financialTransactionId);
  assert.equal(result.inventoryTransactionsCreated, 0);
  assert.equal(state.financialTransactions.length, 1);
  assert.equal(state.financialTransactions[0].source, "document_intake");
  assert.equal(state.drafts[0].status, "posted");
  assert.equal(state.drafts[0].financial_transaction_id, result.financialTransactionId);
  assert.equal(state.drafts[0].auto_posted, false);
});

test("postDraft idempotency returns the same financial transaction and does not duplicate", async () => {
  const { prisma, state } = makeInMemoryPrisma({
    drafts: [createPendingDraft()],
  });
  const service = createDocumentPostService({ prismaClient: prisma });

  const first = await service.postDraft("biz_1", "draft_1", "user_1");
  const second = await service.postDraft("biz_1", "draft_1", "user_1");
  assert.equal(first.financialTransactionId, second.financialTransactionId);
  assert.equal(second.inventoryTransactionsCreated, 0);
  assert.equal(state.financialTransactions.length, 1);
});

test("postDraft creates inventory transactions for mapped line items", async () => {
  const { prisma, state } = makeInMemoryPrisma({
    drafts: [
      createPendingDraft({
        vendor_profile_id: "vp_1",
        parsed_line_items: [
          { description: "Carrots", quantity: 2, unit_cost: 1.5, line_total: 3 },
          { description: "Onions", quantity: 1, unit_cost: 2, line_total: 2 },
          { description: "No Match", quantity: 1, unit_cost: 1, line_total: 1 },
        ],
      }),
    ],
    vendorProfiles: [
      {
        id: "vp_1",
        business_id: "biz_1",
        vendor_name: "Sysco",
        trust_state: "unverified",
        total_posted: 0,
      },
    ],
    mappings: [
      {
        business_id: "biz_1",
        vendor_profile_id: "vp_1",
        raw_line_item_name: "carrots",
        inventory_item_id: "inv_1",
      },
      {
        business_id: "biz_1",
        vendor_profile_id: "vp_1",
        raw_line_item_name: "onions",
        inventory_item_id: "inv_2",
      },
    ],
  });
  const service = createDocumentPostService({ prismaClient: prisma });

  const result = await service.postDraft("biz_1", "draft_1", "user_1");
  assert.equal(result.inventoryTransactionsCreated, 2);
  assert.equal(state.inventoryTransactions.length, 2);
  assert.equal(state.inventoryTransactions[0].input_method, "receipt");
  assert.equal(state.inventoryTransactions[0].transaction_type, "purchase");
});

test("postDraft throws when draft status is not pending_review", async () => {
  const { prisma } = makeInMemoryPrisma({
    drafts: [
      createPendingDraft({
        status: "draft",
      }),
    ],
  });
  const service = createDocumentPostService({ prismaClient: prisma });

  await assert.rejects(
    () => service.postDraft("biz_1", "draft_1", "user_1"),
    /pending_review/,
  );
});

test("rejectDraft marks draft rejected and keeps vendor total_posted unchanged", async () => {
  const { prisma, state } = makeInMemoryPrisma({
    drafts: [
      createPendingDraft({
        vendor_profile_id: "vp_1",
      }),
    ],
    vendorProfiles: [
      {
        id: "vp_1",
        business_id: "biz_1",
        vendor_name: "Sysco",
        trust_state: "learning",
        total_posted: 4,
      },
    ],
  });
  const service = createDocumentPostService({ prismaClient: prisma });

  await service.rejectDraft("biz_1", "draft_1", "user_1");
  assert.equal(state.drafts[0].status, "rejected");
  assert.equal(state.vendorProfiles[0].total_posted, 4);
});

test("postDraft increments vendor total_posted and promotes trust when threshold reached", async () => {
  const { prisma, state } = makeInMemoryPrisma({
    drafts: [
      createPendingDraft({
        vendor_profile_id: "vp_1",
      }),
    ],
    vendorProfiles: [
      {
        id: "vp_1",
        business_id: "biz_1",
        vendor_name: "Sysco",
        trust_state: "unverified",
        total_posted: 4,
      },
    ],
  });
  const service = createDocumentPostService({
    prismaClient: prisma,
    globalTrustThreshold: 5,
  });

  await service.postDraft("biz_1", "draft_1", "user_1");
  assert.equal(state.vendorProfiles[0].total_posted, 5);
  assert.equal(state.vendorProfiles[0].trust_state, "trusted");
  assert.equal(state.vendorProfiles[0].auto_post_enabled, true);
});

test("getDraftInboxBadgeCount includes pending_review and draft statuses", async () => {
  const { prisma } = makeInMemoryPrisma({
    drafts: [
      createPendingDraft({ id: "draft_a", status: "pending_review" }),
      createPendingDraft({ id: "draft_b", status: "draft" }),
      createPendingDraft({ id: "draft_c", status: "posted" }),
    ],
  });
  const reviewService = createDraftReviewService({ prismaClient: prisma });

  const count = await reviewService.getDraftInboxBadgeCount("biz_1");
  assert.equal(count, 2);
});

test("getDraftInboxBadgeCount excludes posted and rejected statuses", async () => {
  const { prisma } = makeInMemoryPrisma({
    drafts: [
      createPendingDraft({ id: "draft_a", status: "posted" }),
      createPendingDraft({ id: "draft_b", status: "rejected" }),
    ],
  });
  const reviewService = createDraftReviewService({ prismaClient: prisma });

  const count = await reviewService.getDraftInboxBadgeCount("biz_1");
  assert.equal(count, 0);
});
