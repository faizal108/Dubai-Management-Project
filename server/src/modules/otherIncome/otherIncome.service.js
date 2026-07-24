import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { buildOrderBy, applyColumnFilters } from "../../lib/listQuery.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";
import { PERMISSIONS, hasPermission } from "../../lib/permissions.js";
import { resolveFinancialYearForDate } from "../../lib/financialYear.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  financialYearId: true,
  categoryId: true,
  donorId: true,
  donorNameSnapshot: true,
  itemName: true,
  quantity: true,
  unit: true,
  estimatedValue: true,
  receivedOn: true,
  activityId: true,
  createdById: true,
  notes: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

const INCLUDE = {
  category: { select: { id: true, name: true } },
  donor: { select: { id: true, fullName: true } },
  activity: { select: { id: true, title: true } },
};

// EMPLOYEEs without otherIncome:viewAll see only rows they created.
function ownershipWhere(user) {
  if (hasPermission(user, PERMISSIONS.OTHER_INCOME_VIEW_ALL)) return {};
  return { createdById: user.id };
}

function buildWhere(user, {
  q, includeDeleted, foundationId, financialYearId, categoryId, activityId, createdById, from, to,
}) {
  const where = { ...tenantWhere(user, foundationId), ...ownershipWhere(user) };
  if (financialYearId) where.financialYearId = financialYearId;
  if (categoryId) where.categoryId = categoryId;
  if (activityId) where.activityId = activityId;
  if (createdById) where.createdById = createdById;
  if (from || to) {
    where.receivedOn = {};
    if (from) where.receivedOn.gte = from;
    if (to) where.receivedOn.lte = to;
  }
  if (q) {
    where.OR = [
      { itemName: { contains: q, mode: "insensitive" } },
      { donorNameSnapshot: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user), ...ownershipWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.otherIncome.findFirst({ where, select: PUBLIC_FIELDS });
}

// Validates an optional OTHER_INCOME category in tenant scope.
async function assertCategoryValid(foundationId, categoryId) {
  if (!categoryId) return;
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, foundationId, kind: "OTHER_INCOME", isDeleted: false },
    select: { id: true },
  });
  if (!cat) throw ApiError.badRequest("Category not found in this foundation");
}

async function assertActivityValid(foundationId, activityId) {
  if (!activityId) return;
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, foundationId, isDeleted: false },
    select: { id: true },
  });
  if (!activity) throw ApiError.badRequest("Activity not found in this foundation");
}

// Resolves the donor snapshot: an existing donor's name (validated in scope),
// else the free-text donorName. Returns { donorId, donorNameSnapshot }.
async function resolveDonor(foundationId, { donorId, donorName }) {
  if (donorId) {
    const donor = await prisma.donor.findFirst({
      where: { id: donorId, foundationId, isDeleted: false },
      select: { id: true, fullName: true },
    });
    if (!donor) throw ApiError.badRequest("Donor not found in this foundation");
    return { donorId: donor.id, donorNameSnapshot: donorName || donor.fullName };
  }
  return { donorId: null, donorNameSnapshot: donorName || null };
}

const OTHER_INCOME_FILTERS = { itemName: { type: "text" } };
const OTHER_INCOME_SORT = {
  map: {
    receivedOn: "receivedOn",
    itemName: "itemName",
    quantity: "quantity",
    estimatedValue: "estimatedValue",
    createdAt: "createdAt",
  },
  fallback: [{ receivedOn: "desc" }, { createdAt: "desc" }],
};

function serialize(row) {
  return {
    ...row,
    quantity: row.quantity == null ? null : Number(row.quantity),
    estimatedValue: row.estimatedValue == null ? null : Number(row.estimatedValue),
    categoryName: row.category?.name ?? null,
    donorName: row.donor?.fullName ?? row.donorNameSnapshot ?? null,
    activityTitle: row.activity?.title ?? null,
  };
}

