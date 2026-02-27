import { requireBusinessMembership } from "@/core/auth/tenant";
import { listIncomeProviderConnectionCards } from "@/features/integrations/server";
import { IncomeOnboardingWizardClient } from "@/features/integrations/ui";

export default async function IncomeSourcesOnboardingPage() {
  const { business } = await requireBusinessMembership();
  const cards = listIncomeProviderConnectionCards(business.industry_type, {
    returnToPath: "/onboarding/income-sources",
  });

  return (
    <IncomeOnboardingWizardClient
      industryType={business.industry_type}
      cards={cards}
    />
  );
}
