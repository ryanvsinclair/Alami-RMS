-- ============================================================
-- ALAMIR MS: Inventory Ingestion System — Initial Schema
-- ============================================================

-- Enable extensions
create extension if not exists "pg_trgm";   -- trigram fuzzy matching
create extension if not exists "uuid-ossp"; -- uuid generation

-- ============================================================
-- ENUMS
-- ============================================================

create type unit_type as enum (
  'kg', 'g', 'lb', 'oz',
  'l', 'ml', 'gal',
  'each', 'case', 'pack', 'box', 'bag',
  'dozen', 'slice', 'portion'
);

create type input_method as enum (
  'barcode', 'photo', 'manual', 'receipt'
);

create type transaction_type as enum (
  'purchase', 'adjustment', 'waste', 'transfer'
);

create type match_confidence as enum (
  'high', 'medium', 'low', 'none'
);

create type receipt_status as enum (
  'pending',     -- uploaded, not yet parsed
  'parsing',     -- OCR in progress
  'review',      -- parsed, awaiting user review
  'committed',   -- all line items confirmed and ledgered
  'failed'       -- parsing failed
);

create type line_item_status as enum (
  'matched',     -- auto-matched (high confidence)
  'suggested',   -- suggested match (medium confidence)
  'unresolved',  -- needs user input (low/none confidence)
  'confirmed',   -- user confirmed
  'skipped'      -- user chose to skip
);

-- ============================================================
-- CATEGORIES
-- ============================================================

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INVENTORY ITEMS (Master)
-- ============================================================

create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  unit unit_type not null default 'each',
  units_per_case numeric,
  default_cost numeric(10, 2),
  supplier_id uuid references suppliers(id) on delete set null,
  par_level numeric,           -- optional: reorder threshold
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_inventory_items_name on inventory_items using gin (name gin_trgm_ops);
create index idx_inventory_items_category on inventory_items (category_id);
create index idx_inventory_items_supplier on inventory_items (supplier_id);

-- ============================================================
-- ITEM BARCODES
-- ============================================================

create table item_barcodes (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  barcode text not null unique,
  created_at timestamptz not null default now()
);

create index idx_item_barcodes_barcode on item_barcodes (barcode);
create index idx_item_barcodes_item on item_barcodes (inventory_item_id);

-- ============================================================
-- ITEM ALIASES (for fuzzy matching / historical learning)
-- ============================================================

create table item_aliases (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  alias_text text not null,
  source input_method,           -- how this alias was learned
  created_at timestamptz not null default now(),

  unique (inventory_item_id, alias_text)
);

create index idx_item_aliases_text on item_aliases using gin (alias_text gin_trgm_ops);
create index idx_item_aliases_item on item_aliases (inventory_item_id);

-- ============================================================
-- RECEIPTS
-- ============================================================

