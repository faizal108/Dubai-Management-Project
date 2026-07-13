import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  name: true,
  description: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId }) {
  const where = { ...tenantWhere(user, foundationId) };
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
  return prisma.expenseCategory.findFirst({ where, select: PUBLIC_FIELDS });
}

async function assertFoundationExists(foundationId) {
  const found = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { id: true },
  });
  if (!found) throw ApiError.badRequest("Foundation not found");
}

// Enforces name uniqueness among *active* rows for a foundation. Mirrors the
// partial unique index in the migration, but surfaced here as a friendly 409
// so callers get a targeted error instead of a raw Prisma constraint failure.
async function assertNameUnique(foundationId, name, { excludeId } = {}) {
  const dupe = await prisma.expenseCategory.findFirst({
    where: {
      foundationId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw ApiError.conflict("Category name already in use");
}

export async function listCategories(user, query) {
  const where = buildWhere(user, query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.expenseCategory.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: [{ name: "asc" }],
      ...paging,
    }),
    prisma.expenseCategory.count({ where }),
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
  await assertNameUnique(foundationId, input.name);

  const { foundationId: _ignored, ...rest } = input;
  const created = await prisma.expenseCategory.create({
    data: { ...rest, foundationId },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "ExpenseCategory",
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
    await assertNameUnique(before.foundationId, input.name, { excludeId: id });
  }

  const after = await prisma.expenseCategory.update({
    where: { id },
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "ExpenseCategory",
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

  // Block delete if any active expenses still reference this category. The
  // FK is RESTRICT at the DB level, but we short-circuit with a friendly 409.
  const inUse = await prisma.expense.count({
    where: { categoryId: id, isDeleted: false },
  });
  if (inUse > 0) {
    throw ApiError.conflict(
      "Category is in use by existing expenses and cannot be deleted"
    );
  }

  await prisma.expenseCategory.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "ExpenseCategory",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreCategory(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.expenseCategory.findFirst({
    where: { id, isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted category not found");

  // Cannot restore if the name has been re-used by another active row.
  await assertNameUnique(before.foundationId, before.name, { excludeId: id });

  await prisma.expenseCategory.restore({ where: { id } });
  const after = await findCategoryScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "ExpenseCategory",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
