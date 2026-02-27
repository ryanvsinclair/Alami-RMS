import type { IncomeConnectionStatus as DbIncomeConnectionStatus, IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import {
  INCOME_MVP_PROVIDER_SEQUENCE,
  INCOME_POST_MVP_PROVIDER_SEQUENCE,
  PROVIDER_RECOMMENDATIONS_BY_INDUSTRY,
  SYNC_STALE_THRESHOLD_MS,
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
      syncStale: false,
      lastErrorMessage: null,
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

/**
 * Providers that have a live manual sync route.
 * Extend this set as new provider adapters are added.
 */
const SYNC_ENABLED_PROVIDERS = new Set<string>([
  "godaddy_pos",
  "uber_eats",
  "doordash",
]);

const SYNC_ROUTE_BY_PROVIDER: Record<string, string> = {
  godaddy_pos: "/api/integrations/sync/godaddy-pos/manual",
  uber_eats: "/api/integrations/sync/uber-eats/manual",
  doordash: "/api/integrations/sync/doordash/manual",
};

function buildSyncHref(providerId: string, returnToPath: string): string | null {
  const route = SYNC_ROUTE_BY_PROVIDER[providerId];
  if (!route) return null;
  return `${route}?return_to=${encodeURIComponent(returnToPath)}`;
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

  const now = Date.now();

  return cards.map((card) => {
    const connection = byProvider.get(card.provider.id);
    if (!connection) return card;

    const isConnected = connection.status === "connected";
    const syncEnabled = isConnected && SYNC_ENABLED_PROVIDERS.has(connection.provider_id);
    const lastSyncAt = connection.last_sync_at ? connection.last_sync_at.toISOString() : null;

    // Stale sync: connected but never synced, or last sync was >24h ago
    const syncStale = isConnected && (
      !connection.last_sync_at ||
      now - connection.last_sync_at.getTime() > SYNC_STALE_THRESHOLD_MS
    );

    return {
      ...card,
      connectionId: connection.id,
      lastSyncAt,
      syncStale,
      lastErrorMessage: connection.last_error_message ?? null,
      status: mapDatabaseStatusToCardStatus(connection.status),
      connectLabel: card.connectEnabled ? "Reconnect" : "Reconnect (Setup needed)",
      syncEnabled,
      syncHref: syncEnabled
        ? buildSyncHref(connection.provider_id, returnToPath)
        : null,
    };
  });
}
