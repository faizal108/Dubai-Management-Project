import { z } from "zod";

// Audit log query filters. Pagination borrows the page/pageSize shape from the
// shared schema but we keep this self-contained so we can add audit-specific
// filters (action enum, entity, date range) without coupling to other lists.
export const listAuditsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),

  // Filters by actor and target. All optional; combine freely.
  actorId: z.string().trim().min(1).optional(),
  entity: z.string().trim().min(1).max(64).optional(),
  entityId: z.string().trim().min(1).optional(),
  action: z
    .enum(["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT"])
    .optional(),
  foundationId: z.string().trim().min(1).optional(),

  // ISO date-time range over AuditLog.createdAt.
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),

  // Optional free-text search across entity + entityId (case-insensitive).
  q: z.string().trim().min(1).max(120).optional(),
});
