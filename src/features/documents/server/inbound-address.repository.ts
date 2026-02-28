import { randomBytes } from "node:crypto";

interface InboundAddressRecord {
  address_token: string;
  is_active: boolean;
}

interface InboundAddressPrismaDelegate {
  findUnique(args: unknown): Promise<InboundAddressRecord | null>;
  upsert(args: unknown): Promise<InboundAddressRecord>;
  findFirst(args: unknown): Promise<{ business_id: string } | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
}

interface InboundAddressPrismaClient {
  inboundAddress: InboundAddressPrismaDelegate;
}

interface CreateInboundAddressRepositoryOptions {
  prisma?: InboundAddressPrismaClient;
  createToken?: () => string;
  env?: NodeJS.ProcessEnv;
}

export interface InboundAddressLookup {
  addressToken: string;
  isActive: boolean;
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function isKnownPrismaUniqueError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function defaultTokenFactory() {
  return randomBytes(16).toString("hex");
}

function withMailboxHash(baseAddress: string, addressToken: string) {
  const normalizedBase = baseAddress.trim();
  const atIndex = normalizedBase.indexOf("@");
  if (atIndex < 0) {
    return `${normalizedBase}+${addressToken}@inbound.postmarkapp.com`;
  }

  const localPart = normalizedBase.slice(0, atIndex);
  const domainPart = normalizedBase.slice(atIndex + 1);
  if (!localPart || !domainPart) {
    throw new Error("POSTMARK_SERVER_INBOUND_HASH must be a valid email address");
  }

  return `${localPart}+${addressToken}@${domainPart}`;
}

export function composeInboundAddressDisplay(
  addressToken: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const token = normalizeToken(addressToken);
  if (!token) {
    throw new Error("Address token is required");
  }

  const customDomain = env.POSTMARK_INBOUND_DOMAIN?.trim();
  if (customDomain) {
    return `${token}@${customDomain}`;
  }

  const baseInboundAddress = env.POSTMARK_SERVER_INBOUND_HASH?.trim();
  if (!baseInboundAddress) {
    throw new Error("POSTMARK_SERVER_INBOUND_HASH is not configured");
  }

  return withMailboxHash(baseInboundAddress, token);
}

export function createInboundAddressRepository(
  options: CreateInboundAddressRepositoryOptions = {},
) {
  const prismaClient = options.prisma;
  if (!prismaClient) {
    throw new Error("createInboundAddressRepository requires a prisma client");
  }
  const repositoryPrisma = prismaClient;
  const createToken = options.createToken ?? defaultTokenFactory;
  const env = options.env ?? process.env;

  async function findOrCreateInboundAddress(
    businessId: string,
  ): Promise<InboundAddressLookup> {
    const existing = await repositoryPrisma.inboundAddress.findUnique({
      where: { business_id: businessId },
      select: { address_token: true, is_active: true },
    });
    if (existing) {
      return {
        addressToken: existing.address_token,
        isActive: existing.is_active,
      };
    }

    try {
      const created = await repositoryPrisma.inboundAddress.upsert({
        where: { business_id: businessId },
        create: {
          business_id: businessId,
          address_token: createToken(),
          is_active: true,
        },
        update: {},
        select: { address_token: true, is_active: true },
      });

      return {
        addressToken: created.address_token,
        isActive: created.is_active,
      };
    } catch (error) {
      if (!isKnownPrismaUniqueError(error)) throw error;

      const recovered = await repositoryPrisma.inboundAddress.findUnique({
        where: { business_id: businessId },
        select: { address_token: true, is_active: true },
      });

      if (!recovered) throw error;
      return {
        addressToken: recovered.address_token,
        isActive: recovered.is_active,
      };
    }
  }

  async function findBusinessByAddressToken(token: string) {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) return null;

    const record = await repositoryPrisma.inboundAddress.findFirst({
      where: {
        address_token: normalizedToken,
        is_active: true,
      },
      select: { business_id: true },
    });

    if (!record) return null;
    return { businessId: record.business_id };
  }

  async function deactivateInboundAddress(businessId: string) {
    const result = await repositoryPrisma.inboundAddress.updateMany({
      where: {
        business_id: businessId,
        is_active: true,
      },
      data: { is_active: false },
    });
    return result.count > 0;
  }

  function getAddressDisplayString(addressToken: string) {
    return composeInboundAddressDisplay(addressToken, env);
  }

  return {
    findOrCreateInboundAddress,
    findBusinessByAddressToken,
    deactivateInboundAddress,
    getAddressDisplayString,
  };
}

let defaultRepositoryPromise:
  | Promise<ReturnType<typeof createInboundAddressRepository>>
  | null = null;

async function getDefaultRepository() {
  if (!defaultRepositoryPromise) {
    defaultRepositoryPromise = import("@/server/db/prisma").then(({ prisma }) =>
      createInboundAddressRepository({
        prisma: prisma as unknown as InboundAddressPrismaClient,
      }),
    );
  }

  return defaultRepositoryPromise;
}

export async function findOrCreateInboundAddress(businessId: string) {
  const repository = await getDefaultRepository();
  return repository.findOrCreateInboundAddress(businessId);
}

export async function findBusinessByAddressToken(token: string) {
  const repository = await getDefaultRepository();
  return repository.findBusinessByAddressToken(token);
}

export async function deactivateInboundAddress(businessId: string) {
  const repository = await getDefaultRepository();
  return repository.deactivateInboundAddress(businessId);
}

export function getAddressDisplayString(addressToken: string) {
  return composeInboundAddressDisplay(addressToken, process.env);
}
