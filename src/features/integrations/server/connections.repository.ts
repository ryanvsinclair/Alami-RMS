import { Prisma, type IncomeConnectionStatus, type IncomeProvider } from "@/lib/generated/prisma/client";
import { prisma } from "@/core/prisma";

export interface UpsertIncomeConnectionInput {
  businessId: string;
  providerId: IncomeProvider;
  providerType?: string | null;
  displayName?: string | null;
  externalAccountId?: string | null;
  externalLocationId?: string | null;
  status: IncomeConnectionStatus;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export async function upsertIncomeConnection(input: UpsertIncomeConnectionInput) {
  return prisma.businessIncomeConnection.upsert({
    where: {
      business_id_provider_id: {
        business_id: input.businessId,
        provider_id: input.providerId,
      },
    },
    create: {
      business_id: input.businessId,
      provider_id: input.providerId,
      provider_type: input.providerType ?? null,
      display_name: input.displayName ?? null,
      external_account_id: input.externalAccountId ?? null,
      external_location_id: input.externalLocationId ?? null,
      status: input.status,
      access_token_encrypted: input.accessTokenEncrypted ?? null,
      refresh_token_encrypted: input.refreshTokenEncrypted ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      scopes: input.scopes as Prisma.InputJsonValue | undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      last_error_code: null,
      last_error_message: null,
    },
    update: {
      provider_type: input.providerType ?? null,
      display_name: input.displayName ?? null,
      external_account_id: input.externalAccountId ?? null,
      external_location_id: input.externalLocationId ?? null,
      status: input.status,
      access_token_encrypted: input.accessTokenEncrypted ?? null,
      refresh_token_encrypted: input.refreshTokenEncrypted ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      scopes: input.scopes as Prisma.InputJsonValue | undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      last_error_code: null,
      last_error_message: null,
    },
  });
}

export async function findIncomeConnectionByProvider(params: {
  businessId: string;
  providerId: IncomeProvider;
}) {
  return prisma.businessIncomeConnection.findUnique({
    where: {
      business_id_provider_id: {
        business_id: params.businessId,
        provider_id: params.providerId,
      },
    },
  });
}

export async function listIncomeConnectionsByBusiness(businessId: string) {
  return prisma.businessIncomeConnection.findMany({
    where: { business_id: businessId },
    orderBy: { updated_at: "desc" },
  });
}

export async function markIncomeConnectionSyncSuccess(params: {
  connectionId: string;
  syncedAt: Date;
  fullSync: boolean;
}) {
  return prisma.businessIncomeConnection.update({
    where: { id: params.connectionId },
    data: {
      status: "connected",
      last_sync_at: params.syncedAt,
      last_full_sync_at: params.fullSync ? params.syncedAt : undefined,
      last_error_code: null,
      last_error_message: null,
    },
  });
}

export async function markIncomeConnectionError(params: {
  businessId: string;
  providerId: IncomeProvider;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  return prisma.businessIncomeConnection.updateMany({
    where: {
      business_id: params.businessId,
      provider_id: params.providerId,
    },
    data: {
      status: "error",
      last_error_code: params.errorCode ?? null,
      last_error_message: params.errorMessage ?? null,
    },
  });
}

export async function markIncomeConnectionExpired(params: {
  connectionId: string;
  errorMessage?: string | null;
}) {
  return prisma.businessIncomeConnection.update({
    where: { id: params.connectionId },
    data: {
      status: "expired",
      last_error_code: "token_expired",
      last_error_message: params.errorMessage ?? "Access token has expired. Please reconnect.",
    },
  });
}
