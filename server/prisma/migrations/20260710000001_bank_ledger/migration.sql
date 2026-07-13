-- Cut B — Banking & Ledger. Adds BankAccount (per-foundation buckets with
-- CASH / UPI / BANK category and a per-category isDefault swap) and the
-- append-only Transaction ledger keyed to donations + expenses. Adds
-- nullable bankAccountId FKs on Donation and Expense so pre-ledger rows
-- remain valid; new writes require the column at the service layer.

-- CreateEnum
CREATE TYPE "BankAccountCategory" AS ENUM ('CASH', 'UPI', 'BANK');
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable BankAccount
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "BankAccountCategory" NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "upiId" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankAccount_foundationId_isDeleted_idx" ON "BankAccount"("foundationId", "isDeleted");
CREATE INDEX "BankAccount_foundationId_category_isDeleted_idx" ON "BankAccount"("foundationId", "category", "isDeleted");
CREATE INDEX "BankAccount_foundationId_isDefault_idx" ON "BankAccount"("foundationId", "isDefault");

-- At most one active default per (foundationId, category).
CREATE UNIQUE INDEX "BankAccount_default_per_category_key"
    ON "BankAccount"("foundationId", "category")
    WHERE "isDefault" = true AND "isDeleted" = false;

ALTER TABLE "BankAccount"
    ADD CONSTRAINT "BankAccount_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable Transaction (append-only ledger). No isDeleted / updatedAt —
-- reversals are new rows that reference the original via reversalOf.
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "donationId" TEXT,
    "expenseId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "reversalOf" TEXT,
    "reversedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transaction_foundationId_bankAccountId_occurredAt_idx"
    ON "Transaction"("foundationId", "bankAccountId", "occurredAt");
CREATE INDEX "Transaction_foundationId_financialYearId_occurredAt_idx"
    ON "Transaction"("foundationId", "financialYearId", "occurredAt");
CREATE INDEX "Transaction_foundationId_entityType_entityId_idx"
    ON "Transaction"("foundationId", "entityType", "entityId");
CREATE INDEX "Transaction_donationId_idx" ON "Transaction"("donationId");
CREATE INDEX "Transaction_expenseId_idx" ON "Transaction"("expenseId");

ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_financialYearId_fkey"
    FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable — add nullable bankAccountId FK on Donation + Expense so
-- pre-ledger rows survive. Service layer requires the column on new writes.
ALTER TABLE "Donation" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "Expense"  ADD COLUMN "bankAccountId" TEXT;

CREATE INDEX "Donation_foundationId_bankAccountId_isDeleted_idx"
    ON "Donation"("foundationId", "bankAccountId", "isDeleted");
CREATE INDEX "Expense_foundationId_bankAccountId_isDeleted_idx"
    ON "Expense"("foundationId", "bankAccountId", "isDeleted");

ALTER TABLE "Donation"
    ADD CONSTRAINT "Donation_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Transaction ↔ Donation / Expense FKs live here (Donation + Expense
-- columns exist by now). SET NULL so soft-deleting a donation/expense
-- doesn't cascade into the ledger — entityType/entityId remain the
-- authoritative source pointer.
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_donationId_fkey"
    FOREIGN KEY ("donationId") REFERENCES "Donation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
