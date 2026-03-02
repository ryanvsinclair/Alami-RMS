"use client";

import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { IncomeSourceSetupStep } from "./IncomeSourceSetupStep";

export default function IncomeOnboardingWizardClient({
  cards,
}: {
  cards: IncomeProviderConnectionCard[];
}) {
  return <IncomeSourceSetupStep cards={cards} />;
}
