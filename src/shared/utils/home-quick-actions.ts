"use client";

import type { IndustryType } from "@/lib/generated/prisma/client";

export const HOME_QUICK_ACTION_STORAGE_KEY = "home_quick_actions_v1";
export const HOME_QUICK_ACTION_CHANGED_EVENT = "home-quick-actions-changed";
export const HOME_QUICK_ACTION_SLOT_COUNT = 4;

export type HomeQuickActionId =
  | "add_receipt_photo"
  | "scan_barcode"
  | "scan_receipt"
  | "manual_entry"
  | "intake_hub"
  | "inventory"
  | "shopping_session"
  | "shopping_orders"
  | "reports"
  | "contacts"
  | "staff"
  | "schedule"
  | "documents_inbox"
  | "documents_analytics"
  | "service_tables"
  | "service_kitchen"
  | "service_menu"
  | "integrations";

export type HomeQuickActionDefinition = {
  id: HomeQuickActionId;
  label: string;
  href: string;
  moduleId?: "receipts" | "shopping" | "documents" | "table_service";
  industryType?: IndustryType;
};

export type HomeQuickActionAvailabilityContext = {
  enabledModules: readonly string[];
  industryType: IndustryType;
};

export const HOME_QUICK_ACTION_DEFINITIONS: readonly HomeQuickActionDefinition[] = [
  { id: "add_receipt_photo", label: "Add Receipt", href: "/receive/photo", moduleId: "receipts" },
  { id: "scan_barcode", label: "Scan Barcode", href: "/receive/barcode", moduleId: "receipts" },
  { id: "scan_receipt", label: "Scan Receipt", href: "/receive/receipt", moduleId: "receipts" },
  { id: "manual_entry", label: "Manual Entry", href: "/receive/manual", moduleId: "receipts" },
  { id: "intake_hub", label: "Intake Hub", href: "/intake" },
  { id: "inventory", label: "Inventory", href: "/inventory" },
  { id: "shopping_session", label: "Shopping", href: "/shopping", moduleId: "shopping" },
  { id: "shopping_orders", label: "Past Orders", href: "/shopping/orders", moduleId: "shopping" },
  { id: "reports", label: "Reports", href: "/reports" },
  { id: "contacts", label: "Contacts", href: "/contacts" },
  { id: "staff", label: "Staff", href: "/staff" },
  { id: "schedule", label: "Schedule", href: "/schedule" },
  { id: "documents_inbox", label: "Documents", href: "/documents", moduleId: "documents" },
  {
    id: "documents_analytics",
    label: "Doc Analytics",
    href: "/documents/analytics",
    moduleId: "documents",
  },
  { id: "service_tables", label: "Table Setup", href: "/service/tables", moduleId: "table_service" },
  { id: "service_kitchen", label: "Kitchen Queue", href: "/service/kitchen", moduleId: "table_service" },
  { id: "service_menu", label: "Menu Setup", href: "/service/menu", moduleId: "table_service" },
  { id: "integrations", label: "Integrations", href: "/integrations" },
];

const HOME_QUICK_ACTION_ID_SET = new Set<HomeQuickActionId>(
  HOME_QUICK_ACTION_DEFINITIONS.map((action) => action.id),
);

const HOME_QUICK_ACTION_DEFAULT_ORDER: readonly HomeQuickActionId[] = [
  "add_receipt_photo",
  "scan_barcode",
  "inventory",
  "shopping_session",
  "reports",
  "contacts",
  "schedule",
  "staff",
  "scan_receipt",
  "manual_entry",
  "intake_hub",
  "documents_inbox",
  "documents_analytics",
  "service_tables",
  "service_kitchen",
  "service_menu",
  "shopping_orders",
  "integrations",
];

function notifyHomeQuickActionsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOME_QUICK_ACTION_CHANGED_EVENT));
}

function isHomeQuickActionId(value: unknown): value is HomeQuickActionId {
  return typeof value === "string" && HOME_QUICK_ACTION_ID_SET.has(value as HomeQuickActionId);
}

