import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";

// Public projection     excludes passwordHash. permissions is included so
// admins can see what each employee is allowed to do.
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  permissions: true,
  foundationId: true,
  isActive: true,
  isDeleted: true,
  deletedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId }) {
  const where = { role: "EMPLOYEE", ...tenantWhere(user, foundationId) };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findEmployeeScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, role: "EMPLOYEE", ...tenantWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.user.findFirst({ where, select: PUBLIC_FIELDS });
}

export async function listEmployees(user, query) {
  const where = buildWhere(user, query);
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

export async function getEmployee(user, id) {
  const employee = await findEmployeeScoped(user, id);
  if (!employee) throw ApiError.notFound("Employee not found");
  return employee;
}

export async function createEmployee(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict("Email already registered");

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const created = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      fullName: input.fullName,
      role: "EMPLOYEE",
      permissions: input.permissions ?? [],
      foundationId,
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

export async function updateEmployee(user, id, input) {
  const before = await findEmployeeScoped(user, id);
  if (!before) throw ApiError.notFound("Employee not found");

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

export async function deleteEmployee(user, id) {
  const before = await findEmployeeScoped(user, id);
  if (!before) throw ApiError.notFound("Employee not found");

  await prisma.user.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "User",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreEmployee(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.user.findFirst({
    where: { id, role: "EMPLOYEE", isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted employee not found");

  await prisma.user.restore({ where: { id } });
  const after = await findEmployeeScoped(user, id);
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
