-- Identifier Tiers refactor + polymorphic Attachment model.
--
-- Business intent:
--   1. Donor.pan becomes optional so we can record "Tier 2" donors (phone-only)
--      alongside the existing "Tier 1" PAN-identified donors.
--   2. Donation.donorId becomes optional so "Tier 3" anonymous donations can
--      exist as stand-alone ledger entries. donorNameSnapshot / donorPhoneSnapshot
--      preserve whatever identifying details were captured at receipt time.
--   3. Donor.phone gains a *partial* unique index (WHERE phone IS NOT NULL) so
--      phone-only donors are dedupable per foundation without blocking the
--      many donors who legitimately have no phone on file.
--   4. Attachment table underpins the pluggable file storage system
--      (local disk in phase 1, S3 later via env-only swap).
--
-- Pre-flight data cleanup (Option B — keep oldest, null the rest):
-- If any donors currently share a phone within the same foundation we cannot
-- add the partial unique index without conflict. Keep the earliest-created
-- row's phone; blank out phone on the duplicates so they degrade to the
-- name-only tier and can be manually reconciled later.

UPDATE "Donor" d
SET "phone" = NULL,
    "updatedAt" = NOW(),
    "updatedBy" = 'migration:identifier-tiers'
FROM (
  SELECT "id"
  FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "foundationId", "phone"
             ORDER BY "createdAt" ASC, "id" ASC
           ) AS rn
    FROM "Donor"
    WHERE "phone" IS NOT NULL
      AND "phone" <> ''
      AND "isDeleted" = false
  ) ranked
  WHERE rn > 1
) dupes
WHERE d."id" = dupes."id";

-- Donor.pan → nullable. Existing composite unique (foundationId, pan) still
-- applies; Postgres treats NULLs as distinct so multiple phone-only donors
-- with NULL pan coexist fine.
ALTER TABLE "Donor" ALTER COLUMN "pan" DROP NOT NULL;

-- Donation.donorId → nullable + FK relaxed to SET NULL so a donor deletion
-- degrades the linked donations to anonymous ledger entries rather than
-- blocking the delete outright.
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_donorId_fkey";
ALTER TABLE "Donation" ALTER COLUMN "donorId" DROP NOT NULL;
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey"
  FOREIGN KEY ("donorId") REFERENCES "Donor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Snapshot columns on Donation. Populated whenever we know the donor's
-- identifying details at donation time; retained even if the linked donor
-- row is later edited/deleted.
ALTER TABLE "Donation" ADD COLUMN "donorNameSnapshot"  TEXT;
ALTER TABLE "Donation" ADD COLUMN "donorPhoneSnapshot" TEXT;

-- Partial unique index on Donor(foundationId, phone). Only enforced when
-- phone is present, so we do not conflict with the many donors who have
-- no phone on record. Prisma cannot express partial unique indexes
-- declaratively — the service layer catches uniqueness collisions and
-- surfaces a friendly 409.
CREATE UNIQUE INDEX "Donor_foundationId_phone_key"
  ON "Donor"("foundationId", "phone")
  WHERE "phone" IS NOT NULL;

-- Non-unique index to accompany the schema-level `@@index([foundationId, phone])`.
-- Postgres uses the partial unique index above for lookups that filter on
-- phone IS NOT NULL, but we still want a covering index for `phone IS NULL`
-- searches from the donor list.
CREATE INDEX "Donor_foundationId_phone_idx"
  ON "Donor"("foundationId", "phone");

-- Attachment table (polymorphic). No FK on entityId — we resolve the target
-- row in the service layer per entityType to keep the model open for future
-- entity types (activity, foundation-branding, tax-cert).
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "foundationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_foundationId_entityType_entityId_isDeleted_idx"
  ON "Attachment"("foundationId", "entityType", "entityId", "isDeleted");

CREATE INDEX "Attachment_foundationId_createdAt_idx"
  ON "Attachment"("foundationId", "createdAt");

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_foundationId_fkey"
  FOREIGN KEY ("foundationId") REFERENCES "Foundation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
