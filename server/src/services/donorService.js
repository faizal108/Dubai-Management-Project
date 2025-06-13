// server/src/services/donorService.js
import { PrismaClient } from '@prisma/client';

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
export async function getDonors({ foundationId, filters = {} }) {
  return prisma.donor.findMany({
    where: {
      foundationId,
      isDeleted: false,
      ...filters,
    },
    orderBy: { createdAt: 'asc' },
  });
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
  if (!existing) throw new Error('Donor not found or already deleted');

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
  if (!existing) throw new Error('Donor not found or already deleted');

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
        mode: 'insensitive',
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
      createdAt: 'desc',
    },
    include: {
      donor: true,
    },
  });
}
