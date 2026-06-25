import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

// Standard Indian PAN: 5 letters + 4 digits + 1 letter.
const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format");

// Mobile is kept permissive (digits / + / spaces / hyphens) so existing data
// keeps validating, but we require at least 7 chars so empty / placeholder
// values can't slip through. Frontend labels this as "Mobile".
const phoneSchema = z
  .string()
  .trim()
  .min(7, "Mobile is required")
  .max(40)
  .regex(/^[0-9+\-\s]+$/, "Mobile may only contain digits, +, -, or spaces");

const optionalString = (max) =>
  z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

const requiredString = (min, max, label) =>
  z.string().trim().min(min, `${label} is required`).max(max);

export const createDonorSchema = z.object({
  // SUPERADMIN must supply foundationId; ADMIN's is derived from their token.
  foundationId: z.string().min(1).optional(),
  fullName: z.string().trim().min(2).max(160),
  pan: panSchema,
  email: z.string().email().toLowerCase().trim().optional(),
  phone: phoneSchema,
  address1: requiredString(2, 200, "Address line 1"),
  address2: optionalString(200),
  country: requiredString(2, 80, "Country"),
  state: requiredString(2, 80, "State"),
  city: requiredString(2, 80, "City"),
  pincode: requiredString(3, 20, "Pincode"),
});

// PATCH semantics: each field is optional, but if the caller does send it we
// re-apply the create-side floor so a required field can't be cleared.
export const updateDonorSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160).optional(),
    pan: panSchema.optional(),
    email: z.string().email().toLowerCase().trim().nullable().optional(),
    phone: phoneSchema.optional(),
    address1: requiredString(2, 200, "Address line 1").optional(),
    address2: z.string().trim().max(200).nullable().optional(),
    country: requiredString(2, 80, "Country").optional(),
    state: requiredString(2, 80, "State").optional(),
    city: requiredString(2, 80, "City").optional(),
    pincode: requiredString(3, 20, "Pincode").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const donorIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listDonorsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
});
