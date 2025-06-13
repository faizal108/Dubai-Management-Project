/*
  Warnings:

  - You are about to drop the column `address3` on the `Donor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pan]` on the table `Donor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city` to the `Donor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Donor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Donor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Donor` table without a default value. This is not possible if the table is not empty.
  - Made the column `address2` on table `Donor` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Donor" DROP COLUMN "address3",
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "address2" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Donor_pan_key" ON "Donor"("pan");
