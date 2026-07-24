import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { sortSchema, textFilter } from "../../lib/listQuery.js";

const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

// Read-only ledger listing. The append-only Transaction table is created
// server-side as a side effect of donation / expense mutations, so no
// create / update / delete schemas exist. Filters mirror the columns the
// UI needs to slice by (account, FY, direction, source entity, window).
export const listTransactionsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  bankAccountId: z.string().min(1).optional(),
  financialYearId: z.string().min(1).optional(),
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
  entityType: z.enum(["Donation", "Expense", "Transfer", "Manual"]).optional(),
  // Splits the ledger into the two "books" the accounting screens expect:
  //   cash — bank account has no accountNumber (petty cash / drawer)
  //   bank — bank account has an accountNumber (proper bank/UPI account)
  // Implemented as a relation predicate in buildWhere below rather than a
  // column on Transaction, so the classification stays derived from the
  // BankAccount row and can't drift.
  accountKind: z.enum(["cash", "bank"]).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  // Per-column filter + sort (DataTable).
  description: textFilter,
  ...sortSchema(["occurredAt", "amount", "type", "balanceAfter", "createdAt"]),
});
