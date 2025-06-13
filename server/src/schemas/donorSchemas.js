import { z } from "zod";

// Core donor shape
export const donorBaseSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  address1: z.string().min(1, "Address line 1 is required"),
  address2: z.string().optional(),
  pan: z
    .string()
    .length(10, "PAN must be exactly 10 characters")
    .regex(/^[A-Z0-9]+$/, "PAN must be alphanumeric uppercase"),
  country: z.string().min(2),
  state: z.string().min(2),
  city: z.string().min(1),
});

// For Create (all fields required by donorBaseSchema)
export const createDonorSchema = donorBaseSchema;

// For Update (partial)
export const updateDonorSchema = donorBaseSchema.partial();

// Pagination query (pageNo, pageSize)
export const paginationSchema = z.object({
  pageNo: z
    .string()
    .regex(/^[0-9]+$/, "pageNo must be a non‑negative integer")
    .transform(Number)
    .default("0"),
  pageSize: z
    .string()
    .regex(/^[0-9]+$/, "pageSize must be a non‑negative integer")
    .transform(Number)
    .default("20"),
});

// PAN-only query
export const panQuerySchema = z.object({
  pan: z
    .string()
    .length(10)
    .regex(/^[A-Z0-9]+$/),
});
