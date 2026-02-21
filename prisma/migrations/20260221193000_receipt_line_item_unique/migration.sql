-- Prevent duplicate ledger inserts for the same receipt line item.
create unique index if not exists "inventory_transactions_receipt_line_item_id_key"
  on "inventory_transactions" ("receipt_line_item_id")
  where "receipt_line_item_id" is not null;