create table receipts (
  id uuid primary key default uuid_generate_v4(),
  image_url text,
  raw_text text,                  -- full OCR output
  parsed_data jsonb,              -- structured extraction trace
  supplier_id uuid references suppliers(id) on delete set null,
  status receipt_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_receipts_status on receipts (status);

-- ============================================================
-- RECEIPT LINE ITEMS
-- ============================================================

create table receipt_line_items (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  line_number int not null,           -- position on receipt
  raw_text text not null,             -- original OCR text for this line
  parsed_name text,                   -- normalized name
  quantity numeric,
  unit unit_type,
  line_cost numeric(10, 2),
  unit_cost numeric(10, 2),
  matched_item_id uuid references inventory_items(id) on delete set null,
  confidence match_confidence not null default 'none',
  status line_item_status not null default 'unresolved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_receipt_line_items_receipt on receipt_line_items (receipt_id);
create index idx_receipt_line_items_matched on receipt_line_items (matched_item_id);

-- ============================================================
-- INVENTORY TRANSACTIONS (Ledger — append-only)
-- ============================================================

create table inventory_transactions (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  transaction_type transaction_type not null default 'purchase',
  quantity numeric not null,           -- positive = in, negative = out
  unit unit_type not null,
  unit_cost numeric(10, 2),
  total_cost numeric(10, 2),
  input_method input_method not null,
  source text,                         -- 'supplier', 'grocery', 'unknown', or supplier name
  receipt_id uuid references receipts(id) on delete set null,
  receipt_line_item_id uuid references receipt_line_items(id) on delete set null,
  notes text,
  raw_data jsonb,                      -- OCR payload / extraction trace
  created_at timestamptz not null default now()
);

create index idx_transactions_item on inventory_transactions (inventory_item_id);
create index idx_transactions_created on inventory_transactions (created_at desc);
create index idx_transactions_receipt on inventory_transactions (receipt_id);
create index idx_transactions_type on inventory_transactions (transaction_type);
create index idx_transactions_method on inventory_transactions (input_method);
create unique index idx_transactions_receipt_line_item_unique
  on inventory_transactions (receipt_line_item_id)
  where receipt_line_item_id is not null;

-- ============================================================
-- VIEW: Current inventory levels (computed from ledger)
-- ============================================================

create or replace view inventory_levels as
select
  i.id,
  i.name,
  i.unit,
  i.category_id,
  i.supplier_id,
  i.is_active,
  coalesce(sum(t.quantity), 0) as current_quantity,
  max(t.created_at) as last_transaction_at,
  count(t.id) as transaction_count
from inventory_items i
left join inventory_transactions t on t.inventory_item_id = i.id
group by i.id, i.name, i.unit, i.category_id, i.supplier_id, i.is_active;

-- ============================================================
-- VIEW: Cost history (latest cost per item)
-- ============================================================

create or replace view item_cost_history as
select distinct on (inventory_item_id)
  inventory_item_id,
  unit_cost,
  total_cost,
  quantity,
  source,
  input_method,
  created_at
from inventory_transactions
where transaction_type = 'purchase' and unit_cost is not null
order by inventory_item_id, created_at desc;

-- ============================================================
-- FUNCTION: updated_at trigger
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_inventory_items
  before update on inventory_items
  for each row execute function update_updated_at();

create trigger set_updated_at_receipts
  before update on receipts
  for each row execute function update_updated_at();

create trigger set_updated_at_receipt_line_items
  before update on receipt_line_items
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table categories enable row level security;
alter table suppliers enable row level security;
alter table inventory_items enable row level security;
alter table item_barcodes enable row level security;
alter table item_aliases enable row level security;
alter table receipts enable row level security;
alter table receipt_line_items enable row level security;
alter table inventory_transactions enable row level security;

-- For MVP: allow all operations for authenticated users.
-- In production, add org_id column and scope policies per organization.

create policy "Authenticated users full access" on categories
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on suppliers
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on inventory_items
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on item_barcodes
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on item_aliases
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on receipts
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on receipt_line_items
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on inventory_transactions
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- SHOPPING MODE (draft-first purchase staging)
-- ============================================================

alter type input_method add value if not exists 'shopping';

create type shopping_session_status as enum (
  'draft',
  'reconciling',
  'ready',
  'committed',
  'cancelled'
);

create type shopping_item_origin as enum (
  'staged',
  'receipt'
);

create type shopping_reconciliation_status as enum (
  'pending',
  'exact',
  'quantity_mismatch',
  'price_mismatch',
  'missing_on_receipt',
  'extra_on_receipt'
);

create type shopping_item_resolution as enum (
  'pending',
  'accept_staged',
  'accept_receipt',
  'skip'
);

create table shopping_sessions (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id) on delete set null,
  google_place_id text,
  store_name text,
  store_address text,
  store_lat numeric(10, 7),
  store_lng numeric(10, 7),
  receipt_id uuid unique references receipts(id) on delete set null,
  status shopping_session_status not null default 'draft',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  staged_subtotal numeric(10, 2),
  receipt_subtotal numeric(10, 2),
  tax_total numeric(10, 2),
  receipt_total numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shopping_sessions_status on shopping_sessions(status);
create index idx_shopping_sessions_supplier on shopping_sessions(supplier_id);
create index idx_shopping_sessions_place on shopping_sessions(google_place_id);

create table shopping_session_items (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references shopping_sessions(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  receipt_line_item_id uuid references receipt_line_items(id) on delete set null,
  origin shopping_item_origin not null default 'staged',
  raw_name text not null,
  normalized_name text not null,
  quantity numeric not null default 1,
  unit unit_type not null default 'each',
  staged_unit_price numeric(10, 2),
  staged_line_total numeric(10, 2),
  receipt_quantity numeric,
  receipt_unit_price numeric(10, 2),
  receipt_line_total numeric(10, 2),
  delta_quantity numeric,
  delta_price numeric(10, 2),
  reconciliation_status shopping_reconciliation_status not null default 'pending',
  resolution shopping_item_resolution not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shopping_session_items_session on shopping_session_items(session_id);
create index idx_shopping_session_items_inventory on shopping_session_items(inventory_item_id);
create index idx_shopping_session_items_recon_status on shopping_session_items(reconciliation_status);

alter table inventory_transactions
  add column if not exists shopping_session_id uuid references shopping_sessions(id) on delete set null;

create index if not exists idx_transactions_shopping_session on inventory_transactions(shopping_session_id);

create trigger set_updated_at_shopping_sessions
  before update on shopping_sessions
  for each row execute function update_updated_at();

create trigger set_updated_at_shopping_session_items
  before update on shopping_session_items
  for each row execute function update_updated_at();

alter table shopping_sessions enable row level security;
alter table shopping_session_items enable row level security;

create policy "Authenticated users full access" on shopping_sessions
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on shopping_session_items
  for all using (auth.role() = 'authenticated');

alter table suppliers
  add column if not exists google_place_id text unique,
  add column if not exists formatted_address text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7);
