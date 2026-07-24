-- Transfers & Fixed Deposits. Adds internal money movement between the
-- foundation's own buckets (cash <-> bank) plus a Fixed Deposit register
-- (BANK_TO_FD parks money, FD_TO_BANK returns it with interest). Transfer
-- ledger legs reuse the existing Transaction table via the polymorphic
-- (entityType="Transfer", entityId) pointer, so no change to Transaction is
-- needed here. Both tables start empty (no backfill).

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('CASH_TO_BANK', 'BANK_TO_CASH', 'BANK_TO_FD', 'FD_TO_BANK');
CREATE TYPE "FixedDepositStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable FixedDeposit
CREATE TABLE "FixedDeposit" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "label" TEXT NOT NULL,
    "category" "BankAccountCategory" NOT NULL,
    "bankName" TEXT,
    "receiptNumber" TEXT,
    "principal" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(5,2),
    "openedOn" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3),
    "sourceBankAccountId" TEXT NOT NULL,
    "status" "FixedDepositStatus" NOT NULL DEFAULT 'ACTIVE',
    "returnAmount" DECIMAL(14,2),
    "closedOn" TIMESTAMP(3),
    "closedToBankAccountId" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',
    CONSTRAINT "FixedDeposit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FixedDeposit_foundationId_isDeleted_idx" ON "FixedDeposit"("foundationId", "isDeleted");
CREATE INDEX "FixedDeposit_foundationId_status_idx" ON "FixedDeposit"("foundationId", "status");
CREATE INDEX "FixedDeposit_foundationId_sourceBankAccountId_idx" ON "FixedDeposit"("foundationId", "sourceBankAccountId");

-- CreateTable Transfer
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "kind" "TransferKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "fromBankAccountId" TEXT,
    "toBankAccountId" TEXT,
    "fixedDepositId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',
    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transfer_foundationId_isDeleted_idx" ON "Transfer"("foundationId", "isDeleted");
CREATE INDEX "Transfer_foundationId_kind_isDeleted_idx" ON "Transfer"("foundationId", "kind", "isDeleted");
CREATE INDEX "Transfer_foundationId_occurredAt_idx" ON "Transfer"("foundationId", "occurredAt");
CREATE INDEX "Transfer_fixedDepositId_idx" ON "Transfer"("fixedDepositId");

-- AddForeignKey FixedDeposit
ALTER TABLE "FixedDeposit"
    ADD CONSTRAINT "FixedDeposit_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedDeposit"
    ADD CONSTRAINT "FixedDeposit_financialYearId_fkey"
    FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedDeposit"
    ADD CONSTRAINT "FixedDeposit_sourceBankAccountId_fkey"
    FOREIGN KEY ("sourceBankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedDeposit"
    ADD CONSTRAINT "FixedDeposit_closedToBankAccountId_fkey"
    FOREIGN KEY ("closedToBankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Transfer
ALTER TABLE "Transfer"
    ADD CONSTRAINT "Transfer_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer"
    ADD CONSTRAINT "Transfer_financialYearId_fkey"
    FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer"
    ADD CONSTRAINT "Transfer_fromBankAccountId_fkey"
    FOREIGN KEY ("fromBankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer"
    ADD CONSTRAINT "Transfer_toBankAccountId_fkey"
    FOREIGN KEY ("toBankAccountId") REFERENCES "BankAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer"
    ADD CONSTRAINT "Transfer_fixedDepositId_fkey"
    FOREIGN KEY ("fixedDepositId") REFERENCES "FixedDeposit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
