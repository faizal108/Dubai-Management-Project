-- Foundation branding & receipt profile. Adds admin-editable columns used to
-- brand the donation receipt: logo + signature/stamp images (stored as base64
-- data URLs or http URLs in TEXT columns) and receipt profile text. logoUrl
-- already exists; the rest are new. All nullable so existing rows are valid.

ALTER TABLE "Foundation" ADD COLUMN "signatureUrl" TEXT;
ALTER TABLE "Foundation" ADD COLUMN "receiptName" TEXT;
ALTER TABLE "Foundation" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "Foundation" ADD COLUMN "email" TEXT;
ALTER TABLE "Foundation" ADD COLUMN "address" TEXT;
