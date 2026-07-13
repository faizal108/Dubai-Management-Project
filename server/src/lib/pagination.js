import { z } from "zod";

// Coerces string "true"/"false" (from query strings) into proper booleans.
const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (typeof v === "boolean") return v;
    if (v === undefined) return undefined;
    const s = v.toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
    return undefined;
  });

// Shared query schema for paginated list endpoints.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().trim().min(1).max(120).optional(),
  includeDeleted: boolish,
});

// Translates parsed pagination input into Prisma `skip` / `take`.
export function toPrismaPaging({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// Builds the standard paged response envelope.
export function buildPage({ items, total, page, pageSize }) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