function uniqueIds(ids: readonly HomeQuickActionId[]) {
  return Array.from(new Set(ids));
}

export function getAvailableHomeQuickActions(
  context: HomeQuickActionAvailabilityContext,
): HomeQuickActionDefinition[] {
  const enabledModuleSet = new Set(context.enabledModules);

  return HOME_QUICK_ACTION_DEFINITIONS.filter((action) => {
    if (action.moduleId && !enabledModuleSet.has(action.moduleId)) return false;
    if (action.industryType && action.industryType !== context.industryType) return false;
    return true;
  });
}

export function getDefaultHomeQuickActionIds(
  context: HomeQuickActionAvailabilityContext,
): HomeQuickActionId[] {
  const availableIds = new Set(getAvailableHomeQuickActions(context).map((action) => action.id));
  const ordered = uniqueIds(
    HOME_QUICK_ACTION_DEFAULT_ORDER.filter((id) => availableIds.has(id)),
  );

  return ordered.slice(0, HOME_QUICK_ACTION_SLOT_COUNT);
}

export function resolveHomeQuickActionIds(
  rawIds: readonly unknown[],
  context: HomeQuickActionAvailabilityContext,
): HomeQuickActionId[] {
  const availableIds = new Set(getAvailableHomeQuickActions(context).map((action) => action.id));
  const selected = uniqueIds(
    rawIds.filter((value): value is HomeQuickActionId => {
      return isHomeQuickActionId(value) && availableIds.has(value);
    }),
  ).slice(0, HOME_QUICK_ACTION_SLOT_COUNT);

  if (selected.length === HOME_QUICK_ACTION_SLOT_COUNT) return selected;

  const defaults = getDefaultHomeQuickActionIds(context);
  for (const fallbackId of defaults) {
    if (selected.length >= HOME_QUICK_ACTION_SLOT_COUNT) break;
    if (!selected.includes(fallbackId)) {
      selected.push(fallbackId);
    }
  }

  if (selected.length >= HOME_QUICK_ACTION_SLOT_COUNT) return selected;

  for (const availableId of availableIds) {
    if (selected.length >= HOME_QUICK_ACTION_SLOT_COUNT) break;
    if (!selected.includes(availableId)) {
      selected.push(availableId);
    }
  }

  return selected;
}

export function subscribeToHomeQuickActions(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(HOME_QUICK_ACTION_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(HOME_QUICK_ACTION_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getStoredHomeQuickActionIds(context: HomeQuickActionAvailabilityContext) {
  if (typeof window === "undefined") {
    return getDefaultHomeQuickActionIds(context);
  }

  const stored = window.localStorage.getItem(HOME_QUICK_ACTION_STORAGE_KEY);
  if (!stored) {
    return getDefaultHomeQuickActionIds(context);
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return getDefaultHomeQuickActionIds(context);
    }

    return resolveHomeQuickActionIds(parsed, context);
  } catch {
    return getDefaultHomeQuickActionIds(context);
  }
}

export function setStoredHomeQuickActionIds(
  ids: readonly HomeQuickActionId[],
  context: HomeQuickActionAvailabilityContext,
) {
  if (typeof window === "undefined") return;

  const resolved = resolveHomeQuickActionIds(ids, context);
  window.localStorage.setItem(HOME_QUICK_ACTION_STORAGE_KEY, JSON.stringify(resolved));
  notifyHomeQuickActionsChanged();
}

export function getHomeQuickActionSnapshotKey(context: HomeQuickActionAvailabilityContext) {
  return getStoredHomeQuickActionIds(context).join("|");
}

export function parseHomeQuickActionSnapshotKey(
  snapshotKey: string,
  context: HomeQuickActionAvailabilityContext,
) {
  if (!snapshotKey) {
    return resolveHomeQuickActionIds([], context);
  }

  return resolveHomeQuickActionIds(snapshotKey.split("|"), context);
}
