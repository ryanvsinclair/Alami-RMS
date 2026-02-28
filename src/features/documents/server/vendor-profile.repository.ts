interface VendorProfileRecord {
  id: string;
  business_id: string;
  vendor_name: string;
  vendor_aliases: unknown;
  supplier_id: string | null;
  default_category_id: string | null;
  trust_state: "unverified" | "learning" | "trusted" | "blocked";
  total_posted: number;
  trust_threshold_override: number | null;
  auto_post_enabled: boolean;
  trust_threshold_met_at: Date | null;
  last_document_at: Date | null;
}

interface VendorProfilePrismaClient {
  vendorProfile: {
    findFirst(args: unknown): Promise<VendorProfileRecord | null>;
    findMany(args: unknown): Promise<VendorProfileRecord[]>;
    create(args: unknown): Promise<VendorProfileRecord>;
    update(args: unknown): Promise<VendorProfileRecord>;
  };
  $queryRawUnsafe?: (query: string, ...params: unknown[]) => Promise<Array<Record<string, unknown>>>;
}

export interface CreateVendorProfileInput {
  vendorName: string;
  supplierId?: string | null;
  defaultCategoryId?: string | null;
  trustThresholdOverride?: number | null;
}

export interface UpdateVendorProfileInput {
  vendorName?: string;
  supplierId?: string | null;
  defaultCategoryId?: string | null;
  trustThresholdOverride?: number | null;
  autoPostEnabled?: boolean;
  trustState?: "unverified" | "learning" | "trusted" | "blocked";
}

export interface VendorProfileSummary {
  id: string;
  vendor_name: string;
  trust_state: "unverified" | "learning" | "trusted" | "blocked";
  total_posted: number;
  trust_threshold_override: number | null;
  auto_post_enabled: boolean;
  last_document_at: string | null;
}

interface CreateVendorProfileRepositoryOptions {
  prisma?: VendorProfilePrismaClient;
  globalTrustThreshold?: number;
}

function normalizeVendorName(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Vendor name is required");
  }
  return normalized;
}

function normalizeAlias(value: string) {
  return value.trim().toLowerCase();
}

function toAliasArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const aliases: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const alias = normalizeAlias(entry);
    if (!alias) continue;
    if (!aliases.includes(alias)) aliases.push(alias);
  }
  return aliases;
}

function toSummary(vendor: VendorProfileRecord): VendorProfileSummary {
  return {
    id: vendor.id,
    vendor_name: vendor.vendor_name,
    trust_state: vendor.trust_state,
    total_posted: vendor.total_posted,
    trust_threshold_override: vendor.trust_threshold_override,
    auto_post_enabled: vendor.auto_post_enabled,
    last_document_at: vendor.last_document_at ? vendor.last_document_at.toISOString() : null,
  };
}

function diceSimilarity(leftRaw: string, rightRaw: string) {
  const left = leftRaw.trim().toLowerCase();
  const right = rightRaw.trim().toLowerCase();
  if (!left || !right) return 0;
  if (left === right) return 1;

  const makeBigrams = (value: string) => {
    const set = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      set.set(gram, (set.get(gram) ?? 0) + 1);
    }
    return set;
  };

  const leftBigrams = makeBigrams(left);
  const rightBigrams = makeBigrams(right);
  let overlap = 0;

  for (const [gram, count] of leftBigrams.entries()) {
    const rightCount = rightBigrams.get(gram) ?? 0;
    overlap += Math.min(count, rightCount);
  }

  const leftCount = Array.from(leftBigrams.values()).reduce((sum, value) => sum + value, 0);
  const rightCount = Array.from(rightBigrams.values()).reduce((sum, value) => sum + value, 0);
  if (leftCount + rightCount === 0) return 0;
  return (2 * overlap) / (leftCount + rightCount);
}

