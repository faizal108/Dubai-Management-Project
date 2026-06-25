import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

const DONATION_TYPES = ["CASH", "CHEQUE", "ONLINE", "UPI"];
const DONATION_STATUSES = ["PENDING", "RECEIVED"];
const DONATION_CATEGORIES = ["GENERAL", "CSR"];

// Decimal-as-string keeps us safe from float drift at the wire level.
const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), {
    message: "amount must be a positive decimal with up to 2 dp",
  })
  .refine((v) => parseFloat(v) > 0, { message: "amount must be greater than 0" });

const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

const baseFields = {
  foundationId: z.string().min(1).optional(),
  donorId: z.string().min(1),
  amount: amountSchema,
  type: z.enum(DONATION_TYPES),
  // Donation category. Defaults to GENERAL when omitted so existing callers
  // (and legacy clients) keep working without a payload change.
  category: z.enum(DONATION_CATEGORIES).default("GENERAL"),
  donationDate: isoDateSchema.optional(),
  transactionDate: isoDateSchema.optional(),
  bankName: z.string().trim().max(160).optional(),
  utr: z.string().trim().max(80).optional(),
  ifsc: z.string().trim().toUpperCase().max(20).optional(),
  chequeNumber: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  // Donor consent to receive the receipt over WhatsApp. The UI only surfaces
  // this checkbox when the foundation has WhatsApp Business enabled; server
  // still accepts it for any type so the gating stays in one place.
  whatsappOptIn: z.boolean().optional(),
};

// Conditional requirements per donation type. UPI is treated like ONLINE — a
// UTR is the only reliable reference once the rails settle the transfer.
function enforceTypeFields(v, ctx) {
  const need = (field, msg) => {
    if (!v[field]) ctx.addIssue({ code: "custom", path: [field], message: msg });
  };
  if (v.type === "CHEQUE") {
    need("chequeNumber", "chequeNumber is required for CHEQUE donations");
    need("bankName", "bankName is required for CHEQUE donations");
  }
  if (v.type === "ONLINE" || v.type === "UPI") {
    need("utr", "utr is required for ONLINE/UPI donations");
  }
}

export const createDonationSchema = z.object(baseFields).superRefine(enforceTypeFields);

export const updateDonationSchema = z
  .object({
    amount: amountSchema.optional(),
    type: z.enum(DONATION_TYPES).optional(),
    category: z.enum(DONATION_CATEGORIES).optional(),
    donationDate: isoDateSchema.optional(),
    transactionDate: isoDateSchema.nullable().optional(),
    bankName: z.string().trim().max(160).nullable().optional(),
    utr: z.string().trim().max(80).nullable().optional(),
    ifsc: z.string().trim().toUpperCase().max(20).nullable().optional(),
    chequeNumber: z.string().trim().max(40).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    whatsappOptIn: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const donationIdParamSchema = z.object({
  id: z.string().min(1),
});

// Accept numeric strings from the URL query and coerce to Number. amountSchema
// is decimal-aware on create/update but here we just need a finite >= 0 value.
const amountFilterSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: "Must be a non-negative number",
  })
  .optional();

export const listDonationsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  donorId: z.string().min(1).optional(),
  type: z.enum(DONATION_TYPES).optional(),
  status: z.enum(DONATION_STATUSES).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  // WhatsApp delivery state — mirrors the badges shown in the UI.
  whatsapp: z.enum(["SENT", "PENDING", "FAILED", "NONE"]).optional(),
  minAmount: amountFilterSchema,
  maxAmount: amountFilterSchema,
});
