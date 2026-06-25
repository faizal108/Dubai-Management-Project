-- AlterEnum
-- Adds the UPI value to the DonationType enum. Non-destructive; existing rows
-- continue to validate against the enum after the change.
ALTER TYPE "DonationType" ADD VALUE 'UPI';

-- AlterTable: Foundation.cashLimit + WhatsApp Business configuration
-- cashLimit defaults to 2000 INR (§269ST cap is 2,00,000 but the product
-- default is conservative — admins can raise it via Settings → Organization).
ALTER TABLE "Foundation"
  ADD COLUMN "cashLimit" DECIMAL(14,2) NOT NULL DEFAULT 2000,
  ADD COLUMN "hasWhatsappBusiness" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappBusinessNumber" TEXT;

-- AlterTable: Donation WhatsApp receipt tracking
-- whatsappOptIn captures donor consent at create time. whatsappSentAt /
-- whatsappError reflect the most recent delivery attempt by the notifier.
ALTER TABLE "Donation"
  ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappSentAt" TIMESTAMP(3),
  ADD COLUMN "whatsappError" TEXT;
