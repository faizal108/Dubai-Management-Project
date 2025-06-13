/*
  Warnings:

  - You are about to drop the column `remarks` on the `Donation` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Donation` table without a default value. This is not possible if the table is not empty.
  - Made the column `bankName` on table `Donation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `utr` on table `Donation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ifsc` on table `Donation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Donation" DROP COLUMN "remarks",
ADD COLUMN     "donationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "donationReceived" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transactionDate" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "bankName" SET NOT NULL,
ALTER COLUMN "utr" SET NOT NULL,
ALTER COLUMN "ifsc" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Donation_foundationId_donorId_idx" ON "Donation"("foundationId", "donorId");

-- CreateIndex
CREATE INDEX "Donation_donorId_isDeleted_idx" ON "Donation"("donorId", "isDeleted");
