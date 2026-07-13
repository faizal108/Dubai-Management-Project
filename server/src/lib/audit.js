import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { getContext } from "./requestContext.js";

// Persists an AuditLog row. Designed to never throw     a failure here must
// not roll back the surrounding business operation. Callers pass `before`
// and `after` snapshots (already-redacted plain objects).
export async function recordAudit({
  action,
  entity,
  entityId,
  before = null,
  after = null,
  foundationId,
}) {
  const ctx = getContext() ?? {};
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId ?? null,
        before: before ?? undefined,
        after: after ?? undefined,
        foundationId: foundationId ?? ctx.foundationId ?? null,
        actorId: ctx.userId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err, action, entity, entityId },
      "failed to record audit log"
    );
  }
}
