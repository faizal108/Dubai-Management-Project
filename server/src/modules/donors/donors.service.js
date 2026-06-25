import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  fullName: true,
  email: true,
  phone: true,
  pan: true,
  address1: true,
  address2: true,
  country: true,
  state: true,
  city: true,
  pincode: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId }) {
  const where = { ...tenantWhere(user, foundationId) };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { pan: { contains: q.toUpperCase() } },
    ];
  }
  // See foundations.service.js: undefined keeps the own-property so the
  // soft-delete extension skips injection, and Prisma applies no filter.
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findDonorScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.donor.findFirst({ where, select: PUBLIC_FIELDS });
}

async function assertFoundationExists(foundationId) {
  const found = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { id: true },
  });
  if (!found) throw ApiError.badRequest("Foundation not found");
}

export async function listDonors(user, query) {
  const where = buildWhere(user, query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.donor.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: "desc" },
      ...paging,
    }),
    prisma.donor.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getDonor(user, id) {
  const donor = await findDonorScoped(user, id);
  if (!donor) throw ApiError.notFound("Donor not found");
  return donor;
}

export async function createDonor(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertFoundationExists(foundationId);

  // Unique (foundationId, pan) — surface a friendly conflict over Prisma P2002.
  const existing = await prisma.donor.findFirst({
    where: { foundationId, pan: input.pan, isDeleted: undefined },
    select: { id: true, isDeleted: true },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.isDeleted
        ? "A deleted donor with this PAN exists in this foundation. Restore it instead."
        : "Donor with this PAN already exists in this foundation"
    );
  }

  const { foundationId: _ignored, ...rest } = input;
  const created = await prisma.donor.create({
    data: { ...rest, foundationId },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "Donor",
    entityId: created.id,
    after: created,
    foundationId,
  });
  return created;
}

export async function updateDonor(user, id, input) {
  const before = await findDonorScoped(user, id);
  if (!before) throw ApiError.notFound("Donor not found");

  if (input.pan && input.pan !== before.pan) {
    const clash = await prisma.donor.findFirst({
      where: {
        foundationId: before.foundationId,
        pan: input.pan,
        NOT: { id },
        isDeleted: undefined,
      },
      select: { id: true },
    });
    if (clash) {
      throw ApiError.conflict("Another donor with this PAN exists in this foundation");
    }
  }

  const after = await prisma.donor.update({
    where: { id },
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Donor",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function deleteDonor(user, id) {
  const before = await findDonorScoped(user, id);
  if (!before) throw ApiError.notFound("Donor not found");

  await prisma.donor.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "Donor",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreDonor(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.donor.findFirst({
    where: { id, isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted donor not found");

  await prisma.donor.restore({ where: { id } });
  const after = await findDonorScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "Donor",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
