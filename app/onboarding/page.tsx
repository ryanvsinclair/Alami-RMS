import { redirect } from "next/navigation";
import {
  FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID,
  getOnboardingIncomeSourceStepPath,
} from "@/features/integrations/shared/onboarding-flow";

export default function OnboardingEntryPage() {
  redirect(getOnboardingIncomeSourceStepPath(FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID));
}
