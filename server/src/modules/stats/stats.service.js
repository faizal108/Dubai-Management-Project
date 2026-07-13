import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { tenantWhere } from "../../lib/tenantScope.js";
import { resolveActiveFinancialYear } from "../../lib/financialYear.js";

// All read paths are tenant-scoped: ADMIN is locked to their foundation,
// SUPERADMIN aggregates platform-wide unless a foundationId is supplied.
function scopeWhere(user, requested) {
  return tenantWhere(user, requested);
}

// Range -> start date. Months are zero-indexed, so subtracting (n-1) gives a
// window that includes the current month plus the n-1 prior months. `ytd`
// falls back to the calendar year when we don't have an FY anchor (platform-
// wide SUPERADMIN view); caller passes the FY start when available.
function rangeStart(range, fyStart) {
  const now = new Date();
  if (range === "ytd") return fyStart ?? new Date(now.getFullYear(), 0, 1);
  const months = range === "12m" ? 11 : 5;
  return new Date(now.getFullYear(), now.getMonth() - months, 1);
}

// Resolves the FY row to anchor FYTD math on. Returns null when the caller
// is in a platform-wide scope (SUPERADMIN without foundationId)     FYTD is a
// foundation-level concept and can't be computed across tenants. When
// `financialYearId` is supplied we honour it; otherwise the active FY for
// the resolved foundation is used (auto-created on first read).
async function resolveFyContext(where, financialYearId) {
  if (!where.foundationId) return null;
  if (financialYearId) {
    const fy = await prisma.financialYear.findFirst({
      where: { id: financialYearId, foundationId: where.foundationId },
    });
    if (fy) return fy;
  }
  return resolveActiveFinancialYear(where.foundationId);
}

// Serializable FY summary attached to stats payloads so the client can render
// the "FYTD (FY 2025-26)" label without a follow-up call.
function serializeFy(fy) {
  if (!fy) return null;
  return {
    id: fy.id,
    label: fy.label,
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: fy.status,
  };
}

