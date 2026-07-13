import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(128),
});

export const customerSignupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120).trim(),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format")
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Invalid phone")
    .optional(),
});

// Self-service profile update. Role, foundationId, isActive are intentionally
// excluded     only an admin/superadmin can change those via the admins module.
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    username: z.string().trim().min(3).max(60).nullable().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8).max(128),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });
