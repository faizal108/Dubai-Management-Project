-- CreateEnum
-- DonationCategory flags GENERAL vs CSR contributions for downstream reporting
-- and 80G segmentation. GENERAL is the platform-wide default.
CREATE TYPE "DonationCategory" AS ENUM ('GENERAL', 'CSR');

-- AlterTable: Donation.category
-- Backfills existing rows to GENERAL via the column default. Non-nullable on
-- the schema side so the application can rely on a category always being set.
ALTER TABLE "Donation"
  ADD COLUMN "category" "DonationCategory" NOT NULL DEFAULT 'GENERAL';
