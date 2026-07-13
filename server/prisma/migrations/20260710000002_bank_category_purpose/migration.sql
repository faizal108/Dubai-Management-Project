-- Refactor: BankAccount.category now names the *purpose* (GENERAL / CSR)
-- so donations route to the matching fund stream regardless of the payment
-- mode they arrived through. Old values (CASH / UPI / BANK) had no data
-- persisted in production yet, so we clear the ledger tables and re-seed
-- the enum in place instead of migrating rows.

-- 1. Clear the ledger + drop the FK references so we can safely rebuild
--    the enum without ON DELETE cascades biting us.
DELETE FROM "Transaction";

UPDATE "Donation" SET "bankAccountId" = NULL WHERE "bankAccountId" IS NOT NULL;
UPDATE "Expense"  SET "bankAccountId" = NULL WHERE "bankAccountId" IS NOT NULL;

DELETE FROM "BankAccount";

-- 2. Rebuild the enum in place. Detach the column, drop the old type,
--    create the new one, and re-attach with a USING cast. Since the table
--    is empty by this point the cast is a no-op.
ALTER TABLE "BankAccount" ALTER COLUMN "category" TYPE TEXT;
DROP TYPE "BankAccountCategory";
CREATE TYPE "BankAccountCategory" AS ENUM ('GENERAL', 'CSR');
ALTER TABLE "BankAccount"
    ALTER COLUMN "category" TYPE "BankAccountCategory"
    USING "category"::"BankAccountCategory";
