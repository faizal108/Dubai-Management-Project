import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { ALL_PERMISSIONS } from "../../lib/permissions.js";

const permissionsSchema = z
  .array(z.enum(ALL_PERMISSIONS))
  .max(ALL_PERMISSIONS.length)
  .default([]);

export const createEmployeeSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(60).optional(),
  // ADMIN's foundationId is derived from their token; SUPERADMIN must pass it.
  foundationId: z.string().min(1).optional(),
  permissions: permissionsSchema,
  isActive: z.boolean().optional(),
});

export const updateEmployeeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    username: z.string().trim().min(3).max(60).nullable().optional(),
    password: z.string().min(8).max(128).optional(),
    permissions: permissionsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const employeeIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
});
