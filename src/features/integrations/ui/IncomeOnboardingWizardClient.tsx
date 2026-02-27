"use client";

import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { IncomeSourceSetupStep } from "./IncomeSourceSetupStep";

export default function IncomeOnboardingWizardClient({
  cards,
  industryType,
}: {
  cards: IncomeProviderConnectionCard[];
  industryType: IndustryType;
}) {
  return <IncomeSourceSetupStep cards={cards} industryType={industryType} />;
}
