import type { IncomeConnectionStatus as DbIncomeConnectionStatus, IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import {
  INCOME_MVP_PROVIDER_SEQUENCE,
  INCOME_POST_MVP_PROVIDER_SEQUENCE,
  PROVIDER_RECOMMENDATIONS_BY_INDUSTRY,
  isRecommendedForIndustry,
  listIncomeProvidersForIndustry,
  type IncomeProviderId,
} from "@/features/integrations/shared";
import { isIncomeProviderOAuthConfigured } from "@/features/integrations/providers/registry";
import { listIncomeConnectionsByBusiness } from "./connections.repository";

const rolloutOrder = new Map<IncomeProviderId, number>(
  [...INCOME_MVP_PROVIDER_SEQUENCE, ...INCOME_POST_MVP_PROVIDER_SEQUENCE].map((providerId, index) => [
    providerId,
    index,
  ])
);

export function listIncomeProviderConnectionCards(
  industryType: IndustryType,
  options: {
    returnToPath?: string;
  } = {}
): IncomeProviderConnectionCard[] {
  const providers = listIncomeProvidersForIndustry(industryType);
  const recommendationOrder = new Map<IncomeProviderId, number>(
    PROVIDER_RECOMMENDATIONS_BY_INDUSTRY[industryType].map((providerId, index) => [providerId, index])
  );
  const returnToPath = options.returnToPath ?? "/integrations";

  const sortedProviders = providers.sort((a, b) => {
    const aRecommended = isRecommendedForIndustry(industryType, a.id);
    const bRecommended = isRecommendedForIndustry(industryType, b.id);

    if (aRecommended !== bRecommended) {
      return aRecommended ? -1 : 1;
    }

    if (aRecommended && bRecommended) {
      const aRecommendedOrder = recommendationOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRecommendedOrder = recommendationOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aRecommendedOrder !== bRecommendedOrder) {
        return aRecommendedOrder - bRecommendedOrder;
      }
    }

    const aOrder = rolloutOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = rolloutOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.name.localeCompare(b.name);
  });

  return sortedProviders.map((provider) => {
    const oauthConfigured = isIncomeProviderOAuthConfigured(provider.id);
    return {
      provider,
      industryType,
      recommended: isRecommendedForIndustry(industryType, provider.id),
      status: "not_connected",
      connectionId: null,
      lastSyncAt: null,
      connectLabel: oauthConfigured ? "Connect" : "Connect (Setup needed)",
      connectEnabled: oauthConfigured,
      connectHref: oauthConfigured
        ? `/api/integrations/oauth/${provider.id}/start?return_to=${encodeURIComponent(returnToPath)}`
        : null,
      syncEnabled: false,
      syncHref: null,
    };
  });
}

function mapDatabaseStatusToCardStatus(status: DbIncomeConnectionStatus) {
  if (status === "connected") return "connected";
  if (status === "error" || status === "expired") return "error";
  return "not_connected";
}

export async function listIncomeProviderConnectionCardsForBusiness(input: {
  businessId: string;
  industryType: IndustryType;
  returnToPath?: string;
}): Promise<IncomeProviderConnectionCard[]> {
  const cards = listIncomeProviderConnectionCards(input.industryType, {
    returnToPath: input.returnToPath,
  });
  const connections = await listIncomeConnectionsByBusiness(input.businessId);
  const byProvider = new Map(connections.map((connection) => [connection.provider_id, connection]));
  const returnToPath = input.returnToPath ?? "/integrations";

  return cards.map((card) => {
    const connection = byProvider.get(card.provider.id);
    if (!connection) return card;

    const syncEnabled =
      connection.provider_id === "godaddy_pos" && connection.status === "connected";

    return {
      ...card,
      connectionId: connection.id,
      lastSyncAt: connection.last_sync_at ? connection.last_sync_at.toISOString() : null,
      status: mapDatabaseStatusToCardStatus(connection.status),
      connectLabel: card.connectEnabled ? "Reconnect" : "Reconnect (Setup needed)",
      syncEnabled,
      syncHref: syncEnabled
        ? `/api/integrations/sync/godaddy-pos/manual?return_to=${encodeURIComponent(returnToPath)}`
        : null,
    };
  });
}
