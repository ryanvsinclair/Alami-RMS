import type { IndustryType } from "@/lib/generated/prisma/client";

export type TermKey =
  | "business"
  | "item"
  | "supplier"
  | "shopping"
  | "receive"
  | "moneyIn"
  | "moneyOut"
  | "category";

const TERMINOLOGY: Record<IndustryType, Record<TermKey, string>> = {
  restaurant: {
    business: "Restaurant",
    item: "Item",
    supplier: "Supplier",
    shopping: "Shopping",
    receive: "Receive",
    moneyIn: "Revenue",
    moneyOut: "Expenses",
    category: "Category",
  },
  salon: {
    business: "Salon",
    item: "Product",
    supplier: "Vendor",
    shopping: "Ordering",
    receive: "Check In",
    moneyIn: "Income",
    moneyOut: "Costs",
    category: "Category",
  },
  retail: {
    business: "Store",
    item: "Product",
    supplier: "Vendor",
    shopping: "Purchasing",
    receive: "Intake",
    moneyIn: "Sales",
    moneyOut: "Costs",
    category: "Department",
  },
  contractor: {
    business: "Company",
    item: "Material",
    supplier: "Provider",
    shopping: "Procurement",
    receive: "Log Delivery",
    moneyIn: "Revenue",
    moneyOut: "Expenses",
    category: "Category",
  },
  general: {
    business: "Business",
    item: "Item",
    supplier: "Supplier",
    shopping: "Shopping",
    receive: "Receive",
    moneyIn: "Income",
    moneyOut: "Expenses",
    category: "Category",
  },
};

export function getTerminology(industryType: IndustryType): Record<TermKey, string> {
  return TERMINOLOGY[industryType] ?? TERMINOLOGY.general;
}

export function getTerm(industryType: IndustryType, key: TermKey): string {
  return TERMINOLOGY[industryType]?.[key] ?? TERMINOLOGY.general[key];
}
