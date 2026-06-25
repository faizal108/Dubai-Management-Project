-- AlterEnum
-- Adds the EMPLOYEE value to the existing Role enum. Non-destructive.
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

-- AlterTable: User.permissions (Postgres native text array, default empty)
ALTER TABLE "User"
  ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Donation.createdById (nullable FK to User)
ALTER TABLE "Donation"
  ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Donation"
  ADD CONSTRAINT "Donation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: ownership scoping for employees
CREATE INDEX "Donation_foundationId_createdById_isDeleted_idx"
  ON "Donation"("foundationId", "createdById", "isDeleted");
