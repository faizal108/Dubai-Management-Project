import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

// Manual create is the exception, not the rule     auto-creation via
// resolveFinancialYearForDate handles the common path when a donation or
// expense is recorded. This schema exists so admins can pre-seed an FY
// (e.g. right after go-live) or create a custom window that doesn't align
// with the configured fyStartMonth. `label` is required so the UI has a
// stable, tenant-visible identifier; window dates are validated against
// each other via a refinement.
export const createFinancialYearSchema = z
  .object({
    // SUPERADMIN passes this explicitly; ADMIN/EMPLOYEE inherits from token.
    foundationId: z.string().min(1).optional(),
    label: z.string().trim().min(2, "Label is required").max(40),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((v) => v.endDate.getTime() > v.startDate.getTime(), {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

// PATCH     only the label and window can be edited via CRUD. Status
// changes go through the dedicated /close and /reopen endpoints so the
// audit trail records the intent explicitly.
export const updateFinancialYearSchema = z
  .object({
    label: z.string().trim().min(2).max(40).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(
    (v) =>
      !v.startDate ||
      !v.endDate ||
      v.endDate.getTime() > v.startDate.getTime(),
    { message: "endDate must be after startDate", path: ["endDate"] }
  );

export const financialYearIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listFinancialYearsQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
});
