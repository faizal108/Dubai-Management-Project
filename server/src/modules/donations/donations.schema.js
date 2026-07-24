import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { sortSchema, textFilter } from "../../lib/listQuery.js";

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

// Blank strings from HTML inputs collapse to undefined so downstream
// optional() checks treat "unset" and "empty" identically.
const blankToUndef = z.literal("").transform(() => undefined);

// Inline donor payload used when the operator captures donation details for
// a donor that either doesn't exist yet or that they don't want to look up
// first. Only fullName is mandatory     pan / phone unlock the higher
// identifier tiers on the resolver in donations.service.js.
const inlineDonorSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(160),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format")
    .optional()
    .or(blankToUndef),
  phone: z
    .string()
    .trim()
    .min(7, "Mobile must be at least 7 digits")
    .max(40)
    .regex(/^[0-9+\-\s]+$/, "Mobile may only contain digits, +, -, or spaces")
    .optional()
    .or(blankToUndef),
  email: z.string().email().toLowerCase().trim().optional().or(blankToUndef),
  address1: z.string().trim().max(200).optional().or(blankToUndef),
  address2: z.string().trim().max(200).optional().or(blankToUndef),
  city: z.string().trim().max(80).optional().or(blankToUndef),
  state: z.string().trim().max(80).optional().or(blankToUndef),
  country: z.string().trim().max(80).optional().or(blankToUndef),
  pincode: z.string().trim().max(20).optional().or(blankToUndef),
});

const baseFields = {
  foundationId: z.string().min(1).optional(),
  // donorId is now optional: callers either point to an existing donor via id
  // OR provide an inline `donor` object (see superRefine below). This keeps
  // backwards compatibility with clients that still preselect a donor.
  donorId: z.string().min(1).optional(),
  donor: inlineDonorSchema.optional(),
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
  // Bank account the donation credits. Optional on the wire     when the client
  // omits it the service falls back to the foundation's default account for
  // the donation type's category (CASH     CASH default, UPI     UPI default,
  // CHEQUE/ONLINE     BANK default). Required at posting time (i.e. once the
  // donation is RECEIVED); PENDING rows may carry it or leave it null.
  bankAccountId: z.string().min(1).optional(),
  // Optional free-form income category (kind=INCOME).
  incomeCategoryId: z.string().min(1).optional().or(blankToUndef),
};

// Conditional requirements per donation type. UPI is treated like ONLINE     a
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

// Donor payload gate     exactly one of donorId / donor must be present, and
// when the inline form is used it must at minimum carry a fullName.
function enforceDonorPresence(v, ctx) {
  const hasId = Boolean(v.donorId);
  const hasInline = Boolean(v.donor?.fullName);
  if (!hasId && !hasInline) {
    ctx.addIssue({
      code: "custom",
      path: ["donor"],
      message: "Provide either donorId or a donor.fullName",
    });
  }
}

export const createDonationSchema = z
  .object(baseFields)
  .superRefine((v, ctx) => {
    enforceTypeFields(v, ctx);
    enforceDonorPresence(v, ctx);
  });

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
    // Allow re-targeting the bank account on a PENDING donation before it
    // posts. Once RECEIVED, the service blocks edits entirely so the ledger
    // pointer stays immutable post-post.
    bankAccountId: z.string().min(1).nullable().optional(),
    incomeCategoryId: z.string().min(1).nullable().optional(),
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
  // Pins the listing to a specific FY window. The frontend passes the
  // currently-selected FY from FinancialYearContext so switching years
  // filters the ledger without also having to set from/to manually.
  financialYearId: z.string().min(1).optional(),
  donorId: z.string().min(1).optional(),
  type: z.enum(DONATION_TYPES).optional(),
  status: z.enum(DONATION_STATUSES).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  // WhatsApp delivery state     mirrors the badges shown in the UI.
  whatsapp: z.enum(["SENT", "PENDING", "FAILED", "NONE"]).optional(),
  minAmount: amountFilterSchema,
  maxAmount: amountFilterSchema,
  incomeCategoryId: z.string().min(1).optional(),
  // Per-column text filters (DataTable). Compose with the global `q`.
  donorName: textFilter,
  pan: textFilter,
  bankName: textFilter,
  utr: textFilter,
  // Column sort. Whitelisted so callers can't order by arbitrary columns.
  ...sortSchema(["donationDate", "amount", "type", "donationReceived", "createdAt"]),
});
