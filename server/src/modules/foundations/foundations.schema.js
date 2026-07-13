import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

// PAN is the Foundation's primary external identifier (organisation PAN).
const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format");

// Decimal amount accepted as a number or a numeric string. Coerced to a string
// so Prisma's Decimal column receives an exact representation.
const decimalAmount = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), {
    message: "Invalid amount (max 12 digits, 2 decimals)",
  });

// WhatsApp Business numbers are validated against the E.164 spec so the future
// provider integration can dial them without further normalisation.
const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Invalid phone number (use E.164, e.g. +911234567890)");

// Shared block of optional org-level config     reused by create/update/me-update.
// fyStartMonth drives auto-creation of FinancialYear windows: 1 = January,
// 4 = April (Indian statutory default), 7 = July, etc. Foundations rarely
// change this after go-live, but it's exposed here for ADMIN/SUPERADMIN.
const orgConfigFields = {
  cashLimit: decimalAmount.optional(),
  hasWhatsappBusiness: z.boolean().optional(),
  whatsappBusinessNumber: e164.nullable().optional(),
  fyStartMonth: z.coerce.number().int().min(1).max(12).optional(),
};

// When the WhatsApp toggle is on, the number must be present. Applied as a
// refinement so both create and update can share the rule.
function refineWhatsapp(data) {
  if (data.hasWhatsappBusiness === true) {
    return !!data.whatsappBusinessNumber;
  }
  return true;
}
const whatsappRefinement = {
  message: "WhatsApp Business Number is required when enabled",
  path: ["whatsappBusinessNumber"],
};

export const createFoundationSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    pan: panSchema,
    logoUrl: z.string().trim().url().max(500).optional(),
    isActive: z.boolean().optional(),
    ...orgConfigFields,
  })
  .refine(refineWhatsapp, whatsappRefinement);

export const updateFoundationSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    pan: panSchema.optional(),
    logoUrl: z.string().trim().url().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    ...orgConfigFields,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(refineWhatsapp, whatsappRefinement);

// ADMIN-facing self-update     same as updateFoundationSchema but PAN, name and
// isActive are owned by SUPERADMIN and can't be changed from /me.
export const updateMyFoundationSchema = z
  .object(orgConfigFields)
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(refineWhatsapp, whatsappRefinement);

export const foundationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listFoundationsQuerySchema = paginationQuerySchema;
