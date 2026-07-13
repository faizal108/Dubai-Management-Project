import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";

// Public projection     excludes passwordHash so it never leaks into responses
// or audit log snapshots.
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  foundationId: true,
  isActive: true,
  isDeleted: true,
  deletedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere({ q, includeDeleted, foundationId }) {
  const where = { role: "ADMIN" };
  if (foundationId) where.foundationId = foundationId;
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }
  // See note in foundations.service.js: undefined keeps the own-property so
  // the soft-delete extension skips injection, and Prisma applies no filter.
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function assertFoundationExists(foundationId) {
  const found = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { id: true },
  });
  if (!found) throw ApiError.badRequest("Foundation not found");
}

async function findAdminById(id, { includeDeleted = false } = {}) {
  const where = { id, role: "ADMIN" };
  if (includeDeleted) where.isDeleted = { in: [true, false] };
  return prisma.user.findFirst({ where, select: PUBLIC_FIELDS });
}

export async function listAdmins(query) {
  const where = buildWhere(query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: "desc" },
      ...paging,
    }),
    prisma.user.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getAdmin(id) {
  const admin = await findAdminById(id);
  if (!admin) throw ApiError.notFound("Admin not found");
  return admin;
}

export async function createAdmin(input) {
  await assertFoundationExists(input.foundationId);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict("Email already registered");

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const created = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      fullName: input.fullName,
      role: "ADMIN",
      foundationId: input.foundationId,
      isActive: input.isActive ?? true,
    },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "User",
    entityId: created.id,
    after: created,
    foundationId: created.foundationId,
  });
  return created;
}

export async function updateAdmin(id, input) {
  const before = await findAdminById(id);
  if (!before) throw ApiError.notFound("Admin not found");

  if (input.foundationId && input.foundationId !== before.foundationId) {
    await assertFoundationExists(input.foundationId);
  }

  const data = { ...input };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);
    delete data.password;
  }

  const after = await prisma.user.update({
    where: { id },
    data,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "User",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function deleteAdmin(id) {
  const before = await findAdminById(id);
  if (!before) throw ApiError.notFound("Admin not found");

  await prisma.user.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "User",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreAdmin(id) {
  const before = await prisma.user.findFirst({
    where: { id, role: "ADMIN", isDeleted: true },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted admin not found");

  await prisma.user.restore({ where: { id } });
  const after = await findAdminById(id);
  await recordAudit({
    action: "RESTORE",
    entity: "User",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
