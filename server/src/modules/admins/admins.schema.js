import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const createAdminSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(60).optional(),
  foundationId: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const updateAdminSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    username: z.string().trim().min(3).max(60).nullable().optional(),
    password: z.string().min(8).max(128).optional(),
    foundationId: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const adminIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listAdminsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
});
