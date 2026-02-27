import { requireBusinessMembership } from "@/core/auth/tenant";
import { listIncomeProviderConnectionCards } from "@/features/integrations/server";
import { IncomeConnectionsPageClient } from "@/features/integrations/ui";

export default async function IntegrationsPage() {
  const { business } = await requireBusinessMembership();
  const cards = listIncomeProviderConnectionCards(business.industry_type, {
    returnToPath: "/integrations",
  });

  return (
    <IncomeConnectionsPageClient
      industryType={business.industry_type}
      cards={cards}
    />
  );
}
