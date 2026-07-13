-- Phase 7 of the platform: expense tracking against categories and (optionally)
-- activities. Payment mode is deferred to a later migration once the accepted
-- domain modes are agreed. Category names are unique per foundation among
-- *active* rows only — the partial unique index below leaves soft-deleted
-- rows out so operators can re-use a label after archiving one.

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseCategory_foundationId_isDeleted_idx" ON "ExpenseCategory"("foundationId", "isDeleted");

-- CreateIndex
CREATE INDEX "ExpenseCategory_foundationId_name_idx" ON "ExpenseCategory"("foundationId", "name");

-- CreateIndex (partial unique — only active rows are constrained)
CREATE UNIQUE INDEX "ExpenseCategory_foundationId_name_key"
    ON "ExpenseCategory"("foundationId", "name")
    WHERE "isDeleted" = false;

-- AddForeignKey
ALTER TABLE "ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "activityId" TEXT,
    "createdById" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidTo" TEXT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "referenceNo" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_foundationId_isDeleted_idx" ON "Expense"("foundationId", "isDeleted");

-- CreateIndex
CREATE INDEX "Expense_foundationId_paidOn_idx" ON "Expense"("foundationId", "paidOn");

-- CreateIndex
CREATE INDEX "Expense_foundationId_categoryId_isDeleted_idx" ON "Expense"("foundationId", "categoryId", "isDeleted");

-- CreateIndex
CREATE INDEX "Expense_foundationId_activityId_isDeleted_idx" ON "Expense"("foundationId", "activityId", "isDeleted");

-- CreateIndex
CREATE INDEX "Expense_foundationId_createdById_isDeleted_idx" ON "Expense"("foundationId", "createdById", "isDeleted");

-- AddForeignKey
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
