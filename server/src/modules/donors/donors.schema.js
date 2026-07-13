import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

// Tiered donor identity: fullName is the only mandatory field. PAN and phone
// unlock Tier 1 (full 80G-ready receipt) and Tier 2 (linked but PAN-less)
// respectively     donors who only provide a name are captured as Tier 3.
// Regex validation is applied only when the caller sends a value, so an
// omitted / blank field never trips schema failure.

// Standard Indian PAN: 5 letters + 4 digits + 1 letter. Optional across the
// board     when present, must still match.
const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format");

// Mobile stays permissive (digits / + / spaces / hyphens); minimum length is
// enforced only if a value is provided so donors without a phone remain valid.
const phoneSchema = z
  .string()
  .trim()
  .min(7, "Mobile must be at least 7 digits")
  .max(40)
  .regex(/^[0-9+\-\s]+$/, "Mobile may only contain digits, +, -, or spaces");

// Blank strings from HTML inputs are coerced to undefined so downstream
// optional() checks treat "unset" and "empty" identically.
const blankToUndef = z.literal("").transform(() => undefined);

const optionalString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(blankToUndef);

export const createDonorSchema = z.object({
  // SUPERADMIN must supply foundationId; ADMIN's is derived from their token.
  foundationId: z.string().min(1).optional(),
  fullName: z.string().trim().min(2, "Full name is required").max(160),
  pan: panSchema.optional().or(blankToUndef),
  email: z.string().email().toLowerCase().trim().optional().or(blankToUndef),
  phone: phoneSchema.optional().or(blankToUndef),
  address1: optionalString(200),
  address2: optionalString(200),
  country: optionalString(80),
  state: optionalString(80),
  city: optionalString(80),
  pincode: optionalString(20),
});

// PATCH semantics: each field is optional. When present, blanks are coerced
// to undefined so callers can leave a field alone with "". Explicit clearing
// of nullable columns (address2 / email) still goes through null.
export const updateDonorSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160).optional(),
    pan: panSchema.nullable().optional().or(blankToUndef),
    email: z.string().email().toLowerCase().trim().nullable().optional().or(blankToUndef),
    phone: phoneSchema.nullable().optional().or(blankToUndef),
    address1: z.string().trim().max(200).nullable().optional().or(blankToUndef),
    address2: z.string().trim().max(200).nullable().optional().or(blankToUndef),
    country: z.string().trim().max(80).nullable().optional().or(blankToUndef),
    state: z.string().trim().max(80).nullable().optional().or(blankToUndef),
    city: z.string().trim().max(80).nullable().optional().or(blankToUndef),
    pincode: z.string().trim().max(20).nullable().optional().or(blankToUndef),
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
