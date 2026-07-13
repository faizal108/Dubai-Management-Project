import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  title: true,
  description: true,
  status: true,
  location: true,
  startDate: true,
  endDate: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId, status, from, to }) {
  const where = { ...tenantWhere(user, foundationId) };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;
  // Date filter targets startDate     the only point all activities share. NULL
  // startDates fall outside the range (acceptable: those are unscheduled).
  if (from || to) {
    where.startDate = {};
    if (from) where.startDate.gte = from;
    if (to) where.startDate.lte = to;
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findActivityScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.activity.findFirst({ where, select: PUBLIC_FIELDS });
}

async function assertFoundationExists(foundationId) {
  const found = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { id: true },
  });
  if (!found) throw ApiError.badRequest("Foundation not found");
}

export async function listActivities(user, query) {
  const where = buildWhere(user, query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      ...paging,
    }),
    prisma.activity.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getActivity(user, id) {
  const activity = await findActivityScoped(user, id);
  if (!activity) throw ApiError.notFound("Activity not found");
  return activity;
}

export async function createActivity(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertFoundationExists(foundationId);

  const { foundationId: _ignored, ...rest } = input;
  const created = await prisma.activity.create({
    data: { ...rest, foundationId },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "Activity",
    entityId: created.id,
    after: created,
    foundationId,
  });
  return created;
}

export async function updateActivity(user, id, input) {
  const before = await findActivityScoped(user, id);
  if (!before) throw ApiError.notFound("Activity not found");

  const after = await prisma.activity.update({
    where: { id },
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Activity",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function deleteActivity(user, id) {
  const before = await findActivityScoped(user, id);
  if (!before) throw ApiError.notFound("Activity not found");

  await prisma.activity.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "Activity",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreActivity(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.activity.findFirst({
    where: { id, isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted activity not found");

  await prisma.activity.restore({ where: { id } });
  const after = await findActivityScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "Activity",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
