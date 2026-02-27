import { requireBusinessMembership } from "@/core/auth/tenant";
import { listIncomeProviderConnectionCardsForBusiness } from "@/features/integrations/server";
import { IncomeConnectionsPageClient } from "@/features/integrations/ui";

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

  return (
    <IncomeConnectionsPageClient
      industryType={business.industry_type}
      cards={cards}
      feedback={params}
    />
  );
}
