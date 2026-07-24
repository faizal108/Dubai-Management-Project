import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { sortSchema, textFilter } from "../../lib/listQuery.js";

const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" });

const blankToUndef = z.literal("").transform(() => undefined);
const optionalString = (max) => z.string().trim().max(max).optional().or(blankToUndef);

// Non-negative decimal-as-string (quantity / estimated value).
const decimal = (label) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
    .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), {
      message: `${label} must be a non-negative number with up to 2 decimals`,
    });

export const createOtherIncomeSchema = z.object({
  foundationId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional().or(blankToUndef),
  donorId: z.string().min(1).optional().or(blankToUndef),
  donorName: optionalString(160),
  itemName: z.string().trim().min(1, "Item is required").max(200),
  quantity: decimal("quantity").optional(), // defaults to 1 server-side
  unit: optionalString(40),
  estimatedValue: decimal("estimatedValue").optional().or(blankToUndef),
  receivedOn: isoDateSchema,
  activityId: z.string().min(1).optional().or(blankToUndef),
  notes: optionalString(2000),
});

export const updateOtherIncomeSchema = z
  .object({
    categoryId: z.string().min(1).nullable().optional(),
    donorId: z.string().min(1).nullable().optional(),
    donorName: z.string().trim().max(160).nullable().optional(),
    itemName: z.string().trim().min(1).max(200).optional(),
    quantity: decimal("quantity").optional(),
    unit: z.string().trim().max(40).nullable().optional(),
    estimatedValue: decimal("estimatedValue").nullable().optional(),
    receivedOn: isoDateSchema.optional(),
    activityId: z.string().min(1).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const otherIncomeIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listOtherIncomeQuerySchema = paginationQuerySchema.extend({
  foundationId: z.string().min(1).optional(),
  financialYearId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  activityId: z.string().min(1).optional(),
  createdById: z.string().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  // Per-column filter + sort (DataTable).
  itemName: textFilter,
  ...sortSchema(["receivedOn", "itemName", "quantity", "estimatedValue", "createdAt"]),
});
