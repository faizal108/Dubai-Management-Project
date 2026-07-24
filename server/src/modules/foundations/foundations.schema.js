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

// Image reference: either an http(s) URL or a base64 `data:image/...` URL.
// Images are resized client-side before upload, so the generous cap is a
// safety valve, not the expected size. Stored in a TEXT column.
const imageRef = z
  .string()
  .trim()
  .max(700_000, "Image is too large — please use a smaller file")
  .refine(
    (v) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(v) || /^https?:\/\//.test(v),
    { message: "Must be an image upload or an http(s) URL" }
  );

// Per-foundation receipt template options (the "config panel" of the receipt
// builder). Shape is validated but permissive; the client-side template
// registry consumes it. Text blocks default when omitted.
const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color");
const shortText = z.string().trim().max(200).optional().or(z.literal(""));

const receiptSettingsSchema = z
  .object({
    accentColor: hexColor.optional(),
    textColor: hexColor.optional(),
    // Outer border color, or the string "none" to disable the frame.
    borderColor: z.union([hexColor, z.literal("none")]).optional(),
    fontFamily: z.enum(["sans", "serif", "mono"]).optional(),
    fontScale: z.enum(["compact", "normal", "large"]).optional(),
    headerTitle: shortText,
    receiptTitle: shortText,
    declarationText: z.string().trim().max(600).optional().or(z.literal("")),
    thankYouNote: z.string().trim().max(300).optional().or(z.literal("")),
    contactNote: z.string().trim().max(300).optional().or(z.literal("")),
    footerText: shortText,
    signatureLabel: shortText,
    logoSize: z.enum(["sm", "md", "lg"]).optional(),
    logoPosition: z.enum(["left", "center"]).optional(),
    paperSize: z.enum(["a4", "letter"]).optional(),
    orientation: z.enum(["portrait", "landscape"]).optional(),
    dateFormat: z.enum(["dmy", "dMy"]).optional(),
    show: z
      .object({
        donorAddress: z.boolean().optional(),
        pan: z.boolean().optional(),
        reference: z.boolean().optional(),
        bankBranch: z.boolean().optional(),
        receiptNo: z.boolean().optional(),
        amountInWords: z.boolean().optional(),
        logo: z.boolean().optional(),
        signature: z.boolean().optional(),
      })
      .partial()
      .optional(),
  })
  .strip();

// Branding + receipt profile block. Editable by ADMIN via /me as well as by
// SUPERADMIN via create/update. All optional; `null` clears a value.
const brandingFields = {
  logoUrl: imageRef.nullable().optional(),
  signatureUrl: imageRef.nullable().optional(),
  receiptName: z.string().trim().max(160).nullable().optional(),
  registrationNumber: z.string().trim().max(120).nullable().optional(),
  // Empty string (cleared field) collapses to null before the email check so
  // clearing the field never trips validation.
  email: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().email("Invalid email").max(160).nullable().optional()
  ),
  address: z.string().trim().max(600).nullable().optional(),
  // Receipt builder.
  receiptTemplateId: z.string().trim().min(1).max(60).optional(),
  receiptSettings: receiptSettingsSchema.nullable().optional(),
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
    isActive: z.boolean().optional(),
    ...orgConfigFields,
    ...brandingFields,
  })
  .refine(refineWhatsapp, whatsappRefinement);

export const updateFoundationSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    pan: panSchema.optional(),
    isActive: z.boolean().optional(),
    ...orgConfigFields,
    ...brandingFields,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(refineWhatsapp, whatsappRefinement);

// ADMIN-facing self-update     org config + branding/receipt profile. PAN, name
// and isActive are owned by SUPERADMIN and can't be changed from /me.
export const updateMyFoundationSchema = z
  .object({ ...orgConfigFields, ...brandingFields })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(refineWhatsapp, whatsappRefinement);

export const foundationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listFoundationsQuerySchema = paginationQuerySchema;
