import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { sortSchema, textFilter } from "../../lib/listQuery.js";

// Decimal-as-string on the wire, matching bankAccounts / donations / expenses.
// Must be strictly positive — a transfer of 0 is meaningless.
const moneySchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), {
    message: "amount must be a decimal with up to 2 decimal places",
  })
  .refine((v) => Number(v) > 0, { message: "amount must be greater than 0" });

// Annual interest rate as a percentage, e.g. "6.75". Up to 3 integer digits.
const interestRateSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), {
    message: "interestRate must be a percentage with up to 2 decimal places",
  });

const blankToUndef = z.literal("").transform(() => undefined);
const notesSchema = z.string().trim().max(2000).optional().or(blankToUndef);
const foundationId = z.string().min(1).optional();
const optionalDate = z.coerce.date().optional();

// Cash <-> bank. The bank side is required; the cash side is optional — when
// omitted the service resolves (or auto-creates) the "Cash in Hand" account in
// the bank account's fund category.
const cashToBankSchema = z.object({
  kind: z.literal("CASH_TO_BANK"),
  foundationId,
  toBankAccountId: z.string().min(1, "Destination bank account is required"),
  fromBankAccountId: z.string().min(1).optional(),
  amount: moneySchema,
  occurredAt: optionalDate,
  notes: notesSchema,
});

const bankToCashSchema = z.object({
  kind: z.literal("BANK_TO_CASH"),
  foundationId,
  fromBankAccountId: z.string().min(1, "Source bank account is required"),
  toBankAccountId: z.string().min(1).optional(),
  amount: moneySchema,
  occurredAt: optionalDate,
  notes: notesSchema,
});

// Park money into a new fixed deposit. amount == principal.
const bankToFdSchema = z.object({
  kind: z.literal("BANK_TO_FD"),
  foundationId,
  fromBankAccountId: z.string().min(1, "Source bank account is required"),
  amount: moneySchema,
  label: z.string().trim().min(2, "FD label is required").max(120),
  interestRate: interestRateSchema.optional(),
  maturityDate: optionalDate,
  bankName: z.string().trim().max(160).optional().or(blankToUndef),
  receiptNumber: z.string().trim().max(80).optional().or(blankToUndef),
  occurredAt: optionalDate, // openedOn
  notes: notesSchema,
});

// Return / mature a fixed deposit back to a bank account. returnAmount is the
// matured value (principal + interest) credited to the destination account.
const fdToBankSchema = z.object({
  kind: z.literal("FD_TO_BANK"),
  foundationId,
  fixedDepositId: z.string().min(1, "Fixed deposit is required"),
  toBankAccountId: z.string().min(1, "Destination bank account is required"),
  returnAmount: moneySchema,
  closedOn: optionalDate,
  notes: notesSchema,
});

export const createTransferSchema = z.discriminatedUnion("kind", [
  cashToBankSchema,
  bankToCashSchema,
  bankToFdSchema,
  fdToBankSchema,
]);

export const transferIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listTransfersQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  financialYearId: z.string().min(1).optional(),
  kind: z.enum(["CASH_TO_BANK", "BANK_TO_CASH", "BANK_TO_FD", "FD_TO_BANK"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // Per-column filter + sort (DataTable).
  notes: textFilter,
  ...sortSchema(["occurredAt", "amount", "kind", "createdAt"]),
});

export const listFixedDepositsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  financialYearId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
});
