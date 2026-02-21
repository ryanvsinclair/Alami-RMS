-- Shopping mode schema
alter type "InputMethod" add value if not exists 'shopping';

create type "ShoppingSessionStatus" as enum (
  'draft',
  'reconciling',
  'ready',
  'committed',
  'cancelled'
);

create type "ShoppingItemOrigin" as enum (
  'staged',
  'receipt'
);

create type "ShoppingReconciliationStatus" as enum (
  'pending',
  'exact',
  'quantity_mismatch',
  'price_mismatch',
  'missing_on_receipt',
  'extra_on_receipt'
);

create type "ShoppingItemResolution" as enum (
  'pending',
  'accept_staged',
  'accept_receipt',
  'skip'
);

create table "shopping_sessions" (
  "id" text not null,
  "supplier_id" text,
  "receipt_id" text,
  "status" "ShoppingSessionStatus" not null default 'draft',
  "started_at" timestamp(3) not null default current_timestamp,
  "completed_at" timestamp(3),
  "staged_subtotal" decimal(10,2),
  "receipt_subtotal" decimal(10,2),
  "tax_total" decimal(10,2),
  "receipt_total" decimal(10,2),
  "notes" text,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "shopping_sessions_pkey" primary key ("id")
);

create unique index "shopping_sessions_receipt_id_key" on "shopping_sessions"("receipt_id");
create index "shopping_sessions_status_idx" on "shopping_sessions"("status");
create index "shopping_sessions_supplier_id_idx" on "shopping_sessions"("supplier_id");

create table "shopping_session_items" (
  "id" text not null,
  "session_id" text not null,
  "inventory_item_id" text,
  "receipt_line_item_id" text,
  "origin" "ShoppingItemOrigin" not null default 'staged',
  "raw_name" text not null,
  "normalized_name" text not null,
  "quantity" decimal not null default 1,
  "unit" "UnitType" not null default 'each',
  "staged_unit_price" decimal(10,2),
  "staged_line_total" decimal(10,2),
  "receipt_quantity" decimal,
  "receipt_unit_price" decimal(10,2),
  "receipt_line_total" decimal(10,2),
  "delta_quantity" decimal,
  "delta_price" decimal(10,2),
  "reconciliation_status" "ShoppingReconciliationStatus" not null default 'pending',
  "resolution" "ShoppingItemResolution" not null default 'pending',
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "shopping_session_items_pkey" primary key ("id")
);

create index "shopping_session_items_session_id_idx" on "shopping_session_items"("session_id");
create index "shopping_session_items_inventory_item_id_idx" on "shopping_session_items"("inventory_item_id");
create index "shopping_session_items_reconciliation_status_idx" on "shopping_session_items"("reconciliation_status");

alter table "inventory_transactions"
  add column if not exists "shopping_session_id" text;

create index if not exists "inventory_transactions_shopping_session_id_idx"
  on "inventory_transactions"("shopping_session_id");

alter table "inventory_transactions"
  add constraint "inventory_transactions_shopping_session_id_fkey"
  foreign key ("shopping_session_id") references "shopping_sessions"("id")
  on delete set null on update cascade;

alter table "shopping_sessions"
  add constraint "shopping_sessions_supplier_id_fkey"
  foreign key ("supplier_id") references "suppliers"("id")
  on delete set null on update cascade;

alter table "shopping_sessions"
  add constraint "shopping_sessions_receipt_id_fkey"
  foreign key ("receipt_id") references "receipts"("id")
  on delete set null on update cascade;

alter table "shopping_session_items"
  add constraint "shopping_session_items_session_id_fkey"
  foreign key ("session_id") references "shopping_sessions"("id")
  on delete cascade on update cascade;

alter table "shopping_session_items"
  add constraint "shopping_session_items_inventory_item_id_fkey"
  foreign key ("inventory_item_id") references "inventory_items"("id")
  on delete set null on update cascade;

alter table "shopping_session_items"
  add constraint "shopping_session_items_receipt_line_item_id_fkey"
  foreign key ("receipt_line_item_id") references "receipt_line_items"("id")
  on delete set null on update cascade;
