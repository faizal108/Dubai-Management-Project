/*
  Warnings:

  - The `donationReceived` column on the `Donation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[pan]` on the table `Foundation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdBy` to the `Donation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Donation` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Donation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `createdBy` to the `Donor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Donor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `Foundation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pan` to the `Foundation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Foundation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `Foundation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('CASH', 'CHEQUE', 'ONLINE');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'RECEIVED');

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "isPrinted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedBy" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "DonationType" NOT NULL,
DROP COLUMN "donationReceived",
ADD COLUMN     "donationReceived" "DonationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Donor" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "updatedBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Foundation" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "pan" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Foundation_pan_key" ON "Foundation"("pan");
