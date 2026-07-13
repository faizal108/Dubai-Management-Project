import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";
import { getUserId } from "../../lib/requestContext.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  label: true,
  startDate: true,
  endDate: true,
  status: true,
  closedAt: true,
  closedBy: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId, status }) {
  const where = { ...tenantWhere(user, foundationId) };
  if (q) where.label = { contains: q, mode: "insensitive" };
  if (status) where.status = status;
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.financialYear.findFirst({ where, select: PUBLIC_FIELDS });
}

// The DB carries a tsrange EXCLUDE constraint that guarantees non-overlap,
// but we short-circuit here with a friendly 409 so the API surface stays
// clean and errors don't bubble up as raw Prisma constraint failures.
async function assertNoOverlap(foundationId, startDate, endDate, { excludeId } = {}) {
  const clash = await prisma.financialYear.findFirst({
    where: {
      foundationId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
    select: { id: true, label: true },
  });
  if (clash) {
    throw ApiError.conflict(
      `Window overlaps existing financial year "${clash.label}"`,
      { code: "FY_OVERLAP", conflictWith: clash.id }
    );
  }
}

async function assertLabelUnique(foundationId, label, { excludeId } = {}) {
  const dupe = await prisma.financialYear.findFirst({
    where: {
      foundationId,
      label: { equals: label, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw ApiError.conflict("Financial year label already in use");
}

export async function listFinancialYears(user, query) {
  const where = buildWhere(user, query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.financialYear.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: [{ startDate: "desc" }],
      ...paging,
    }),
    prisma.financialYear.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getFinancialYear(user, id) {
  const fy = await findScoped(user, id);
  if (!fy) throw ApiError.notFound("Financial year not found");
  return fy;
}

export async function createFinancialYear(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertLabelUnique(foundationId, input.label);
  await assertNoOverlap(foundationId, input.startDate, input.endDate);

  const created = await prisma.financialYear.create({
    data: {
      foundationId,
      label: input.label,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "ACTIVE",
    },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "FinancialYear",
    entityId: created.id,
    after: created,
    foundationId,
  });
  return created;
}

export async function updateFinancialYear(user, id, input) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Financial year not found");
  if (before.status === "CLOSED") {
    throw ApiError.conflict(
      "Cannot edit a closed financial year. Reopen it first.",
      { code: "FY_CLOSED" }
    );
  }

  if (input.label && input.label.toLowerCase() !== before.label.toLowerCase()) {
    await assertLabelUnique(before.foundationId, input.label, { excludeId: id });
  }
  const nextStart = input.startDate ?? before.startDate;
  const nextEnd = input.endDate ?? before.endDate;
  if (input.startDate || input.endDate) {
    await assertNoOverlap(before.foundationId, nextStart, nextEnd, { excludeId: id });
  }

  const after = await prisma.financialYear.update({
    where: { id },
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "FinancialYear",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function closeFinancialYear(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Financial year not found");
  if (before.status === "CLOSED") {
    throw ApiError.conflict("Financial year is already closed");
  }

  const after = await prisma.financialYear.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: getUserId() ?? null,
    },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "FinancialYear",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function reopenFinancialYear(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Financial year not found");
  if (before.status !== "CLOSED") {
    throw ApiError.conflict("Financial year is not closed");
  }

  const after = await prisma.financialYear.update({
    where: { id },
    data: { status: "ACTIVE", closedAt: null, closedBy: null },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "FinancialYear",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function deleteFinancialYear(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Financial year not found");
  if (before.status === "CLOSED") {
    throw ApiError.conflict(
      "Cannot delete a closed financial year. Reopen it first."
    );
  }

  // FK is RESTRICT on donations + expenses; short-circuit with a friendly
  // 409 so the caller sees the reason rather than a raw Prisma error.
  const [donationCount, expenseCount] = await Promise.all([
    prisma.donation.count({ where: { financialYearId: id, isDeleted: false } }),
    prisma.expense.count({ where: { financialYearId: id, isDeleted: false } }),
  ]);
  if (donationCount > 0 || expenseCount > 0) {
    throw ApiError.conflict(
      "Financial year has linked transactions and cannot be deleted"
    );
  }

  await prisma.financialYear.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "FinancialYear",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

