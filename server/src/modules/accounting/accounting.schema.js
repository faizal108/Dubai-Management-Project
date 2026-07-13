import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

// ISO date coercion shared by every accounting query. Accepts a Date instance
// or a parseable string; anything else is rejected before the handler sees it.
const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

// Every accounting screen is FY-scoped. `foundationId` follows the same
// convention as the stats module: SUPERADMIN can pass it to narrow,
// ADMIN/EMPLOYEE have it forced to their own foundation server-side.
// `financialYearId` is optional — the service falls back to the active FY.
export const accountingSummaryQuerySchema = z.object({
  foundationId: z.string().trim().min(1).optional(),
  financialYearId: z.string().trim().min(1).optional(),
});

// Income (CREDIT) and Expense (DEBIT) ledger listings share filters: tenant,
// FY, bank account, and an optional date window that overrides the FY when
// present. Pagination is standard offset/pageSize.
export const ledgerListQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().trim().min(1).optional(),
  financialYearId: z.string().trim().min(1).optional(),
  bankAccountId: z.string().trim().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

// Cash / Bank book listings mirror the ledger schema. The cash-vs-bank split
// lives in the route path (books/cash | books/bank) rather than a query flag
// so the client links are self-descriptive.
export const bookListQuerySchema = ledgerListQuerySchema;

// Reports are unpaginated aggregates over a window. Same tenant/FY/window
// filters as the ledger; no bankAccountId — the payload is per-account.
export const reportsQuerySchema = z.object({
  foundationId: z.string().trim().min(1).optional(),
  financialYearId: z.string().trim().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

// Transfer create payload. Moves funds atomically between two bank accounts
// via a paired DEBIT (source) + CREDIT (destination) on the append-only
// ledger. `foundationId` is honored only for SUPERADMIN; ADMIN/EMPLOYEE
// have it forced server-side. `occurredAt` defaults to "now" when omitted.
export const transferCreateSchema = z
  .object({
    foundationId: z.string().trim().min(1).optional(),
    sourceBankAccountId: z.string().trim().min(1),
    destinationBankAccountId: z.string().trim().min(1),
    amount: z.coerce.number().positive({ message: "Amount must be > 0" }),
    occurredAt: isoDateSchema.optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.sourceBankAccountId !== v.destinationBankAccountId,
    { message: "Source and destination must differ", path: ["destinationBankAccountId"] }
  );

// Transfer listing filters mirror the ledger schema minus the type split —
// transfers are surfaced as paired rows keyed by entityId.
export const transferListQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().trim().min(1).optional(),
  financialYearId: z.string().trim().min(1).optional(),
  bankAccountId: z.string().trim().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
