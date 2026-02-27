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
