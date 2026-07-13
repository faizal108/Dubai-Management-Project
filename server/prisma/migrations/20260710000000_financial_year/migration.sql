-- Cut A of the Financial Year foundation. Adds the FinancialYear model, a
-- configurable fiscal-year start month on Foundation, and nullable
-- financialYearId FKs on Donation and Expense. The tail of the migration
-- backfills FY rows for every foundation that has existing donation/expense
-- rows, then links each transaction to the FY window that contains its
-- donationDate / paidOn. Post-migration the columns remain nullable so a
-- follow-up migration can NOT NULL them once the backfill is verified in
-- staging and any tenant-specific windows have been reconciled.

-- CreateEnum
CREATE TYPE "FYStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "Foundation" ADD COLUMN "fyStartMonth" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "FinancialYear" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FYStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "FinancialYear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialYear_foundationId_isDeleted_idx" ON "FinancialYear"("foundationId", "isDeleted");
CREATE INDEX "FinancialYear_foundationId_status_idx" ON "FinancialYear"("foundationId", "status");
CREATE INDEX "FinancialYear_foundationId_startDate_idx" ON "FinancialYear"("foundationId", "startDate");

-- Partial unique index on label per foundation (active rows only). Mirrors the
-- pattern used by ExpenseCategory so soft-deleted rows don't block reuse.
CREATE UNIQUE INDEX "FinancialYear_foundationId_label_key"
    ON "FinancialYear"("foundationId", "label")
    WHERE "isDeleted" = false;

-- Guard against overlapping active windows per foundation. Prisma cannot
-- express range-exclusion, so we use a Postgres EXCLUDE constraint on the
-- half-open [startDate, endDate) window. Requires the btree_gist extension.
-- startDate/endDate are TIMESTAMP (no timezone) so we use tsrange, which is
-- IMMUTABLE — tstzrange over plain timestamps depends on session timezone
-- and Postgres rejects it in an index expression (SQLSTATE 42P17).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "FinancialYear"
    ADD CONSTRAINT "FinancialYear_no_overlap"
    EXCLUDE USING gist (
        "foundationId" WITH =,
        tsrange("startDate", "endDate", '[)') WITH &&
    ) WHERE ("isDeleted" = false);

-- AddForeignKey
ALTER TABLE "FinancialYear"
    ADD CONSTRAINT "FinancialYear_foundationId_fkey"
    FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable — nullable financialYearId on Donation + Expense.
ALTER TABLE "Donation" ADD COLUMN "financialYearId" TEXT;
ALTER TABLE "Expense"  ADD COLUMN "financialYearId" TEXT;

CREATE INDEX "Donation_foundationId_financialYearId_isDeleted_idx"
    ON "Donation"("foundationId", "financialYearId", "isDeleted");
CREATE INDEX "Expense_foundationId_financialYearId_isDeleted_idx"
    ON "Expense"("foundationId", "financialYearId", "isDeleted");

ALTER TABLE "Donation"
    ADD CONSTRAINT "Donation_financialYearId_fkey"
    FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_financialYearId_fkey"
    FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill. For each foundation, walk from the earliest transaction date to
-- the latest across donations + expenses, generate one FY window per year at
-- the foundation's configured fyStartMonth, then link each transaction to
-- the window that contains it. All generated rows land in ACTIVE state.
DO $$
DECLARE
    f RECORD;
    min_date DATE;
    max_date DATE;
    cursor_date DATE;
    fy_start DATE;
    fy_end DATE;
    fy_label TEXT;
    fy_id TEXT;
BEGIN
    FOR f IN SELECT "id", "fyStartMonth" FROM "Foundation" WHERE "isDeleted" = false LOOP
        SELECT LEAST(
            (SELECT MIN("donationDate")::date FROM "Donation" WHERE "foundationId" = f."id" AND "isDeleted" = false),
            (SELECT MIN("paidOn")::date       FROM "Expense"  WHERE "foundationId" = f."id" AND "isDeleted" = false)
        ) INTO min_date;
        SELECT GREATEST(
            (SELECT MAX("donationDate")::date FROM "Donation" WHERE "foundationId" = f."id" AND "isDeleted" = false),
            (SELECT MAX("paidOn")::date       FROM "Expense"  WHERE "foundationId" = f."id" AND "isDeleted" = false)
        ) INTO max_date;

        IF min_date IS NULL THEN CONTINUE; END IF;

        -- Snap min_date back to the fyStartMonth of its containing FY.
        IF EXTRACT(MONTH FROM min_date)::int >= f."fyStartMonth" THEN
            cursor_date := make_date(EXTRACT(YEAR FROM min_date)::int, f."fyStartMonth", 1);
        ELSE
            cursor_date := make_date(EXTRACT(YEAR FROM min_date)::int - 1, f."fyStartMonth", 1);
        END IF;

        WHILE cursor_date <= max_date LOOP
            fy_start := cursor_date;
            fy_end   := cursor_date + INTERVAL '1 year';
            IF f."fyStartMonth" = 1 THEN
                fy_label := 'FY ' || EXTRACT(YEAR FROM fy_start)::int;
            ELSE
                fy_label := 'FY ' || EXTRACT(YEAR FROM fy_start)::int || '-'
                            || RIGHT((EXTRACT(YEAR FROM fy_start)::int + 1)::text, 2);
            END IF;

            fy_id := 'cly' || substr(md5(random()::text || clock_timestamp()::text), 1, 22);

            INSERT INTO "FinancialYear"("id", "foundationId", "label", "startDate", "endDate", "status", "createdAt", "updatedAt")
            VALUES (fy_id, f."id", fy_label, fy_start, fy_end, 'ACTIVE', NOW(), NOW());

            UPDATE "Donation" SET "financialYearId" = fy_id
                WHERE "foundationId" = f."id"
                    AND "financialYearId" IS NULL
                    AND "donationDate" >= fy_start
                    AND "donationDate" <  fy_end;
            UPDATE "Expense" SET "financialYearId" = fy_id
                WHERE "foundationId" = f."id"
                    AND "financialYearId" IS NULL
                    AND "paidOn" >= fy_start
                    AND "paidOn" <  fy_end;

            cursor_date := fy_end;
        END LOOP;
    END LOOP;
END $$;
