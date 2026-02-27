import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import {
  INCOME_MVP_PROVIDER_SEQUENCE,
  INCOME_POST_MVP_PROVIDER_SEQUENCE,
  PROVIDER_RECOMMENDATIONS_BY_INDUSTRY,
  isRecommendedForIndustry,
  listIncomeProvidersForIndustry,
  type IncomeProviderId,
} from "@/features/integrations/shared";

const rolloutOrder = new Map<IncomeProviderId, number>(
  [...INCOME_MVP_PROVIDER_SEQUENCE, ...INCOME_POST_MVP_PROVIDER_SEQUENCE].map((providerId, index) => [
    providerId,
    index,
  ])
);

export function listIncomeProviderConnectionCards(
  industryType: IndustryType
): IncomeProviderConnectionCard[] {
  const providers = listIncomeProvidersForIndustry(industryType);
  const recommendationOrder = new Map<IncomeProviderId, number>(
    PROVIDER_RECOMMENDATIONS_BY_INDUSTRY[industryType].map((providerId, index) => [providerId, index])
  );

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

  return sortedProviders.map((provider) => ({
    provider,
    industryType,
    recommended: isRecommendedForIndustry(industryType, provider.id),
    status: "not_connected",
    connectLabel: "Connect (Coming soon)",
    connectEnabled: false,
  }));
}
