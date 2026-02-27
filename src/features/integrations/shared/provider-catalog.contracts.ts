import type { IndustryType } from "@/lib/generated/prisma/client";

export const INCOME_PROVIDER_IDS = [
  "godaddy_pos",
  "uber_eats",
  "doordash",
  "square",
  "stripe",
  "toast",
  "skip_the_dishes",
] as const;

export type IncomeProviderId = (typeof INCOME_PROVIDER_IDS)[number];

export const INCOME_PROVIDER_TYPES = [
  "pos",
  "delivery",
  "payment",
  "ecommerce",
  "accounting",
  "bank",
] as const;

export type IncomeProviderType = (typeof INCOME_PROVIDER_TYPES)[number];

export const INCOME_PROVIDER_STATUSES = ["planned", "pilot", "active"] as const;

export type IncomeProviderStatus = (typeof INCOME_PROVIDER_STATUSES)[number];

export interface IncomeProviderDefinition {
  id: IncomeProviderId;
  name: string;
  type: IncomeProviderType;
  supportsOAuth: boolean;
  supportedIndustries: IndustryType[];
  optional: boolean;
  canSyncHistorical: boolean;
  canWebhook: boolean;
  status: IncomeProviderStatus;
}

// IN-00 decision lock: user input 1a selected GoDaddy POS as first pilot lane.
export const INCOME_MVP_PROVIDER_SEQUENCE = [
  "godaddy_pos",
  "uber_eats",
  "doordash",
] as const satisfies readonly IncomeProviderId[];

export const INCOME_POST_MVP_PROVIDER_SEQUENCE = [
  "square",
  "stripe",
  "toast",
  "skip_the_dishes",
] as const satisfies readonly IncomeProviderId[];

export const PROVIDER_RECOMMENDATIONS_BY_INDUSTRY: Record<
  IndustryType,
  readonly IncomeProviderId[]
> = {
  restaurant: [
    "godaddy_pos",
    "uber_eats",
    "doordash",
    "toast",
    "square",
    "stripe",
    "skip_the_dishes",
  ],
  retail: ["square", "stripe", "godaddy_pos"],
  salon: ["square", "stripe", "godaddy_pos"],
  contractor: ["stripe", "square"],
  general: ["stripe", "square", "godaddy_pos"],
};

export const INCOME_PROVIDER_CATALOG: readonly IncomeProviderDefinition[] = [
  {
    id: "godaddy_pos",
    name: "GoDaddy POS",
    type: "pos",
    supportsOAuth: true,
    supportedIndustries: ["restaurant", "retail", "salon", "general"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: false,
    status: "pilot",
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    type: "delivery",
    supportsOAuth: true,
    supportedIndustries: ["restaurant"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: true,
    status: "pilot",
  },
  {
    id: "doordash",
    name: "DoorDash",
    type: "delivery",
    supportsOAuth: true,
    supportedIndustries: ["restaurant"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: true,
    status: "pilot",
  },
  {
    id: "square",
    name: "Square",
    type: "pos",
    supportsOAuth: true,
    supportedIndustries: ["restaurant", "retail", "salon", "contractor", "general"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: true,
    status: "planned",
  },
  {
    id: "stripe",
    name: "Stripe",
    type: "payment",
    supportsOAuth: true,
    supportedIndustries: ["restaurant", "retail", "salon", "contractor", "general"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: true,
    status: "planned",
  },
  {
    id: "toast",
    name: "Toast",
    type: "pos",
    supportsOAuth: true,
    supportedIndustries: ["restaurant"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: true,
    status: "planned",
  },
  {
    id: "skip_the_dishes",
    name: "SkipTheDishes",
    type: "delivery",
    supportsOAuth: true,
    supportedIndustries: ["restaurant"],
    optional: true,
    canSyncHistorical: true,
    canWebhook: true,
    status: "planned",
  },
] as const;

export function listIncomeProvidersForIndustry(industryType: IndustryType): IncomeProviderDefinition[] {
  return INCOME_PROVIDER_CATALOG.filter((provider) =>
    provider.supportedIndustries.includes(industryType)
  );
}

export function isRecommendedForIndustry(
  industryType: IndustryType,
  providerId: IncomeProviderId
): boolean {
  return PROVIDER_RECOMMENDATIONS_BY_INDUSTRY[industryType].includes(providerId);
}
