create type "ReceiptInventoryDecision" as enum (
  'pending',
  'add_to_inventory',
  'expense_only',
  'resolve_later'
);

alter table "receipt_line_items"
  add column if not exists "inventory_decision" "ReceiptInventoryDecision" not null default 'pending',
  add column if not exists "inventory_decided_at" timestamp(3);

create index if not exists "receipt_line_items_inventory_decision_idx"
  on "receipt_line_items"("inventory_decision");
