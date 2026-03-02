-- Add running-balance snapshot field for financial transactions.
-- Expense rows now persist the account balance immediately after posting.

ALTER TABLE "financial_transactions"
ADD COLUMN "balance_after" DECIMAL(12,2);

