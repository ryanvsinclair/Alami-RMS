import { requireBusinessMembership } from "@/core/auth/tenant";
import { listIncomeProviderConnectionCardsForBusiness } from "@/features/integrations/server";
import { IncomeConnectionsPageClient } from "@/features/integrations/ui";
import { CALENDAR_PROVIDER_CATALOG } from "@/features/schedule/shared";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    oauth?: string;
    provider?: string;
    oauth_error?: string;
    sync?: string;
    records?: string;
    sync_error?: string;
  }>;
}) {
  const { business } = await requireBusinessMembership();
  const params = await searchParams;
  const cards = await listIncomeProviderConnectionCardsForBusiness({
    businessId: business.id,
    industryType: business.industry_type,
    returnToPath: "/integrations",
  });
  const calendarProviders = [...CALENDAR_PROVIDER_CATALOG];

  return (
    <IncomeConnectionsPageClient
      cards={cards}
      calendarProviders={calendarProviders}
      feedback={params}
    />
  );
}
