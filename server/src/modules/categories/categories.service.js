import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  kind: true,
  name: true,
  description: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId, kind }) {
  const where = { ...tenantWhere(user, foundationId) };
  if (kind) where.kind = kind;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findCategoryScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.category.findFirst({ where, select: PUBLIC_FIELDS });
}

async function assertFoundationExists(foundationId) {
  const found = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { id: true },
  });
  if (!found) throw ApiError.badRequest("Foundation not found");
}

// Name uniqueness among *active* rows per (foundation, kind) — mirrors the
// partial unique index; surfaced as a friendly 409.
async function assertNameUnique(foundationId, kind, name, { excludeId } = {}) {
  const dupe = await prisma.category.findFirst({
    where: {
      foundationId,
      kind,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw ApiError.conflict("Category name already in use for this type");
}

// Counts live records referencing a category, per kind, so delete can be
// blocked with a friendly 409 (the FK is RESTRICT at the DB level too).
async function countInUse(kind, categoryId) {
  if (kind === "EXPENSE") {
    return prisma.expense.count({ where: { categoryId, isDeleted: false } });
  }
  if (kind === "INCOME") {
    return prisma.donation.count({ where: { incomeCategoryId: categoryId, isDeleted: false } });
  }
  return prisma.otherIncome.count({ where: { categoryId, isDeleted: false } });
}

export async function listCategories(user, query) {
  const where = buildWhere(user, query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: [{ name: "asc" }],
      ...paging,
    }),
    prisma.category.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getCategory(user, id) {
  const category = await findCategoryScoped(user, id);
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertFoundationExists(foundationId);
  await assertNameUnique(foundationId, input.kind, input.name);

  const created = await prisma.category.create({
    data: {
      foundationId,
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
    },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "Category",
    entityId: created.id,
    after: created,
    foundationId,
  });
  return created;
}

export async function updateCategory(user, id, input) {
  const before = await findCategoryScoped(user, id);
  if (!before) throw ApiError.notFound("Category not found");

  if (input.name && input.name.toLowerCase() !== before.name.toLowerCase()) {
    await assertNameUnique(before.foundationId, before.kind, input.name, { excludeId: id });
  }

  const after = await prisma.category.update({
    where: { id },
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Category",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function deleteCategory(user, id) {
  const before = await findCategoryScoped(user, id);
  if (!before) throw ApiError.notFound("Category not found");

  const inUse = await countInUse(before.kind, id);
  if (inUse > 0) {
    throw ApiError.conflict("Category is in use and cannot be deleted");
  }

  await prisma.category.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "Category",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreCategory(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.category.findFirst({
    where: { id, isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted category not found");

  await assertNameUnique(before.foundationId, before.kind, before.name, { excludeId: id });

  await prisma.category.restore({ where: { id } });
  const after = await findCategoryScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "Category",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
