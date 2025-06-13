// server/src/services/donationService.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Create a new donation under a foundation.
 * Validates that donorId belongs to the same foundation and is not deleted.
 * Ensures mandatory fields donationIdare present in donationData.
 */
export async function createDonation({ foundationId, payload }) {
  // 1. Verify donor exists, belongs to this foundation, and is not deleted
  const donor = await prisma.donor.findFirst({
    where: {
      id: payload.donorId,
      foundationId,
      isDeleted: false,
    },
  });
  if (!donor) {
    throw new Error("Donor not found or does not belong to this foundation");
  }

  // 2. Enforce transactionDate if donationReceived === "RECEIVED"
  if (payload.donationReceived === "RECEIVED" && !payload.transactionDate) {
    throw new Error(
      "transactionDate is required when donation is marked RECEIVED"
    );
  }

  // 3. Create the donation
  return prisma.donation.create({
    data: {
      donor: { connect: { id: payload.donorId } },
      amount: parseFloat(payload.amount),
      type: payload.type,
      bankName: payload.bankName,
      utr: payload.utr,
      ifsc: payload.ifsc,
      donationDate: payload.donationDate || undefined, // defaults to now() if omitted
      transactionDate: payload.transactionDate || null,
      donationReceived: payload.donationReceived || "PENDING",
      foundation: { connect: { id: foundationId } },
    },
    include: {
      donor: true,
    },
  });
}

/**
 * Get all non-deleted donations for a foundation, ordered by createdAt desc.
 */
// src/services/donationService.js
export async function getDonations({
  foundationId,
  pageNo = 0,
  pageSize = 20,
}) {
  const where = {
    foundationId,
    isDeleted: false,
  };

  // 1) Total count (ignoring pagination)
  const total = await prisma.donation.count({ where });

  // 2) Fetch this page
  const donations = await prisma.donation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pageNo * pageSize,
    take: pageSize,
    include: {
      donor: true,
    },
  });

  return { total, donations };
}

/**
 * Get a single donation by ID (ensuring it belongs to the foundation & isn't deleted).
 */
export async function getDonationById({ foundationId, donationId }) {
  return prisma.donation.findFirst({
    where: {
      id: donationId,
      foundationId,
      isDeleted: false,
    },
    include: {
      donor: true,
    },
  });
}

/**
 * Update donation data (only if it exists, belongs to foundation, and isn't deleted).
 * Validates the same transaction‐date rule as create.
 */
export async function updateDonation({
  foundationId,
  donationId,
  donationData,
}) {
  // 1. Verify donation exists & belongs to this foundation
  const existing = await getDonationById({ foundationId, donationId });
  if (!existing) {
    throw new Error("Donation not found or is deleted");
  }

  // 2. If donationReceived === "RECEIVED", transactionDate must be provided
  if (
    donationData.donationReceived === "RECEIVED" &&
    !donationData.transactionDate
  ) {
    throw new Error(
      "transactionDate is required when donation is marked RECEIVED"
    );
  }

  // 3. Prevent changing foundationId or donorId in update payload (immutable)
  const {
    foundationId: _omit1,
    donorId: _omit2,
    createdAt: _omit3,
    updatedAt: _omit4,
    isDeleted: _omit5,
    ...safeData
  } = donationData;

  return prisma.donation.update({
    where: { id: donationId },
    data: {
      ...safeData,
    },
    include: {
      donor: true,
    },
  });
}

/**
 * Soft delete: mark isDeleted = true rather than removing.
 */
export async function deleteDonation({ foundationId, donationId }) {
  // 1. Verify donation exists & belongs to this foundation
  const existing = await getDonationById({ foundationId, donationId });
  if (!existing) {
    throw new Error("Donation not found or is deleted");
  }

  // 2. Soft-delete
  return prisma.donation.update({
    where: { id: donationId },
    data: { isDeleted: true },
  });
}

/**
 * Search donations by donor fullName or PAN (case-insensitive) within this foundation.
 * Only returns non-deleted donations.
 */
export async function searchDonations({ foundationId, fullName, pan }) {
  if (!fullName && !pan) {
    throw new Error("At least one of fullName or pan must be provided");
  }

  return prisma.donation.findMany({
    where: {
      foundationId,
      isDeleted: false,
      donor: {
        is: {
          ...(fullName && {
            fullName: { contains: fullName, mode: "insensitive" },
          }),
          ...(pan && { pan: { contains: pan, mode: "insensitive" } }),
        },
      },
    },
    include: {
      donor: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function markPrintedDonation({ foundationId, donationId }) {
  const existing = await getDonationById({ foundationId, donationId });
  if (!existing) return null;

  return prisma.donation.update({
    where: { id: donationId },
    data: { isPrinted: true, updatedAt: new Date() },
    include: { donor: true },
  });
}

export async function countDonations(foundationId) {
  return prisma.donation.count({ where: { foundationId, isDeleted: false } });
}

export async function getTrashedDonations(foundationId) {
  return prisma.donation.findMany({
    where: { foundationId, isDeleted: true },
    orderBy: { updatedAt: "desc" },
    include: { donor: true },
  });
}

export async function restoreDonation({ foundationId, donationId }) {
  const existing = await getDonationById({ foundationId, donationId });
  if (!existing) throw new Error("Not found or not deleted");
  return prisma.donation.update({
    where: { id: donationId },
    data: { isDeleted: false },
    include: { donor: true },
  });
}
