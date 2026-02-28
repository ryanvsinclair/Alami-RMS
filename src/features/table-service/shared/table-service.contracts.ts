import type { KitchenOrderItemStatus } from "@/lib/generated/prisma/client";

export const TABLE_SERVICE_MODULE_ID = "table_service" as const;

export const KITCHEN_ORDER_ITEM_STATUSES = [
  "pending",
  "preparing",
  "ready_to_serve",
  "served",
  "cancelled",
] as const satisfies readonly KitchenOrderItemStatus[];
export type KitchenOrderItemStatusContract = (typeof KITCHEN_ORDER_ITEM_STATUSES)[number];

export const KITCHEN_TERMINAL_ITEM_STATUSES = [
  "served",
  "cancelled",
] as const satisfies readonly KitchenOrderItemStatusContract[];

export const TABLE_SERVICE_ORDER_FLOW_CONTRACT = {
  one_order_per_session: true,
  post_confirm_edits_append_to_same_order: true,
  amendment_table_in_v1: false,
} as const;

export interface TableServiceMenuCategorySummary {
  id: string;
  businessId: string;
  name: string;
  sortOrder: number;
  isSeeded: boolean;
}

export interface TableServiceMenuItemSummary {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number | string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface TableServiceDiningTableSummary {
  id: string;
  businessId: string;
  tableNumber: string;
  qrToken: string;
}

export interface TableServiceSessionSummary {
  id: string;
  businessId: string;
  diningTableId: string;
  partySize: number | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface TableServiceKitchenOrderItemSummary {
  id: string;
  businessId: string;
  kitchenOrderId: string;
  menuItemId: string;
  quantity: number;
  notes: string | null;
  status: KitchenOrderItemStatusContract;
}

export interface TableServiceKitchenOrderSummary {
  id: string;
  businessId: string;
  tableSessionId: string;
  notes: string | null;
  confirmedAt: string | null;
  dueAt: string | null;
  closedAt: string | null;
  items: TableServiceKitchenOrderItemSummary[];
}

export interface TableServiceMenuSetupData {
  categories: TableServiceMenuCategorySummary[];
  items: TableServiceMenuItemSummary[];
}

export interface UpsertMenuCategoryInput {
  categoryId?: string;
  name: string;
  sortOrder?: number;
  isSeeded?: boolean;
}

export interface UpsertMenuItemInput {
  menuItemId?: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
}

export interface UpsertDiningTableInput {
  tableId?: string;
  tableNumber: string;
  qrToken?: string;
}

export interface StartTableSessionInput {
  diningTableId: string;
  partySize?: number | null;
  notes?: string | null;
}

export interface ConfirmKitchenOrderInput {
  tableSessionId: string;
  notes?: string | null;
  items: KitchenOrderDraftItemInput[];
}

export interface KitchenOrderDraftItemInput {
  menuItemId: string;
  quantity: number;
  notes?: string | null;
}

export interface AppendKitchenOrderItemsInput {
  kitchenOrderId: string;
  items: KitchenOrderDraftItemInput[];
}

export interface MenuCsvImportReport {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}
