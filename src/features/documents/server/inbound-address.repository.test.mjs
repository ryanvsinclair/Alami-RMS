import test from "node:test";
import assert from "node:assert/strict";

const repositoryModule = await import("./inbound-address.repository.ts");
const {
  createInboundAddressRepository,
  composeInboundAddressDisplay,
} = repositoryModule;

function makeInMemoryPrisma() {
  const byBusiness = new Map();
  const byToken = new Map();

  return {
    inboundAddress: {
      async findUnique(args) {
        const businessId = args?.where?.business_id;
        const row = byBusiness.get(businessId);
        if (!row) return null;
        return {
          address_token: row.address_token,
          is_active: row.is_active,
        };
      },
      async upsert(args) {
        const businessId = args?.where?.business_id;
        const existing = byBusiness.get(businessId);
        if (existing) {
          return {
            address_token: existing.address_token,
            is_active: existing.is_active,
          };
        }

        const created = {
          business_id: businessId,
          address_token: args?.create?.address_token,
          is_active: args?.create?.is_active ?? true,
        };
        byBusiness.set(businessId, created);
        byToken.set(created.address_token, created);
        return {
          address_token: created.address_token,
          is_active: created.is_active,
        };
      },
      async findFirst(args) {
        const token = args?.where?.address_token;
        const activeOnly = args?.where?.is_active === true;
        const row = byToken.get(token);
        if (!row) return null;
        if (activeOnly && !row.is_active) return null;
        return { business_id: row.business_id };
      },
      async updateMany(args) {
        const businessId = args?.where?.business_id;
        const current = byBusiness.get(businessId);
        if (!current || current.is_active === false) {
          return { count: 0 };
        }

        current.is_active = Boolean(args?.data?.is_active);
        byBusiness.set(businessId, current);
        byToken.set(current.address_token, current);
        return { count: 1 };
      },
    },
  };
}

test("findOrCreateInboundAddress is idempotent and returns the same token on repeat calls", async () => {
  const prisma = makeInMemoryPrisma();
  let sequence = 0;
  const repository = createInboundAddressRepository({
    prisma,
    createToken: () => `token_${++sequence}`,
  });

  const first = await repository.findOrCreateInboundAddress("biz_1");
  const second = await repository.findOrCreateInboundAddress("biz_1");

  assert.equal(first.addressToken, "token_1");
  assert.equal(second.addressToken, "token_1");
  assert.equal(first.isActive, true);
  assert.equal(second.isActive, true);
});

test("findBusinessByAddressToken only resolves active records", async () => {
  const prisma = makeInMemoryPrisma();
  const repository = createInboundAddressRepository({
    prisma,
    createToken: () => "token_active",
  });

  await repository.findOrCreateInboundAddress("biz_active");
  const found = await repository.findBusinessByAddressToken("token_active");
  assert.deepEqual(found, { businessId: "biz_active" });

  const deactivated = await repository.deactivateInboundAddress("biz_active");
  assert.equal(deactivated, true);

  const notFound = await repository.findBusinessByAddressToken("token_active");
  assert.equal(notFound, null);
});

test("composeInboundAddressDisplay supports both default and custom-domain formats", () => {
  const defaultAddress = composeInboundAddressDisplay("abc123", {
    POSTMARK_SERVER_INBOUND_HASH: "serverhash@inbound.postmarkapp.com",
  });
  assert.equal(defaultAddress, "serverhash+abc123@inbound.postmarkapp.com");

  const customAddress = composeInboundAddressDisplay("abc123", {
    POSTMARK_SERVER_INBOUND_HASH: "serverhash@inbound.postmarkapp.com",
    POSTMARK_INBOUND_DOMAIN: "docs.example.com",
  });
  assert.equal(customAddress, "abc123@docs.example.com");
});
