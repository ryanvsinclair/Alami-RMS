-- Google Places canonical store identity for shopping sessions.
alter table "suppliers"
  add column if not exists "google_place_id" text,
  add column if not exists "formatted_address" text,
  add column if not exists "latitude" decimal(10,7),
  add column if not exists "longitude" decimal(10,7);

create unique index if not exists "suppliers_google_place_id_key"
  on "suppliers" ("google_place_id")
  where "google_place_id" is not null;

alter table "shopping_sessions"
  add column if not exists "google_place_id" text,
  add column if not exists "store_name" text,
  add column if not exists "store_address" text,
  add column if not exists "store_lat" decimal(10,7),
  add column if not exists "store_lng" decimal(10,7);

create index if not exists "shopping_sessions_google_place_id_idx"
  on "shopping_sessions" ("google_place_id");
