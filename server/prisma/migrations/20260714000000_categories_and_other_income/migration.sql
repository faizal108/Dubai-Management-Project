-- Unified Category (kind: INCOME | EXPENSE | OTHER_INCOME) + in-kind Other Income.
-- The existing ExpenseCategory rows are migrated into Category as kind=EXPENSE,
-- PRESERVING their ids so Expense.categoryId keeps resolving. Then the Expense
-- FK is repointed to Category and ExpenseCategory is dropped. Adds an optional
-- income category on Donation, and the OtherIncome table (never touches the
-- ledger).

-- 1. Enum + Category table.
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE', 'OTHER_INCOME');

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Category_foundationId_kind_isDeleted_idx" ON "Category"("foundationId", "kind", "isDeleted");
CREATE INDEX "Category_foundationId_name_idx" ON "Category"("foundationId", "name");
-- Unique name per (foundation, kind) among active rows only.
CREATE UNIQUE INDEX "Category_foundationId_kind_name_key"
    ON "Category"("foundationId", "kind", "name")
    WHERE "isDeleted" = false;

ALTER TABLE "Category"
    ADD CONSTRAINT "Category_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Migrate ExpenseCategory rows into Category (kind=EXPENSE), keeping ids.
INSERT INTO "Category" (
    "id", "foundationId", "kind", "name", "description",
    "isDeleted", "deletedAt", "deletedBy",
    "createdAt", "createdBy", "updatedAt", "updatedBy"
)
SELECT
    "id", "foundationId", 'EXPENSE', "name", "description",
    "isDeleted", "deletedAt", "deletedBy",
    "createdAt", "createdBy", "updatedAt", "updatedBy"
FROM "ExpenseCategory";

-- 3. Repoint Expense.categoryId FK from ExpenseCategory to Category. The ids
--    were preserved, so existing Expense.categoryId values stay valid.
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_categoryId_fkey";
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Drop the old table.
DROP TABLE "ExpenseCategory";

-- 5. Optional income category on Donation (kind=INCOME). Named incomeCategoryId
--    to avoid clashing with the existing GENERAL/CSR `category` enum column.
ALTER TABLE "Donation" ADD COLUMN "incomeCategoryId" TEXT;
CREATE INDEX "Donation_foundationId_incomeCategoryId_isDeleted_idx"
    ON "Donation"("foundationId", "incomeCategoryId", "isDeleted");
ALTER TABLE "Donation"
    ADD CONSTRAINT "Donation_incomeCategoryId_fkey"
    FOREIGN KEY ("incomeCategoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. OtherIncome (in-kind receipts). No bankAccountId / no ledger link.
CREATE TABLE "OtherIncome" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "categoryId" TEXT,
    "donorId" TEXT,
    "donorNameSnapshot" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "receivedOn" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',
    CONSTRAINT "OtherIncome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtherIncome_foundationId_isDeleted_idx" ON "OtherIncome"("foundationId", "isDeleted");
CREATE INDEX "OtherIncome_foundationId_receivedOn_idx" ON "OtherIncome"("foundationId", "receivedOn");
CREATE INDEX "OtherIncome_foundationId_categoryId_isDeleted_idx" ON "OtherIncome"("foundationId", "categoryId", "isDeleted");
CREATE INDEX "OtherIncome_foundationId_createdById_isDeleted_idx" ON "OtherIncome"("foundationId", "createdById", "isDeleted");
CREATE INDEX "OtherIncome_foundationId_financialYearId_isDeleted_idx" ON "OtherIncome"("foundationId", "financialYearId", "isDeleted");

ALTER TABLE "OtherIncome"
    ADD CONSTRAINT "OtherIncome_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtherIncome"
    ADD CONSTRAINT "OtherIncome_financialYearId_fkey"
    FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtherIncome"
    ADD CONSTRAINT "OtherIncome_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtherIncome"
    ADD CONSTRAINT "OtherIncome_donorId_fkey"
    FOREIGN KEY ("donorId") REFERENCES "Donor"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OtherIncome"
    ADD CONSTRAINT "OtherIncome_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OtherIncome"
    ADD CONSTRAINT "OtherIncome_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