export function createVendorProfileRepository(
  options: CreateVendorProfileRepositoryOptions = {},
) {
  const prismaClient = options.prisma;
  if (!prismaClient) {
    throw new Error("createVendorProfileRepository requires a prisma client");
  }
  const repositoryPrisma = prismaClient;
  const globalTrustThreshold = options.globalTrustThreshold ?? 5;

  async function findVendorById(businessId: string, vendorProfileId: string) {
    return repositoryPrisma.vendorProfile.findFirst({
      where: {
        id: vendorProfileId,
        business_id: businessId,
      },
    });
  }

  async function findVendorByExactName(businessId: string, vendorName: string) {
    const normalizedName = normalizeVendorName(vendorName);
    return repositoryPrisma.vendorProfile.findFirst({
      where: {
        business_id: businessId,
        vendor_name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
    });
  }

  async function findVendorByAlias(businessId: string, aliasText: string) {
    const alias = normalizeAlias(aliasText);
    if (!alias) return null;

    const vendors = await repositoryPrisma.vendorProfile.findMany({
      where: { business_id: businessId },
    });
    return (
      vendors.find((vendor) => {
        const aliases = toAliasArray(vendor.vendor_aliases);
        return aliases.includes(alias);
      }) ?? null
    );
  }

  async function findVendorByFuzzyName(businessId: string, vendorName: string) {
    const normalizedName = normalizeVendorName(vendorName);

    if (repositoryPrisma.$queryRawUnsafe) {
      const rows = await repositoryPrisma.$queryRawUnsafe(
        `
          SELECT *,
                 similarity(vendor_name, $1) AS sim
          FROM vendor_profiles
          WHERE business_id = $2
            AND similarity(vendor_name, $1) >= 0.75
          ORDER BY sim DESC
          LIMIT 1
        `,
        normalizedName,
        businessId,
      );

      const row = rows[0];
      if (!row) return null;
      return {
        profile: row as unknown as VendorProfileRecord,
        similarity: Number(row.sim ?? 0),
      };
    }

    const vendors = await repositoryPrisma.vendorProfile.findMany({
      where: { business_id: businessId },
    });

    let best: { profile: VendorProfileRecord; similarity: number } | null = null;
    for (const vendor of vendors) {
      const similarity = diceSimilarity(vendor.vendor_name, normalizedName);
      if (similarity < 0.75) continue;
      if (!best || similarity > best.similarity) {
        best = { profile: vendor, similarity };
      }
    }
    return best;
  }

  async function findAllVendors(businessId: string): Promise<VendorProfileSummary[]> {
    const vendors = await repositoryPrisma.vendorProfile.findMany({
      where: { business_id: businessId },
      orderBy: [{ vendor_name: "asc" }],
    });
    return vendors.map(toSummary);
  }

  async function createVendorProfile(
    businessId: string,
    input: CreateVendorProfileInput,
  ) {
    const vendorName = normalizeVendorName(input.vendorName);
    return repositoryPrisma.vendorProfile.create({
      data: {
        business_id: businessId,
        vendor_name: vendorName,
        vendor_aliases: [],
        supplier_id: input.supplierId ?? null,
        default_category_id: input.defaultCategoryId ?? null,
        trust_threshold_override: input.trustThresholdOverride ?? null,
      },
    });
  }

  async function updateVendorProfile(
    businessId: string,
    vendorProfileId: string,
    updates: UpdateVendorProfileInput,
  ) {
    const existing = await findVendorById(businessId, vendorProfileId);
    if (!existing) throw new Error("Vendor profile not found");

    return repositoryPrisma.vendorProfile.update({
      where: { id: vendorProfileId },
      data: {
        ...(updates.vendorName !== undefined
          ? { vendor_name: normalizeVendorName(updates.vendorName) }
          : {}),
        ...(updates.supplierId !== undefined ? { supplier_id: updates.supplierId } : {}),
        ...(updates.defaultCategoryId !== undefined
          ? { default_category_id: updates.defaultCategoryId }
          : {}),
        ...(updates.trustThresholdOverride !== undefined
          ? { trust_threshold_override: updates.trustThresholdOverride }
          : {}),
        ...(updates.autoPostEnabled !== undefined
          ? { auto_post_enabled: updates.autoPostEnabled }
          : {}),
        ...(updates.trustState !== undefined ? { trust_state: updates.trustState } : {}),
      },
    });
  }

  async function addVendorAlias(
    businessId: string,
    vendorProfileId: string,
    aliasText: string,
  ) {
    const alias = normalizeAlias(aliasText);
    if (!alias) {
      throw new Error("Alias text is required");
    }

    const vendor = await findVendorById(businessId, vendorProfileId);
    if (!vendor) throw new Error("Vendor profile not found");

    const aliases = toAliasArray(vendor.vendor_aliases);
    if (aliases.includes(alias)) return vendor;

    const nextAliases = [...aliases, alias];
    return repositoryPrisma.vendorProfile.update({
      where: { id: vendorProfileId },
      data: {
        vendor_aliases: nextAliases,
      },
    });
  }

  async function incrementVendorPostedCount(businessId: string, vendorProfileId: string) {
    const vendor = await findVendorById(businessId, vendorProfileId);
    if (!vendor) throw new Error("Vendor profile not found");

    return repositoryPrisma.vendorProfile.update({
      where: { id: vendorProfileId },
      data: {
        total_posted: { increment: 1 },
        last_document_at: new Date(),
      },
    });
  }

  function getEffectiveTrustThreshold(vendor: {
    trust_threshold_override: number | null;
  }) {
    return vendor.trust_threshold_override ?? globalTrustThreshold;
  }

  async function evaluateAndUpdateTrustState(businessId: string, vendorProfileId: string) {
    const vendor = await findVendorById(businessId, vendorProfileId);
    if (!vendor) throw new Error("Vendor profile not found");

    if (vendor.trust_state === "blocked") {
      return vendor;
    }

    const threshold = getEffectiveTrustThreshold(vendor);
    if (vendor.total_posted >= threshold && vendor.trust_state !== "trusted") {
      return repositoryPrisma.vendorProfile.update({
        where: { id: vendorProfileId },
        data: {
          trust_state: "trusted",
          auto_post_enabled: true,
          trust_threshold_met_at: vendor.trust_threshold_met_at ?? new Date(),
        },
      });
    }

    if (vendor.total_posted > 0 && vendor.trust_state === "unverified") {
      return repositoryPrisma.vendorProfile.update({
        where: { id: vendorProfileId },
        data: {
          trust_state: "learning",
        },
      });
    }

    return vendor;
  }

  return {
    findVendorById,
    findVendorByExactName,
    findVendorByAlias,
    findVendorByFuzzyName,
    findAllVendors,
    createVendorProfile,
    updateVendorProfile,
    addVendorAlias,
    incrementVendorPostedCount,
    getEffectiveTrustThreshold,
    evaluateAndUpdateTrustState,
  };
}

let defaultRepositoryPromise:
  | Promise<ReturnType<typeof createVendorProfileRepository>>
  | null = null;

async function getDefaultRepository() {
  if (!defaultRepositoryPromise) {
    defaultRepositoryPromise = import("@/server/db/prisma").then(({ prisma }) =>
      createVendorProfileRepository({
        prisma: prisma as unknown as VendorProfilePrismaClient,
      }),
    );
  }
  return defaultRepositoryPromise;
}

export async function findVendorById(businessId: string, vendorProfileId: string) {
  const repository = await getDefaultRepository();
  return repository.findVendorById(businessId, vendorProfileId);
}

export async function findVendorByExactName(businessId: string, vendorName: string) {
  const repository = await getDefaultRepository();
  return repository.findVendorByExactName(businessId, vendorName);
}

export async function findVendorByAlias(businessId: string, aliasText: string) {
  const repository = await getDefaultRepository();
  return repository.findVendorByAlias(businessId, aliasText);
}

export async function findVendorByFuzzyName(businessId: string, vendorName: string) {
  const repository = await getDefaultRepository();
  return repository.findVendorByFuzzyName(businessId, vendorName);
}

export async function findAllVendors(businessId: string) {
  const repository = await getDefaultRepository();
  return repository.findAllVendors(businessId);
}

export async function createVendorProfile(
  businessId: string,
  input: CreateVendorProfileInput,
) {
  const repository = await getDefaultRepository();
  return repository.createVendorProfile(businessId, input);
}

export async function updateVendorProfile(
  businessId: string,
  vendorProfileId: string,
  updates: UpdateVendorProfileInput,
) {
  const repository = await getDefaultRepository();
  return repository.updateVendorProfile(businessId, vendorProfileId, updates);
}

export async function addVendorAlias(
  businessId: string,
  vendorProfileId: string,
  aliasText: string,
) {
  const repository = await getDefaultRepository();
  return repository.addVendorAlias(businessId, vendorProfileId, aliasText);
}

export async function incrementVendorPostedCount(
  businessId: string,
  vendorProfileId: string,
) {
  const repository = await getDefaultRepository();
  return repository.incrementVendorPostedCount(businessId, vendorProfileId);
}

export async function getEffectiveTrustThreshold(vendor: {
  trust_threshold_override: number | null;
}) {
  const repository = await getDefaultRepository();
  return repository.getEffectiveTrustThreshold(vendor);
}

export async function evaluateAndUpdateTrustState(
  businessId: string,
  vendorProfileId: string,
) {
  const repository = await getDefaultRepository();
  return repository.evaluateAndUpdateTrustState(businessId, vendorProfileId);
}