export async function listOtherIncome(user, query) {
  const where = buildWhere(user, query);
  applyColumnFilters(where, query, OTHER_INCOME_FILTERS);
  const orderBy = buildOrderBy(query.sortBy, query.sortDir, OTHER_INCOME_SORT);
  const paging = toPrismaPaging(query);
  const [rows, total, agg] = await Promise.all([
    prisma.otherIncome.findMany({
      where,
      select: { ...PUBLIC_FIELDS, ...INCLUDE },
      orderBy,
      ...paging,
    }),
    prisma.otherIncome.count({ where }),
    prisma.otherIncome.aggregate({ where, _sum: { estimatedValue: true } }),
  ]);
  const page = buildPage({
    items: rows.map(serialize),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
  // Sum of estimated value across the filtered set (for the ledger header).
  return { ...page, totalValue: Number(agg._sum.estimatedValue ?? 0) };
}

export async function getOtherIncome(user, id) {
  const where = { id, ...tenantWhere(user), ...ownershipWhere(user) };
  const row = await prisma.otherIncome.findFirst({ where, select: { ...PUBLIC_FIELDS, ...INCLUDE } });
  if (!row) throw ApiError.notFound("Other income not found");
  return serialize(row);
}

export async function createOtherIncome(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertCategoryValid(foundationId, input.categoryId);
  await assertActivityValid(foundationId, input.activityId);
  const { donorId, donorNameSnapshot } = await resolveDonor(foundationId, {
    donorId: input.donorId,
    donorName: input.donorName,
  });

  const receivedOn = input.receivedOn ?? new Date();
  // FY tag for reporting parity — no closed-window guard (no money moves).
  const fy = await resolveFinancialYearForDate(foundationId, receivedOn);

  const created = await prisma.otherIncome.create({
    data: {
      foundationId,
      financialYearId: fy?.id ?? null,
      categoryId: input.categoryId || null,
      donorId,
      donorNameSnapshot,
      itemName: input.itemName,
      quantity: input.quantity ?? "1",
      unit: input.unit || null,
      estimatedValue: input.estimatedValue || null,
      receivedOn,
      activityId: input.activityId || null,
      createdById: user.id,
      notes: input.notes || null,
    },
    select: { ...PUBLIC_FIELDS, ...INCLUDE },
  });
  const out = serialize(created);
  await recordAudit({
    action: "CREATE",
    entity: "OtherIncome",
    entityId: created.id,
    after: out,
    foundationId,
  });
  return out;
}

export async function updateOtherIncome(user, id, input) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Other income not found");

  if (input.categoryId) await assertCategoryValid(before.foundationId, input.categoryId);
  if (input.activityId) await assertActivityValid(before.foundationId, input.activityId);

  const data = { ...input };
  // Re-resolve donor snapshot when donor link / name changes.
  if (input.donorId !== undefined || input.donorName !== undefined) {
    const { donorId, donorNameSnapshot } = await resolveDonor(before.foundationId, {
      donorId: input.donorId ?? before.donorId,
      donorName: input.donorName,
    });
    data.donorId = donorId;
    data.donorNameSnapshot = donorNameSnapshot;
  }
  delete data.donorName; // not a column

  const after = await prisma.otherIncome.update({
    where: { id },
    data,
    select: { ...PUBLIC_FIELDS, ...INCLUDE },
  });
  const out = serialize(after);
  await recordAudit({
    action: "UPDATE",
    entity: "OtherIncome",
    entityId: id,
    before,
    after: out,
    foundationId: before.foundationId,
  });
  return out;
}

export async function deleteOtherIncome(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Other income not found");
  await prisma.otherIncome.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "OtherIncome",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreOtherIncome(user, id) {
  const before = await prisma.otherIncome.findFirst({
    where: { id, isDeleted: true, ...tenantWhere(user) },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted other income not found");
  await prisma.otherIncome.restore({ where: { id } });
  const after = await findScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "OtherIncome",
    entityId: id,
    before,
    after,
    foundationId: before.foundationId,
  });
  return after;
}
