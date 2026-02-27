import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderDefinition } from "./provider-catalog.contracts";

export const INCOME_CONNECTION_STATUSES = [
  "not_connected",
  "connected",
  "error",
] as const;

export type IncomeConnectionStatus = (typeof INCOME_CONNECTION_STATUSES)[number];

export interface IncomeProviderConnectionCard {
  provider: IncomeProviderDefinition;
  industryType: IndustryType;
  recommended: boolean;
  status: IncomeConnectionStatus;
  connectionId: string | null;
  connectLabel: string;
  connectEnabled: boolean;
  connectHref: string | null;
  syncEnabled: boolean;
  syncHref: string | null;
}
