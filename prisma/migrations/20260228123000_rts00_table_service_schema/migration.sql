CREATE TYPE "KitchenOrderItemStatus" AS ENUM (
  'pending',
  'preparing',
  'ready_to_serve',
  'served',
  'cancelled'
);

CREATE TABLE "dining_tables" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "business_id" TEXT NOT NULL,
  "table_number" TEXT NOT NULL,
  "qr_token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dining_tables_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "dining_tables_qr_token_key" ON "dining_tables"("qr_token");
CREATE UNIQUE INDEX "dining_tables_business_id_table_number_key" ON "dining_tables"("business_id", "table_number");
CREATE INDEX "dining_tables_business_id_idx" ON "dining_tables"("business_id");

CREATE TABLE "menu_categories" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "business_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_seeded" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menu_categories_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "menu_categories_business_id_name_key" ON "menu_categories"("business_id", "name");
CREATE INDEX "menu_categories_business_id_sort_order_idx" ON "menu_categories"("business_id", "sort_order");

CREATE TABLE "menu_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "business_id" TEXT NOT NULL,
  "category_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menu_items_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "menu_items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "menu_items_business_id_idx" ON "menu_items"("business_id");
CREATE INDEX "menu_items_category_id_idx" ON "menu_items"("category_id");
CREATE INDEX "menu_items_business_id_is_available_sort_order_idx" ON "menu_items"("business_id", "is_available", "sort_order");

CREATE TABLE "table_sessions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "business_id" TEXT NOT NULL,
  "dining_table_id" TEXT NOT NULL,
  "party_size" INTEGER,
  "notes" TEXT,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "table_sessions_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "table_sessions_dining_table_id_fkey"
    FOREIGN KEY ("dining_table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "table_sessions_business_id_idx" ON "table_sessions"("business_id");
CREATE INDEX "table_sessions_dining_table_id_idx" ON "table_sessions"("dining_table_id");
CREATE INDEX "table_sessions_business_id_opened_at_idx" ON "table_sessions"("business_id", "opened_at" DESC);

-- Enforce one active session per table (active = closed_at IS NULL).
CREATE UNIQUE INDEX "table_sessions_dining_table_id_active_key"
  ON "table_sessions"("dining_table_id")
  WHERE "closed_at" IS NULL;

CREATE TABLE "kitchen_orders" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "business_id" TEXT NOT NULL,
  "table_session_id" TEXT NOT NULL,
  "notes" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "due_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kitchen_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kitchen_orders_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "kitchen_orders_table_session_id_fkey"
    FOREIGN KEY ("table_session_id") REFERENCES "table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "kitchen_orders_table_session_id_key" ON "kitchen_orders"("table_session_id");
CREATE INDEX "kitchen_orders_business_id_idx" ON "kitchen_orders"("business_id");
CREATE INDEX "kitchen_orders_confirmed_at_idx" ON "kitchen_orders"("confirmed_at" ASC);
CREATE INDEX "kitchen_orders_due_at_idx" ON "kitchen_orders"("due_at" ASC);
CREATE INDEX "kitchen_orders_closed_at_idx" ON "kitchen_orders"("closed_at");

CREATE TABLE "kitchen_order_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "business_id" TEXT NOT NULL,
  "kitchen_order_id" TEXT NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "status" "KitchenOrderItemStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kitchen_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kitchen_order_items_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "kitchen_order_items_kitchen_order_id_fkey"
    FOREIGN KEY ("kitchen_order_id") REFERENCES "kitchen_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "kitchen_order_items_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "kitchen_order_items_business_id_idx" ON "kitchen_order_items"("business_id");
CREATE INDEX "kitchen_order_items_kitchen_order_id_idx" ON "kitchen_order_items"("kitchen_order_id");
CREATE INDEX "kitchen_order_items_menu_item_id_idx" ON "kitchen_order_items"("menu_item_id");
CREATE INDEX "kitchen_order_items_status_idx" ON "kitchen_order_items"("status");
