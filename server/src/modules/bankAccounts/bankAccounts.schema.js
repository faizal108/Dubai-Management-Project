import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

// Bank-account purpose. Mirrors DonationCategory so a GENERAL donation
// routes to a GENERAL account and a CSR donation to a CSR account,
// independent of the payment mode it arrived through.
const CATEGORIES = ["GENERAL", "CSR"];
const blankToUndef = z.literal("").transform(() => undefined);

// Decimal-as-string on the wire. Same shape as donations / expenses so all
// currency modules validate identically. Negative not allowed on opening
// balance     that's what corrections / manual DEBIT rows are for.
const openingBalanceSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), {
    message: "openingBalance must be a non-negative decimal with up to 2 dp",
  });

export const createBankAccountSchema = z.object({
  foundationId: z.string().min(1).optional(),
  label: z.string().trim().min(2, "Label is required").max(80),
  category: z.enum(CATEGORIES),
  bankName: z.string().trim().max(160).optional().or(blankToUndef),
  accountNumber: z.string().trim().max(40).optional().or(blankToUndef),
  ifsc: z.string().trim().toUpperCase().max(20).optional().or(blankToUndef),
  upiId: z.string().trim().max(80).optional().or(blankToUndef),
  openingBalance: openingBalanceSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().or(blankToUndef),
});

// PATCH     category is intentionally immutable so the default-swap uniqueness
// stays sound and the ledger's category tagging is stable. Opening balance
// is not editable either; corrections should be posted as manual entries.
export const updateBankAccountSchema = z
  .object({
    label: z.string().trim().min(2).max(80).optional(),
    bankName: z.string().trim().max(160).nullable().optional(),
    accountNumber: z.string().trim().max(40).nullable().optional(),
    ifsc: z.string().trim().toUpperCase().max(20).nullable().optional(),
    upiId: z.string().trim().max(80).nullable().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const bankAccountIdParamSchema = z.object({
  id: z.string().min(1),
});

// isActive filter accepts the usual string / boolean coercions since it
// comes off the query string.
const boolQuery = z
  .union([z.string(), z.boolean()])
  .transform((v) =>
    v === true || v === "true" ? true : v === false || v === "false" ? false : undefined
  )
  .optional();

export const listBankAccountsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  category: z.enum(CATEGORIES).optional(),
  isActive: boolQuery,
});
