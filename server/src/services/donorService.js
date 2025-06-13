// server/src/services/donorService.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Create a new donor linked to a foundation
 */
export async function createDonor({ foundationId, donorData }) {
  return prisma.donor.create({
    data: {
      ...donorData,
      foundation: { connect: { id: foundationId } },
    },
  });
}

/**
 * Get all non-deleted donors for a foundation, with optional filters
 */
export async function getDonors({
  foundationId,
  pageNo = 0,
  pageSize = 20,
  filters = {},
}) {
  const where = { foundationId, isDeleted: false, ...filters };

  const total = await prisma.donor.count({ where });

  const donors = await prisma.donor.findMany({
    where,
    orderBy: { createdAt: "asc" },
    skip: pageNo * pageSize,
    take: pageSize,
  });

  return { donors, total };
}

/**
 * Get a single donor by ID, ensuring it belongs to the foundation and is not deleted
 */
export async function getDonorById({ foundationId, donorId }) {
  return prisma.donor.findFirst({
    where: {
      id: donorId,
      foundationId,
      isDeleted: false,
    },
  });
}

/**
 * Update donor data, only if it's not deleted
 */
export async function updateDonor({ foundationId, donorId, donorData }) {
  const existing = await getDonorById({ foundationId, donorId });
  if (!existing) throw new Error("Donor not found or already deleted");

  // Ensure foundationId is not accidentally changed
  const { foundationId: _, ...safeData } = donorData;

  return prisma.donor.update({
    where: { id: donorId },
    data: safeData,
  });
}

/**
 * Soft delete donor — marks as deleted instead of removing from DB
 */
export async function deleteDonor({ foundationId, donorId }) {
  const existing = await getDonorById({ foundationId, donorId });
  if (!existing) throw new Error("Donor not found or already deleted");

  return prisma.donor.update({
    where: { id: donorId },
    data: { isDeleted: true },
  });
}

export async function isExistByPan(foundationId, pan) {
  return prisma.donor.findFirst({
    where: {
      foundationId: foundationId,
      pan: {
        equals: pan.trim().toUpperCase(),
        mode: "insensitive",
      },
      isDeleted: false,
    },
  });
}

export async function getDonationsByDonorId(foundationId, donorId) {
  return prisma.donation.findMany({
    where: {
      foundationId: foundationId,
      donorId: donorId,
      isDeleted: false,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      donor: true,
    },
  });
}

export async function getTrashedDonors(foundationId) {
  return prisma.donor.findMany({
    where: { foundationId, isDeleted: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function restoreDonor({ foundationId, donorId }) {
  const existing = await prisma.donor.findFirst({
    where: { id: donorId, foundationId, isDeleted: true },
  });
  if (!existing) throw new Error("Donor not found or not deleted");

  return prisma.donor.update({
    where: { id: donorId },
    data: { isDeleted: false },
  });
}

export async function countDonors(foundationId) {
  return prisma.donor.count({ where: { foundationId, isDeleted: false } });
}
