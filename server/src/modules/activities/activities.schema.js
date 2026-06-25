import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

const ACTIVITY_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

const optionalString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

// Ensure date ordering when both ends are supplied. Either side may be
// omitted (Planned activities often have only a target start).
function enforceDateOrder(v, ctx) {
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be on or after startDate",
    });
  }
}

export const createActivitySchema = z
  .object({
    foundationId: z.string().min(1).optional(),
    title: z.string().trim().min(2, "Title is required").max(200),
    description: optionalString(5000),
    status: z.enum(ACTIVITY_STATUSES).default("PLANNED"),
    location: optionalString(200),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  })
  .superRefine(enforceDateOrder);

// PATCH semantics: every field optional, but if provided we re-apply the
// create-side floor so a required field can't be cleared.
export const updateActivitySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(ACTIVITY_STATUSES).optional(),
    location: z.string().trim().max(200).nullable().optional(),
    startDate: isoDateSchema.nullable().optional(),
    endDate: isoDateSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .superRefine(enforceDateOrder);

export const activityIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listActivitiesQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
