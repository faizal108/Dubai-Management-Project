-- Phase 1 of the Activities module: narrative logbook tied to a Foundation.
-- Money tracking (Budget / Transaction) lands in a follow-up migration with
-- foreign keys onto Activity.id.

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_foundationId_isDeleted_idx" ON "Activity"("foundationId", "isDeleted");

-- CreateIndex
CREATE INDEX "Activity_foundationId_status_idx" ON "Activity"("foundationId", "status");

-- CreateIndex
CREATE INDEX "Activity_foundationId_startDate_idx" ON "Activity"("foundationId", "startDate");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_foundationId_fkey" FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
