import { Prisma, type IncomeProvider } from "@/lib/generated/prisma/client";
import { prisma } from "@/core/prisma";

export interface CreateIncomeOAuthStateInput {
  businessId: string;
  userId: string;
  providerId: IncomeProvider;
  stateHash: string;
  pkceVerifierEncrypted: string;
  redirectUri: string;
  expiresAt: Date;
  metadata?: Record<string, unknown> | null;
}

export interface ConsumeIncomeOAuthStateInput {
  businessId: string;
  providerId: IncomeProvider;
  stateHash: string;
  now?: Date;
}

export async function createIncomeOAuthState(input: CreateIncomeOAuthStateInput) {
  return prisma.incomeOAuthState.create({
    data: {
      business_id: input.businessId,
      user_id: input.userId,
      provider_id: input.providerId,
      state_hash: input.stateHash,
      pkce_verifier_encrypted: input.pkceVerifierEncrypted,
      redirect_uri: input.redirectUri,
      expires_at: input.expiresAt,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function consumeIncomeOAuthState(input: ConsumeIncomeOAuthStateInput) {
  const now = input.now ?? new Date();

  const record = await prisma.incomeOAuthState.findUnique({
    where: { state_hash: input.stateHash },
  });
  if (!record) return null;
  if (record.business_id !== input.businessId) return null;
  if (record.provider_id !== input.providerId) return null;
  if (record.used_at) return null;
  if (record.expires_at <= now) return null;

  const markUsed = await prisma.incomeOAuthState.updateMany({
    where: {
      id: record.id,
      used_at: null,
    },
    data: {
      used_at: now,
    },
  });

  if (markUsed.count !== 1) return null;
  return record;
}
