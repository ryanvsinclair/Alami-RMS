-- Multi-tenant foundation for Supabase Auth users and restaurant isolation.

create type "RestaurantRole" as enum ('owner', 'manager', 'staff');

create table "restaurants" (
  "id" text primary key default gen_random_uuid(),
  "name" text not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table "user_restaurants" (
  "user_id" text not null,
  "restaurant_id" text not null,
  "role" "RestaurantRole" not null default 'owner',
  "created_at" timestamptz not null default now(),
  constraint "user_restaurants_pkey" primary key ("user_id", "restaurant_id"),
  constraint "user_restaurants_restaurant_id_fkey"
    foreign key ("restaurant_id") references "restaurants"("id") on delete cascade
);

create index "user_restaurants_restaurant_id_idx" on "user_restaurants" ("restaurant_id");

-- Bootstrap existing data into one default restaurant so migration is non-destructive.
insert into "restaurants" ("id", "name")
values ('00000000-0000-0000-0000-000000000001', 'Default Restaurant')
on conflict ("id") do nothing;

alter table "categories"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "suppliers"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "inventory_items"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "item_barcodes"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "receipts"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "inventory_transactions"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "shopping_sessions"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "item_price_history"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "financial_transactions"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';
alter table "external_sync_logs"
  add column if not exists "restaurant_id" text not null default '00000000-0000-0000-0000-000000000001';

-- Foreign keys
alter table "categories"
  add constraint "categories_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "suppliers"
  add constraint "suppliers_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "inventory_items"
  add constraint "inventory_items_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "item_barcodes"
  add constraint "item_barcodes_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "receipts"
  add constraint "receipts_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "inventory_transactions"
  add constraint "inventory_transactions_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "shopping_sessions"
  add constraint "shopping_sessions_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "item_price_history"
  add constraint "item_price_history_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "financial_transactions"
  add constraint "financial_transactions_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;
alter table "external_sync_logs"
  add constraint "external_sync_logs_restaurant_id_fkey"
  foreign key ("restaurant_id") references "restaurants"("id") on delete cascade;

-- Indexes
create index "categories_restaurant_id_idx" on "categories" ("restaurant_id");
create index "suppliers_restaurant_id_idx" on "suppliers" ("restaurant_id");
create index "inventory_items_restaurant_id_idx" on "inventory_items" ("restaurant_id");
create index "item_barcodes_restaurant_id_idx" on "item_barcodes" ("restaurant_id");
create index "receipts_restaurant_id_idx" on "receipts" ("restaurant_id");
create index "inventory_transactions_restaurant_id_idx" on "inventory_transactions" ("restaurant_id");
create index "shopping_sessions_restaurant_id_idx" on "shopping_sessions" ("restaurant_id");
create index "item_price_history_restaurant_id_idx" on "item_price_history" ("restaurant_id");
create index "financial_transactions_restaurant_id_idx" on "financial_transactions" ("restaurant_id");
create index "external_sync_logs_restaurant_id_idx" on "external_sync_logs" ("restaurant_id");

-- Uniqueness becomes tenant-scoped.
drop index if exists "categories_name_key";
create unique index "categories_restaurant_id_name_key" on "categories" ("restaurant_id", "name");

drop index if exists "suppliers_name_key";
create unique index "suppliers_restaurant_id_name_key" on "suppliers" ("restaurant_id", "name");

drop index if exists "suppliers_google_place_id_key";
create unique index "suppliers_restaurant_id_google_place_id_key"
  on "suppliers" ("restaurant_id", "google_place_id");

drop index if exists "item_barcodes_barcode_key";
create unique index "item_barcodes_restaurant_id_barcode_key"
  on "item_barcodes" ("restaurant_id", "barcode");

drop index if exists "financial_transactions_source_external_id_key";
create unique index "financial_transactions_restaurant_id_source_external_id_key"
  on "financial_transactions" ("restaurant_id", "source", "external_id");
