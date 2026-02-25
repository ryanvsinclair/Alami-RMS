import type { IndustryType } from "@/lib/generated/prisma/client";

export interface IndustryPreset {
  defaultModules: string[];
  defaultCategories: string[];
  preferredUnits: string[];
  relevantSources: string[];
}

export const INDUSTRY_TYPES = [
  "restaurant",
  "salon",
  "retail",
  "contractor",
  "general",
] as const satisfies readonly IndustryType[];

export const INDUSTRY_LABELS: Record<IndustryType, string> = {
  restaurant: "Restaurant",
  salon: "Salon",
  retail: "Store",
  contractor: "Contractor",
  general: "Other",
};

export function isIndustryType(value: string): value is IndustryType {
  return (INDUSTRY_TYPES as readonly string[]).includes(value);
}

export const INDUSTRY_PRESETS: Record<IndustryType, IndustryPreset> = {
  restaurant: {
    defaultModules: ["shopping", "receipts", "integrations"],
    defaultCategories: [
      "Produce",
      "Meat & Seafood",
      "Dairy",
      "Dry Goods",
      "Beverages",
      "Cleaning",
    ],
    preferredUnits: ["kg", "lb", "each", "case_unit", "box", "dozen"],
    relevantSources: ["godaddy_pos", "uber_eats", "doordash", "shopping", "manual"],
  },
  salon: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["Hair Care", "Skin Care", "Nails", "Tools", "Cleaning"],
    preferredUnits: ["each", "box", "pack", "ml", "l"],
    relevantSources: ["shopping", "manual"],
  },
  retail: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["Electronics", "Clothing", "Home", "Food", "Health"],
    preferredUnits: ["each", "case_unit", "box", "pack", "dozen"],
    relevantSources: ["shopping", "manual"],
  },
  contractor: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["Lumber", "Hardware", "Electrical", "Plumbing", "Paint", "Tools"],
    preferredUnits: ["each", "box", "bag", "lb", "kg"],
    relevantSources: ["shopping", "manual"],
  },
  general: {
    defaultModules: ["shopping", "receipts"],
    defaultCategories: ["General"],
    preferredUnits: ["each", "box", "pack"],
    relevantSources: ["shopping", "manual"],
  },
};
