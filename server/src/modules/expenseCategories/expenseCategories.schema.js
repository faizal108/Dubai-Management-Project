import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

const optionalString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const createExpenseCategorySchema = z.object({
  // SUPERADMIN passes this explicitly; ADMIN/EMPLOYEE it comes from the token.
  foundationId: z.string().min(1).optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  description: optionalString(2000),
});

// PATCH: every field optional. `description: null` explicitly clears the value;
// this mirrors how activities handle nullable text fields.
export const updateExpenseCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const expenseCategoryIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listExpenseCategoriesQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
});
