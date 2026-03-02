import { notFound } from "next/navigation";
import { requireBusinessMembership } from "@/core/auth/tenant";
import { listIncomeProviderConnectionCardsForBusiness } from "@/features/integrations/server";
import type { IncomeProviderType } from "@/features/integrations/shared";
import {
  FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID,
  ONBOARDING_INCOME_SOURCE_COMPLETION_PATH,
  ONBOARDING_INCOME_SOURCE_STEP_IDS,
  type OnboardingIncomeSourceStepId,
  getNextOnboardingIncomeSourceStepId,
  getPreviousOnboardingIncomeSourceStepId,
  getOnboardingIncomeSourceStepPath,
} from "@/features/integrations/shared/onboarding-flow";
import { OnboardingConnectionsStep } from "@/features/integrations/ui/OnboardingConnectionsStep";
import {
  CALENDAR_PROVIDER_CATALOG,
  type CalendarProviderStatus,
  type CalendarProviderType,
} from "@/features/schedule/shared";

interface OnboardingStepDefinition {
  title: string;
  incomeTypes?: readonly IncomeProviderType[];
  calendarTypes?: readonly CalendarProviderType[];
  emptyStateText?: string;
}

const STEP_DEFINITIONS: Record<OnboardingIncomeSourceStepId, OnboardingStepDefinition> = {
  "pos-payments": {
    title: "Connect your POS / Payments sources",
    incomeTypes: ["pos", "payment"],
    emptyStateText: "No POS or payment providers are available for your business type yet.",
  },
  "food-delivery": {
    title: "Connect your food delivery sources",
    incomeTypes: ["delivery"],
    emptyStateText: "No food delivery providers are available for your business type yet.",
  },
  booking: {
    title: "Connect your booking sources",
    calendarTypes: ["booking_platform"],
    emptyStateText: "No booking platforms are available for your business type yet.",
  },
  calendar: {
    title: "Connect your calendar sources",
    calendarTypes: ["general_calendar"],
    emptyStateText: "No calendar providers are available for your business type yet.",
  },
  reservations: {
    title: "Connect your reservation sources",
    calendarTypes: ["reservation_platform"],
    emptyStateText: "No reservation providers are available for your business type yet.",
  },
};

const CALENDAR_STATUS_ORDER: Record<CalendarProviderStatus, number> = {
  active: 0,
  pilot: 1,
  planned: 2,
};

export default async function OnboardingIncomeSourcesStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!ONBOARDING_INCOME_SOURCE_STEP_IDS.includes(step as OnboardingIncomeSourceStepId)) {
    notFound();
  }

  const stepId = step as OnboardingIncomeSourceStepId;
  const stepDefinition = STEP_DEFINITIONS[stepId] ?? STEP_DEFINITIONS[FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID];
  const currentStepPath = getOnboardingIncomeSourceStepPath(stepId);
  const previousStepId = getPreviousOnboardingIncomeSourceStepId(stepId);
  const backHref = previousStepId
    ? getOnboardingIncomeSourceStepPath(previousStepId)
    : "/auth/signup";
  const nextStepId = getNextOnboardingIncomeSourceStepId(stepId);
  const nextHref = nextStepId
    ? getOnboardingIncomeSourceStepPath(nextStepId)
    : ONBOARDING_INCOME_SOURCE_COMPLETION_PATH;

  const { business } = await requireBusinessMembership();
  const incomeCards = await listIncomeProviderConnectionCardsForBusiness({
    businessId: business.id,
    industryType: business.industry_type,
    returnToPath: currentStepPath,
  });

  const filteredIncomeCards = stepDefinition.incomeTypes
    ? incomeCards.filter((card) => stepDefinition.incomeTypes?.includes(card.provider.type))
    : [];

  const filteredCalendarProviders = stepDefinition.calendarTypes
    ? [...CALENDAR_PROVIDER_CATALOG]
        .filter((provider) => stepDefinition.calendarTypes?.includes(provider.type))
        .sort((left, right) => {
          const statusOrder =
            CALENDAR_STATUS_ORDER[left.status] - CALENDAR_STATUS_ORDER[right.status];
          if (statusOrder !== 0) return statusOrder;
          return left.name.localeCompare(right.name);
        })
    : [];

  return (
    <OnboardingConnectionsStep
      title={stepDefinition.title}
      incomeCards={filteredIncomeCards}
      calendarProviders={filteredCalendarProviders}
      emptyStateText={stepDefinition.emptyStateText}
      backHref={backHref}
      skipHref={nextHref}
      continueHref={nextHref}
    />
  );
}
