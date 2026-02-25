"use client";

import { createContext, useContext } from "react";
import type { IndustryType } from "@/lib/generated/prisma/client";
import { getTerminology, type TermKey } from "@/lib/config/terminology";

interface BusinessConfig {
  industryType: IndustryType;
  enabledModules: string[];
  terminology: Record<TermKey, string>;
}

const DEFAULT_CONFIG: BusinessConfig = {
  industryType: "general",
  enabledModules: [],
  terminology: getTerminology("general"),
};

const BusinessConfigContext = createContext<BusinessConfig>(DEFAULT_CONFIG);

export function BusinessConfigProvider({
  config,
  children,
}: {
  config: BusinessConfig;
  children: React.ReactNode;
}) {
  return (
    <BusinessConfigContext.Provider value={config}>
      {children}
    </BusinessConfigContext.Provider>
  );
}

export function useBusinessConfig() {
  return useContext(BusinessConfigContext);
}

export function useTerm(key: TermKey): string {
  const { terminology } = useBusinessConfig();
  return terminology[key] ?? key;
}