// Pre-seed an array of month keys (YYYY-MM) from `start` to today so the
// frontend renders a continuous x-axis even when a bucket has no rows.
function monthKeys(start) {
  const out = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const now = new Date();
  while (cur <= now) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export async function getSummary(user, { foundationId, financialYearId }) {
  const where = scopeWhere(user, foundationId);
  const fy = await resolveFyContext(where, financialYearId);

  // FY-scoped window for FYTD tiles. When there's no FY (platform-wide
  // SUPERADMIN view) the tiles fall back to null so the UI can render "   ".
  const fyStart = fy?.startDate ?? null;
  const fyEnd = fy?.endDate ?? null;
  const fyRange = fyStart && fyEnd ? { gte: fyStart, lt: fyEnd } : null;

  // Foundation filter for the raw-SQL tier mix. Mirrors the pattern used in
  // getTrends so a null/missing foundationId leaves the AND clause empty
  // (platform-wide SUPERADMIN view).
  const foundationFilter = where.foundationId
    ? Prisma.sql`AND d."foundationId" = ${where.foundationId}`
    : Prisma.empty;

  const [
    received,
    pending,
    distinctDonors,
    printedCount,
    expenseAgg,
    fytdDonations,
    fytdExpenses,
    whatsappOptInCount,
    whatsappSentCount,
    tierMixRaw,
  ] = await Promise.all([
    prisma.donation.aggregate({
      where: { ...where, donationReceived: "RECEIVED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.donation.aggregate({
      where: { ...where, donationReceived: "PENDING" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.donation.findMany({
      where,
      distinct: ["donorId"],
      select: { donorId: true },
    }),
    prisma.donation.count({ where: { ...where, isPrinted: true } }),
    // Expense totals reuse the same tenant scope. All-time / non-deleted;
    // range-filtered totals belong on the trends endpoint.
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // FYTD donations     keyed by donationDate against the resolved FY window.
    // When there's no FY (platform-wide) we short-circuit to an empty
    // aggregate so downstream reads pick up zeroes without extra guards.
    fyRange
      ? prisma.donation.aggregate({
          where: { ...where, donationDate: fyRange },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : Promise.resolve({ _sum: { amount: 0 }, _count: { _all: 0 } }),
    // FYTD expenses     keyed by paidOn against the same FY window.
    fyRange
      ? prisma.expense.aggregate({
          where: { ...where, paidOn: fyRange },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : Promise.resolve({ _sum: { amount: 0 }, _count: { _all: 0 } }),
    // WhatsApp delivery numerator/denominator. optIn is the denominator (only
    // donations where the donor consented), sent is the numerator (delivery
    // attempt succeeded     whatsappSentAt is populated by the worker).
    prisma.donation.count({ where: { ...where, whatsappOptIn: true } }),
    prisma.donation.count({
      where: { ...where, whatsappSentAt: { not: null } },
    }),
    // Donor tier mix: bucket every non-deleted donation into tier1 (PAN),
    // tier2 (phone only), or tier3 (anonymous / donorId-less). Raw SQL lets
    // us LEFT JOIN Donor once and derive the tier in a single scan.
    prisma.$queryRaw`
      SELECT
        CASE
          WHEN d."donorId" IS NULL THEN 'tier3'
          WHEN dn."pan" IS NOT NULL AND dn."pan" <> '' THEN 'tier1'
          WHEN dn."phone" IS NOT NULL AND dn."phone" <> '' THEN 'tier2'
          ELSE 'tier3'
        END AS tier,
        COUNT(*)::int AS count,
        COALESCE(SUM(d."amount"), 0)::float AS amount
      FROM "Donation" d
      LEFT JOIN "Donor" dn ON dn."id" = d."donorId"
      WHERE d."isDeleted" = false
        ${foundationFilter}
      GROUP BY 1
    `,
  ]);

  // SUPERADMIN platform-wide view also surfaces foundation count to power
  // the "X active foundations" widget; ADMIN ignores this field.
  let foundationCount = null;
  if (user.role === "SUPERADMIN" && !foundationId) {
    foundationCount = await prisma.foundation.count({});
  }

  const totalAmount = Number(received._sum.amount ?? 0);
  const totalExpense = Number(expenseAgg._sum.amount ?? 0);

  // Normalize the tier mix into a fixed { tier1, tier2, tier3 } shape so the
  // frontend can render the pie without null-guarding each bucket.
  const donorTierMix = { tier1: { count: 0, amount: 0 }, tier2: { count: 0, amount: 0 }, tier3: { count: 0, amount: 0 } };
  for (const row of tierMixRaw) {
    const key = row.tier;
    if (donorTierMix[key]) {
      donorTierMix[key] = {
        count: Number(row.count ?? 0),
        amount: Number(row.amount ?? 0),
      };
    }
  }

  return {
    totalAmount,
    receivedCount: received._count._all,
    pendingAmount: Number(pending._sum.amount ?? 0),
    pendingCount: pending._count._all,
    donorCount: distinctDonors.length,
    printedCount,
    foundationCount,
    // Expense KPIs     netBalance is RECEIVED donations minus expenses, matching
    // the "money left" figure operators expect on the dashboard.
    totalExpense,
    expenseCount: expenseAgg._count._all,
    netBalance: totalAmount - totalExpense,
    // FYTD momentum     surfaced as two tiles on the secondary KPI strip. Null
    // when platform-wide (SUPERADMIN without foundationId) so the UI can
    // gracefully render "   " instead of a misleading zero.
    fytdAmount: fyRange ? Number(fytdDonations._sum.amount ?? 0) : null,
    fytdCount: fyRange ? fytdDonations._count._all : null,
    fytdExpense: fyRange ? Number(fytdExpenses._sum.amount ?? 0) : null,
    fytdExpenseCount: fyRange ? fytdExpenses._count._all : null,
    // Context echo     lets the frontend label the tiles ("FYTD FY 2025-26")
    // and gate the FY selector state without an extra round-trip.
    financialYear: serializeFy(fy),
    // WhatsApp delivery     frontend computes the % client-side to keep the
    // divide-by-zero fallback ("   ") consistent with the printed-% tile.
    whatsappOptInCount,
    whatsappSentCount,
    donorTierMix,
  };
}

export async function getTrends(user, { range, foundationId, financialYearId }) {
  const where = scopeWhere(user, foundationId);
  // Anchor `ytd` to the resolved FY start when we have a foundation in scope;
  // rolling ranges (6m/12m) remain calendar-based since they're independent
  // of the fiscal calendar.
  const fy = range === "ytd" ? await resolveFyContext(where, financialYearId) : null;
  const start = rangeStart(range, fy?.startDate);

  // Raw SQL handles the date_trunc bucketing; Prisma's groupBy doesn't
  // support computed group keys. The tenant filter is built carefully so a
  // null/missing foundationId leaves the AND clause empty.
  const foundationFilter = where.foundationId
    ? Prisma.sql`AND "foundationId" = ${where.foundationId}`
    : Prisma.empty;

  // Donation + expense monthly buckets run in parallel so the dashboard can
  // render a "Donations vs. Expenses" chart from a single trends response.
  const [monthlyRaw, expenseMonthlyRaw, byType, expenseByCategoryRaw] =
    await Promise.all([
      prisma.$queryRaw`
        SELECT
          to_char(date_trunc('month', "donationDate"), 'YYYY-MM') AS month,
          SUM("amount")::float AS amount,
          COUNT(DISTINCT "donorId")::int AS donor_count
        FROM "Donation"
        WHERE "isDeleted" = false
          AND "donationDate" >= ${start}
          ${foundationFilter}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw`
        SELECT
          to_char(date_trunc('month', "paidOn"), 'YYYY-MM') AS month,
          SUM("amount")::float AS amount
        FROM "Expense"
        WHERE "isDeleted" = false
          AND "paidOn" >= ${start}
          ${foundationFilter}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // Type breakdown over the same window     drives the donation pie chart.
      prisma.donation.groupBy({
        by: ["type"],
        where: { ...where, donationDate: { gte: start } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // Expense-by-category breakdown parallel to `byType`     drives the
      // expense pie chart. Grouped by id so we can join category names.
      prisma.expense.groupBy({
        by: ["categoryId"],
        where: { ...where, paidOn: { gte: start } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

  // Fill missing months with zero rows so the line chart has a stable axis.
  const donationByMonth = new Map(
    monthlyRaw.map((r) => [
      r.month,
      { amount: Number(r.amount ?? 0), donorCount: Number(r.donor_count ?? 0) },
    ])
  );
  const expenseByMonth = new Map(
    expenseMonthlyRaw.map((r) => [r.month, Number(r.amount ?? 0)])
  );
  const monthly = monthKeys(start).map((month) => ({
    month,
    amount: donationByMonth.get(month)?.amount ?? 0,
    donorCount: donationByMonth.get(month)?.donorCount ?? 0,
    expenseAmount: expenseByMonth.get(month) ?? 0,
  }));

  // Resolve category names for the breakdown so the frontend can render
  // labels without a follow-up call.
  const categoryIds = expenseByCategoryRaw.map((r) => r.categoryId);
  const categories = categoryIds.length
    ? await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    range,
    monthly,
    byType: byType.map((b) => ({
      type: b.type,
      amount: Number(b._sum.amount ?? 0),
      count: b._count._all,
    })),
    byCategory: expenseByCategoryRaw.map((b) => ({
      categoryId: b.categoryId,
      categoryName: categoryNameById.get(b.categoryId) ?? "Unknown",
      amount: Number(b._sum.amount ?? 0),
      count: b._count._all,
    })),
    // Echo the FY context so the client can label the range picker
    // ("YTD (FY 2025-26)") when the range is FY-anchored.
    financialYear: serializeFy(fy),
  };
}

export async function getTopDonors(user, { foundationId, limit }) {
  const where = scopeWhere(user, foundationId);

  // Tier 3 anonymous donations have donorId=null; excluding them here keeps
  // "top donors" attributable and prevents a null bucket from leaking into
  // the donor.findMany lookup below (Prisma rejects null in `id: { in }`).
  const groups = await prisma.donation.groupBy({
    by: ["donorId"],
    where: {
      ...where,
      donationReceived: "RECEIVED",
      donorId: { not: null },
    },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  const donorIds = groups.map((g) => g.donorId).filter(Boolean);
  if (donorIds.length === 0) return [];

  const donors = await prisma.donor.findMany({
    where: { id: { in: donorIds } },
    select: { id: true, fullName: true, pan: true, foundationId: true },
  });
  const byId = new Map(donors.map((d) => [d.id, d]));

  return groups.map((g) => {
    const d = byId.get(g.donorId);
    return {
      donorId: g.donorId,
      fullName: d?.fullName ?? "Unknown",
      pan: d?.pan ?? null,
      foundationId: d?.foundationId ?? null,
      totalAmount: Number(g._sum.amount ?? 0),
      donationCount: g._count._all,
    };
  });
}

export async function getRecentDonations(user, { foundationId, limit }) {
  const where = scopeWhere(user, foundationId);
  const items = await prisma.donation.findMany({
    where,
    select: {
      id: true,
      amount: true,
      type: true,
      donationDate: true,
      donationReceived: true,
      isPrinted: true,
      foundationId: true,
      donor: { select: { id: true, fullName: true, pan: true } },
    },
    orderBy: [{ donationDate: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return items.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    type: d.type,
    donationDate: d.donationDate,
    status: d.donationReceived,
    isPrinted: d.isPrinted,
    foundationId: d.foundationId,
    donorName: d.donor?.fullName ?? "Unknown",
    donorPan: d.donor?.pan ?? null,
  }));
}

export async function getPendingDonations(user, { foundationId, limit }) {
  const where = scopeWhere(user, foundationId);
  const items = await prisma.donation.findMany({
    where: { ...where, donationReceived: "PENDING" },
    select: {
      id: true,
      amount: true,
      type: true,
      donationDate: true,
      foundationId: true,
      donorNameSnapshot: true,
      donorPhoneSnapshot: true,
      donor: { select: { id: true, fullName: true, phone: true } },
    },
    // Oldest-first so the operator chases the most stale commitments first.
    orderBy: [{ donationDate: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
  return items.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    type: d.type,
    donationDate: d.donationDate,
    foundationId: d.foundationId,
    // Fall back to the snapshot for anonymous rows (donorId=null). Keeps the
    // pending queue readable even when no Donor record exists.
    donorName: d.donor?.fullName ?? d.donorNameSnapshot ?? "Anonymous",
    donorPhone: d.donor?.phone ?? d.donorPhoneSnapshot ?? null,
  }));
}

