import { prisma } from "./prisma.js";
import { ApiError } from "./apiError.js";

// Default fiscal year start when a foundation has not set one explicitly.
// April matches the Indian statutory FY; overridable per-foundation via
// Foundation.fyStartMonth (1..12).
export const DEFAULT_FY_START_MONTH = 4;

// UTC helper     keeps boundary math stable regardless of the server's local
// timezone. All FY windows are anchored at midnight UTC on the first of the
// start month.
function utcDate(year, monthZeroBased, day = 1) {
  return new Date(Date.UTC(year, monthZeroBased, day));
}

// Given a calendar date and a fiscal start month (1..12), returns the
// half-open window [startDate, endDate) that contains the date, plus the
// human-readable label used in the UI ("FY 2025-26" or "FY 2025" for
// January-start years). Pure function     no I/O.
export function computeFyWindow(date, fyStartMonth = DEFAULT_FY_START_MONTH) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw ApiError.badRequest("Invalid date for FY resolution");
  }
  const month = fyStartMonth >= 1 && fyStartMonth <= 12
    ? fyStartMonth
    : DEFAULT_FY_START_MONTH;
  const monthIdx = month - 1;

  // If the date falls before the start month within its calendar year, the
  // FY belongs to the previous year.
  const y = d.getUTCFullYear();
  const startYear = d.getUTCMonth() < monthIdx ? y - 1 : y;
  const endYear = startYear + 1;

  const startDate = utcDate(startYear, monthIdx, 1);
  const endDate = utcDate(endYear, monthIdx, 1);

  const label = month === 1
    ? `FY ${startYear}`
    : `FY ${startYear}-${String(endYear).slice(-2)}`;

  return { startDate, endDate, label };
}

// Fetches the foundation's configured fyStartMonth. Falls back to the
// default when the row is missing or the column is unset. Read-only    
// cheap enough to call inline; consumers batch via the resolve helpers.
export async function getFoundationFyStartMonth(foundationId) {
  if (!foundationId) throw ApiError.badRequest("foundationId is required");
  const found = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { fyStartMonth: true },
  });
  return found?.fyStartMonth ?? DEFAULT_FY_START_MONTH;
}

// Finds the FinancialYear row whose window contains `date` for the given
// foundation. Returns null when none exists yet. Uses half-open semantics
// (startDate <= date < endDate) to match the DB exclusion constraint.
export async function findFinancialYearForDate(foundationId, date) {
  if (!foundationId) throw ApiError.badRequest("foundationId is required");
  const d = date instanceof Date ? date : new Date(date);
  return prisma.financialYear.findFirst({
    where: {
      foundationId,
      startDate: { lte: d },
      endDate: { gt: d },
    },
  });
}

// Resolves a FinancialYear row for the given date, auto-creating one when
// `autoCreate` is true (the default). Auto-creation uses the foundation's
// configured fyStartMonth to derive the window and label. Concurrent
// creators are handled by catching Prisma's P2002 unique-violation and
// re-fetching     the DB constraint is the source of truth.
export async function resolveFinancialYearForDate(
  foundationId,
  date,
  { autoCreate = true } = {}
) {
  const existing = await findFinancialYearForDate(foundationId, date);
  if (existing) return existing;
  if (!autoCreate) return null;

  const fyStartMonth = await getFoundationFyStartMonth(foundationId);
  const { startDate, endDate, label } = computeFyWindow(date, fyStartMonth);
  try {
    return await prisma.financialYear.create({
      data: { foundationId, label, startDate, endDate, status: "ACTIVE" },
    });
  } catch (err) {
    if (err?.code === "P2002" || err?.code === "P2010") {
      const retry = await findFinancialYearForDate(foundationId, date);
      if (retry) return retry;
    }
    throw err;
  }
}

// Convenience     resolves the FY containing "now" (or a caller-supplied
// reference date). Used by dashboard KPIs and default report filters.
export async function resolveActiveFinancialYear(foundationId, refDate = new Date()) {
  return resolveFinancialYearForDate(foundationId, refDate, { autoCreate: true });
}

// Guard used by donation / expense services on create + update. Throws a
// 409 CONFLICT when the target FY is closed so the write is refused with
// a clear, actionable message. Accepts either a FinancialYear row or a
// null / undefined value (no-op, caller has nothing to enforce against).
export function ensureFyWritable(fy) {
  if (!fy) return;
  if (fy.status === "CLOSED") {
    throw ApiError.conflict(
      `Financial year "${fy.label}" is closed. Reopen it before recording transactions in this period.`,
      { code: "FY_CLOSED", financialYearId: fy.id }
    );
  }
}
