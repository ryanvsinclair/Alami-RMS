create type "RestaurantInviteStatus" as enum ('pending', 'accepted', 'revoked', 'expired');

create table "restaurant_invites" (
  "id" text primary key default gen_random_uuid(),
  "restaurant_id" text not null,
  "email" text not null,
  "role" "RestaurantRole" not null default 'staff',
  "token" text not null,
  "invited_by_user_id" text not null,
  "status" "RestaurantInviteStatus" not null default 'pending',
  "expires_at" timestamptz not null,
  "accepted_at" timestamptz,
  "created_at" timestamptz not null default now(),
  constraint "restaurant_invites_token_key" unique ("token"),
  constraint "restaurant_invites_restaurant_id_fkey"
    foreign key ("restaurant_id") references "restaurants"("id") on delete cascade
);

create index "restaurant_invites_restaurant_id_status_idx"
  on "restaurant_invites" ("restaurant_id", "status");
create index "restaurant_invites_email_idx"
  on "restaurant_invites" ("email");
