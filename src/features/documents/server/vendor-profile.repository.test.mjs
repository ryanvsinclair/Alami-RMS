import test from "node:test";
import assert from "node:assert/strict";

const repositoryModule = await import("./vendor-profile.repository.ts");
const { createVendorProfileRepository } = repositoryModule;

function makeInMemoryPrisma(seedRows = []) {
  const rows = seedRows.map((row, index) => ({
    id: row.id ?? `vp_${index + 1}`,
    business_id: row.business_id ?? "biz_1",
    vendor_name: row.vendor_name ?? `Vendor ${index + 1}`,
    vendor_aliases: row.vendor_aliases ?? [],
    supplier_id: row.supplier_id ?? null,
    default_category_id: row.default_category_id ?? null,
    trust_state: row.trust_state ?? "unverified",
    total_posted: row.total_posted ?? 0,
    trust_threshold_override: row.trust_threshold_override ?? null,
    auto_post_enabled: row.auto_post_enabled ?? false,
    trust_threshold_met_at: row.trust_threshold_met_at ?? null,
    last_document_at: row.last_document_at ?? null,
  }));

  function findByWhere(where = {}) {
    return rows.filter((row) => {
      if (where.id && row.id !== where.id) return false;
      if (where.business_id && row.business_id !== where.business_id) return false;
      if (where.vendor_name?.equals) {
        const candidate = String(where.vendor_name.equals);
        if (where.vendor_name.mode === "insensitive") {
          if (row.vendor_name.toLowerCase() !== candidate.toLowerCase()) return false;
        } else if (row.vendor_name !== candidate) {
          return false;
        }
      }
      return true;
    });
  }

  return {
    vendorProfile: {
      async findFirst(args) {
        const matches = findByWhere(args?.where ?? {});
        return matches[0] ?? null;
      },
      async findMany(args) {
        const matches = findByWhere(args?.where ?? {});
        if (args?.orderBy?.[0]?.vendor_name === "asc") {
          return matches.slice().sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));
        }
        return matches;
      },
      async create(args) {
        const data = args?.data ?? {};
        const created = {
          id: data.id ?? `vp_${rows.length + 1}`,
          business_id: data.business_id,
          vendor_name: data.vendor_name,
          vendor_aliases: data.vendor_aliases ?? [],
          supplier_id: data.supplier_id ?? null,
          default_category_id: data.default_category_id ?? null,
          trust_state: data.trust_state ?? "unverified",
          total_posted: data.total_posted ?? 0,
          trust_threshold_override: data.trust_threshold_override ?? null,
          auto_post_enabled: data.auto_post_enabled ?? false,
          trust_threshold_met_at: data.trust_threshold_met_at ?? null,
          last_document_at: data.last_document_at ?? null,
        };
        rows.push(created);
        return created;
      },
      async update(args) {
        const id = args?.where?.id;
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) throw new Error("Vendor profile not found");
        const current = rows[index];
        const data = args?.data ?? {};
        rows[index] = {
          ...current,
          ...data,
          total_posted:
            data.total_posted?.increment != null
              ? current.total_posted + data.total_posted.increment
              : (data.total_posted ?? current.total_posted),
        };
        return rows[index];
      },
    },
  };
}

test("findVendorByExactName returns vendor on exact name match", async () => {
  const prisma = makeInMemoryPrisma([
    { id: "vp_exact", business_id: "biz_1", vendor_name: "Metro Supply" },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  const result = await repository.findVendorByExactName("biz_1", "metro supply");
  assert.ok(result);
  assert.equal(result.id, "vp_exact");
});

test("findVendorByAlias returns vendor when alias exists in vendor_aliases jsonb array", async () => {
  const prisma = makeInMemoryPrisma([
    { id: "vp_alias", business_id: "biz_1", vendor_name: "Sysco", vendor_aliases: ["sysco.com"] },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  const result = await repository.findVendorByAlias("biz_1", "sysco.com");
  assert.ok(result);
  assert.equal(result.id, "vp_alias");
});

test("findVendorByAlias returns null when no alias match exists", async () => {
  const prisma = makeInMemoryPrisma([
    { id: "vp_none", business_id: "biz_1", vendor_name: "North Foods", vendor_aliases: [] },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  const result = await repository.findVendorByAlias("biz_1", "missing.example");
  assert.equal(result, null);
});

test("evaluateAndUpdateTrustState transitions unverified -> learning -> trusted at global threshold", async () => {
  const prisma = makeInMemoryPrisma([
    { id: "vp_state", business_id: "biz_1", vendor_name: "Progress Vendor", total_posted: 0 },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  await repository.incrementVendorPostedCount("biz_1", "vp_state");
  let updated = await repository.evaluateAndUpdateTrustState("biz_1", "vp_state");
  assert.equal(updated.trust_state, "learning");

  for (let i = 0; i < 4; i += 1) {
    await repository.incrementVendorPostedCount("biz_1", "vp_state");
  }
  updated = await repository.evaluateAndUpdateTrustState("biz_1", "vp_state");
  assert.equal(updated.trust_state, "trusted");
  assert.equal(updated.auto_post_enabled, true);
});

test("evaluateAndUpdateTrustState respects trust_threshold_override before global threshold", async () => {
  const prisma = makeInMemoryPrisma([
    {
      id: "vp_override",
      business_id: "biz_1",
      vendor_name: "Override Vendor",
      trust_threshold_override: 3,
      total_posted: 2,
    },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  await repository.incrementVendorPostedCount("biz_1", "vp_override");
  const updated = await repository.evaluateAndUpdateTrustState("biz_1", "vp_override");
  assert.equal(updated.total_posted, 3);
  assert.equal(updated.trust_state, "trusted");
});

test("addVendorAlias is idempotent when adding the same alias twice", async () => {
  const prisma = makeInMemoryPrisma([
    {
      id: "vp_alias_dupe",
      business_id: "biz_1",
      vendor_name: "Alias Vendor",
      vendor_aliases: ["alpha.com"],
    },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  await repository.addVendorAlias("biz_1", "vp_alias_dupe", "alpha.com");
  const updated = await repository.addVendorAlias("biz_1", "vp_alias_dupe", "alpha.com");
  assert.deepEqual(updated.vendor_aliases, ["alpha.com"]);
});

test("getEffectiveTrustThreshold uses override when present and global threshold when absent", async () => {
  const prisma = makeInMemoryPrisma();
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  assert.equal(repository.getEffectiveTrustThreshold({ trust_threshold_override: 2 }), 2);
  assert.equal(repository.getEffectiveTrustThreshold({ trust_threshold_override: null }), 5);
});

test("evaluateAndUpdateTrustState does not promote blocked vendors", async () => {
  const prisma = makeInMemoryPrisma([
    {
      id: "vp_blocked",
      business_id: "biz_1",
      vendor_name: "Blocked Vendor",
      trust_state: "blocked",
      total_posted: 99,
      auto_post_enabled: false,
    },
  ]);
  const repository = createVendorProfileRepository({ prisma, globalTrustThreshold: 5 });

  const updated = await repository.evaluateAndUpdateTrustState("biz_1", "vp_blocked");
  assert.equal(updated.trust_state, "blocked");
  assert.equal(updated.auto_post_enabled, false);
});
