import { prisma } from "../../lib/prisma.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";

// AuditLog has no `actor` relation in the schema (actorId is a free-form
// string), so we fetch matching users in a second query and zip them in.
// foundation IS a relation and we include it for the foundation name column.

function buildWhere(query) {
  const where = {};
  if (query.actorId) where.actorId = query.actorId;
  if (query.entity) where.entity = query.entity;
  if (query.entityId) where.entityId = query.entityId;
  if (query.action) where.action = query.action;
  if (query.foundationId) where.foundationId = query.foundationId;

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = query.from;
    if (query.to) where.createdAt.lte = query.to;
  }

  // Free-text search over entity / entityId. Case-insensitive contains.
  if (query.q) {
    where.OR = [
      { entity: { contains: query.q, mode: "insensitive" } },
      { entityId: { contains: query.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listAudits(query) {
  const where = buildWhere(query);
  const paging = toPrismaPaging(query);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        foundation: { select: { id: true, name: true } },
      },
      ...paging,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Resolve actor display names in a second pass. We don't soft-filter here
  // because we want to show "deleted user" attributions in the audit trail.
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds }, isDeleted: false },
        select: { id: true, fullName: true, email: true, username: true },
      })
    : [];
  const actorById = new Map(actors.map((u) => [u.id, u]));

  const items = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
    foundationId: r.foundationId,
    foundationName: r.foundation?.name ?? null,
    actorId: r.actorId,
    actor: r.actorId
      ? actorById.get(r.actorId) ?? { id: r.actorId, fullName: null, email: null }
      : null,
  }));

  return buildPage({
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}
