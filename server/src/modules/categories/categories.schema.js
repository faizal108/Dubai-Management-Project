import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const CATEGORY_KINDS = ["INCOME", "EXPENSE", "OTHER_INCOME"];

const optionalString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const createCategorySchema = z.object({
  // SUPERADMIN passes this explicitly; ADMIN/EMPLOYEE it comes from the token.
  foundationId: z.string().min(1).optional(),
  kind: z.enum(CATEGORY_KINDS),
  name: z.string().trim().min(2, "Name is required").max(120),
  description: optionalString(2000),
});

// PATCH: kind is immutable (a category can't change stream); name/description
// only. `description: null` explicitly clears the value.
export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const categoryIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  kind: z.enum(CATEGORY_KINDS).optional(),
});
