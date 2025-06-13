import { z } from "zod";

/**
 * 1. Define the raw object schema (no refine)
 */
const donationCore = z.object({
  donorId: z.string().cuid("Invalid donorId"),
  amount: z.preprocess(
    (val) => parseFloat(val),
    z.number().positive("Amount must be > 0")
  ),
  type: z.enum(["CASH", "CHEQUE", "ONLINE"], "Invalid donation type"),
  bankName: z.string().min(1, "Bank name is required"),
  utr: z.string().min(1, "UTR is required"),
  ifsc: z.string().min(1, "IFSC is required"),
  donationDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date")
    .optional(),
  transactionDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date")
    .optional(),
  donationReceived: z.enum(["PENDING", "RECEIVED"]).default("PENDING"),
});

/**
 * 2. Create schema: all required + refine transactionDate if RECEIVED
 */
export const createDonationSchema = donationCore.refine(
  (data) =>
    data.donationReceived === "PENDING" ||
    (data.donationReceived === "RECEIVED" && data.transactionDate),
  {
    message: "transactionDate is required when donationReceived is RECEIVED",
    path: ["transactionDate"],
  }
);

/**
 * 3. Update schema: partial on the core + same refine
 */
export const updateDonationSchema = donationCore
  .partial()
  .refine(
    (data) =>
      data.donationReceived !== "RECEIVED" ||
      (data.donationReceived === "RECEIVED" && data.transactionDate),
    {
      message: "transactionDate is required when donationReceived is RECEIVED",
      path: ["transactionDate"],
    }
  );

/**
 * 4. Pagination and search schemas remain unchanged
 */
export const paginationSchema = z.object({
  pageNo: z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .default("0"),
  pageSize: z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .default("20"),
});

export const searchDonationsSchema = z
  .object({
    name: z.string().min(1).optional(),
    pan: z.string().min(1).optional(),
  })
  .refine((data) => data.name || data.pan, {
    message: "Either name or pan must be provided",
  });
