// Re-export Prisma generated types as the single source of truth
export type {
  Category,
  Supplier,
  InventoryItem,
  ItemBarcode,
  ItemAlias,
  Receipt,
  ReceiptLineItem,
  InventoryTransaction,
  UnitType,
  InputMethod,
  TransactionType,
  MatchConfidence,
  ReceiptStatus,
  LineItemStatus,
} from "../../generated/prisma/client";

// ============================================================
// Join / enriched types (for UI)
// ============================================================

import type {
  InventoryItem,
  ItemBarcode,
  ItemAlias,
  Category,
  Supplier,
  Receipt,
  ReceiptLineItem,
} from "../../generated/prisma/client";

export interface InventoryItemWithRelations extends InventoryItem {
  category: Category | null;
  supplier: Supplier | null;
  barcodes: ItemBarcode[];
  aliases: ItemAlias[];
}

export interface ReceiptWithLineItems extends Receipt {
  line_items: (ReceiptLineItem & {
    matched_item: InventoryItem | null;
  })[];
}

export interface InventoryLevel {
  id: string;
  name: string;
  unit: string;
  category_id: string | null;
  supplier_id: string | null;
  is_active: boolean;
  current_quantity: number;
  last_transaction_at: Date | null;
  transaction_count: number;
}
