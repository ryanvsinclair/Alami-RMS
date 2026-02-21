-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "FinancialSource" AS ENUM ('godaddy_pos', 'uber_eats', 'doordash', 'shopping', 'manual');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "source" "FinancialSource" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "external_id" TEXT,
    "metadata" JSONB,
    "shopping_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sync_logs" (
    "id" TEXT NOT NULL,
    "source" "FinancialSource" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),

    CONSTRAINT "external_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_source_external_id_key"
    ON "financial_transactions"("source", "external_id");

-- CreateIndex
CREATE INDEX "financial_transactions_type_occurred_at_idx"
    ON "financial_transactions"("type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "financial_transactions_source_occurred_at_idx"
    ON "financial_transactions"("source", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "financial_transactions_occurred_at_idx"
    ON "financial_transactions"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "external_sync_logs_source_started_at_idx"
    ON "external_sync_logs"("source", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "financial_transactions"
    ADD CONSTRAINT "financial_transactions_shopping_session_id_fkey"
    FOREIGN KEY ("shopping_session_id") REFERENCES "shopping_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
