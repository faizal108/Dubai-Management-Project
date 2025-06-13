-- AlterTable
ALTER TABLE "Donation" ALTER COLUMN "createdBy" SET DEFAULT 'system',
ALTER COLUMN "updatedBy" SET DEFAULT 'system';

-- AlterTable
ALTER TABLE "Donor" ALTER COLUMN "createdBy" SET DEFAULT 'system',
ALTER COLUMN "updatedBy" SET DEFAULT 'system';

-- AlterTable
ALTER TABLE "Foundation" ALTER COLUMN "createdBy" SET DEFAULT 'system',
ALTER COLUMN "updatedBy" SET DEFAULT 'system';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "createdBy" SET DEFAULT 'system',
ALTER COLUMN "updatedBy" SET DEFAULT 'system';
