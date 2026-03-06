-- Migration: recurring_bills
-- Adds RecurringBill and RecurringBillOccurrence models, new enums, and
-- extends FinancialSource with recurring_bill.

-- New enum: RecurringBillCategory
CREATE TYPE "RecurringBillCategory" AS ENUM (
  'subscription',
  'utility',
  'rent',
  'insurance',
  'loan',
  'payroll',
  'marketing',
  'software',
  'other'
);

-- New enum: RecurrenceInterval
CREATE TYPE "RecurrenceInterval" AS ENUM (
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually'
);

-- New enum: RecurringBillOccurrenceStatus
CREATE TYPE "RecurringBillOccurrenceStatus" AS ENUM (
  'pending',
  'confirmed',
  'skipped'
);

-- Extend FinancialSource enum with recurring_bill
ALTER TYPE "FinancialSource" ADD VALUE 'recurring_bill';

-- Table: recurring_bills
CREATE TABLE "recurring_bills" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id"    TEXT         NOT NULL,
  "name"           TEXT         NOT NULL,
  "amount"         DECIMAL(10,2) NOT NULL,
  "category"       "RecurringBillCategory" NOT NULL,
  "recurrence"     "RecurrenceInterval"    NOT NULL,
  "recurrence_day" INTEGER,
  "next_due_at"    TIMESTAMP(3) NOT NULL,
  "started_at"     TIMESTAMP(3) NOT NULL,
  "is_active"      BOOLEAN      NOT NULL DEFAULT true,
  "notes"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_bills_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

CREATE INDEX "recurring_bills_business_id_idx"
  ON "recurring_bills"("business_id");

CREATE INDEX "recurring_bills_business_id_is_active_next_due_at_idx"
  ON "recurring_bills"("business_id", "is_active", "next_due_at" ASC);

-- Table: recurring_bill_occurrences
CREATE TABLE "recurring_bill_occurrences" (
  "id"                       TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id"              TEXT         NOT NULL,
  "bill_id"                  TEXT         NOT NULL,
  "due_at"                   TIMESTAMP(3) NOT NULL,
  "status"                   "RecurringBillOccurrenceStatus" NOT NULL DEFAULT 'pending',
  "confirmed_at"             TIMESTAMP(3),
  "financial_transaction_id" TEXT,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recurring_bill_occurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_bill_occurrences_bill_id_fkey"
    FOREIGN KEY ("bill_id") REFERENCES "recurring_bills"("id") ON DELETE CASCADE,
  CONSTRAINT "recurring_bill_occurrences_financial_transaction_id_fkey"
    FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL,
  CONSTRAINT "recurring_bill_occurrences_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "recurring_bill_occurrences_financial_transaction_id_key"
  ON "recurring_bill_occurrences"("financial_transaction_id");

CREATE INDEX "recurring_bill_occurrences_business_id_idx"
  ON "recurring_bill_occurrences"("business_id");

CREATE INDEX "recurring_bill_occurrences_business_id_status_due_at_idx"
  ON "recurring_bill_occurrences"("business_id", "status", "due_at" ASC);

CREATE INDEX "recurring_bill_occurrences_bill_id_due_at_idx"
  ON "recurring_bill_occurrences"("bill_id", "due_at" DESC);
