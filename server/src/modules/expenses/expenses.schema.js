import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { sortSchema, textFilter } from "../../lib/listQuery.js";

// Decimal-as-string keeps the wire format free from float drift. Matches the
// same shape used by donations.schema.js so both currency modules validate
// consistently across the API.
const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), {
    message: "amount must be a positive decimal with up to 2 dp",
  })
  .refine((v) => parseFloat(v) > 0, {
    message: "amount must be greater than 0",
  });

const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

const blankToUndef = z.literal("").transform(() => undefined);

const optionalString = (max) =>
  z.string().trim().max(max).optional().or(blankToUndef);

export const createExpenseSchema = z.object({
  // SUPERADMIN passes this explicitly; ADMIN/EMPLOYEE it comes from the token.
  foundationId: z.string().min(1).optional(),
  categoryId: z.string().min(1, "categoryId is required"),
  // activityId is optional     overhead expenses have no program link.
  activityId: z.string().min(1).optional().or(blankToUndef),
  amount: amountSchema,
  paidTo: z.string().trim().min(1, "paidTo is required").max(200),
  paidOn: isoDateSchema,
  referenceNo: optionalString(80),
  notes: optionalString(2000),
  // Bank account this expense debits. Optional on the wire     when omitted
  // the service falls back to the foundation's default (BANK     UPI     CASH
  // preference). Required at posting time; expense creation always posts
  // a DEBIT so the service errors if no default is configured.
  bankAccountId: z.string().min(1).optional(),
});

// PATCH: every field optional. `null` on nullable columns explicitly clears
// the value     mirrors the donations schema behaviour.
export const updateExpenseSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    activityId: z.string().min(1).nullable().optional(),
    amount: amountSchema.optional(),
    paidTo: z.string().trim().min(1).max(200).optional(),
    paidOn: isoDateSchema.optional(),
    referenceNo: z.string().trim().max(80).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    // Re-target the payment source. When changed alongside amount or paidOn
    // the service reverses the existing ledger row and reposts a fresh DEBIT
    // so the account balance and audit trail stay coherent.
    bankAccountId: z.string().min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const expenseIdParamSchema = z.object({
  id: z.string().min(1),
});

// Accept numeric strings from the URL query and coerce to Number. The full
// decimal validator applies on create/update; here we only need a finite
// non-negative bound.
const amountFilterSchema = z
  .union([z.string(), z.number()])
  .transform((v) =>
    v === "" || v === null || v === undefined ? undefined : Number(v)
  )
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: "Must be a non-negative number",
  })
  .optional();

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  // FY scope for the listing. Mirrors the donation filter so a single
  // sidebar selector can drive both ledgers from the same context value.
  financialYearId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  activityId: z.string().min(1).optional(),
  createdById: z.string().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  minAmount: amountFilterSchema,
  maxAmount: amountFilterSchema,
  // Per-column filter + sort (DataTable).
  paidTo: textFilter,
  referenceNo: textFilter,
  ...sortSchema(["paidOn", "amount", "paidTo", "createdAt"]),
});
