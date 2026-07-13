import { z } from "zod";

// All stats queries accept an optional `foundationId`. For ADMIN this is
// ignored (always locked to their own foundation); for SUPERADMIN omitting
// it means "platform-wide aggregate", supplying it means "this foundation".
// `financialYearId` optionally pins the FY window (e.g. viewing last FY on
// the dashboard). When omitted, the active FY is used for FY-based math.
const baseQuery = z.object({
  foundationId: z.string().trim().min(1).optional(),
  financialYearId: z.string().trim().min(1).optional(),
});

export const summaryQuerySchema = baseQuery;

export const trendsQuerySchema = baseQuery.extend({
  range: z.enum(["6m", "12m", "ytd"]).default("6m"),
});

export const topDonorsQuerySchema = baseQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export const recentDonationsQuerySchema = baseQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export const pendingDonationsQuerySchema = baseQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});
