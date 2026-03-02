export const ONBOARDING_INCOME_SOURCE_STEP_IDS = [
  "pos-payments",
  "food-delivery",
  "booking",
  "calendar",
  "reservations",
] as const;

export type OnboardingIncomeSourceStepId =
  (typeof ONBOARDING_INCOME_SOURCE_STEP_IDS)[number];

export const FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID: OnboardingIncomeSourceStepId =
  ONBOARDING_INCOME_SOURCE_STEP_IDS[0];

export const ONBOARDING_INCOME_SOURCE_COMPLETION_PATH = "/integrations";

export function getOnboardingIncomeSourceStepPath(
  stepId: OnboardingIncomeSourceStepId
) {
  return `/onboarding/income-sources/${stepId}`;
}

export function getNextOnboardingIncomeSourceStepId(
  currentStepId: OnboardingIncomeSourceStepId
): OnboardingIncomeSourceStepId | null {
  const currentIndex = ONBOARDING_INCOME_SOURCE_STEP_IDS.indexOf(currentStepId);
  if (currentIndex < 0) return null;
  return ONBOARDING_INCOME_SOURCE_STEP_IDS[currentIndex + 1] ?? null;
}

export function getPreviousOnboardingIncomeSourceStepId(
  currentStepId: OnboardingIncomeSourceStepId
): OnboardingIncomeSourceStepId | null {
  const currentIndex = ONBOARDING_INCOME_SOURCE_STEP_IDS.indexOf(currentStepId);
  if (currentIndex <= 0) return null;
  return ONBOARDING_INCOME_SOURCE_STEP_IDS[currentIndex - 1] ?? null;
}
