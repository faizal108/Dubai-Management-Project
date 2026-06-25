import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { tenantWhere } from "../../lib/tenantScope.js";

// All read paths are tenant-scoped: ADMIN is locked to their foundation,
// SUPERADMIN aggregates platform-wide unless a foundationId is supplied.
function scopeWhere(user, requested) {
  return tenantWhere(user, requested);
}

// Range -> start date. Months are zero-indexed, so subtracting (n-1) gives a
// window that includes the current month plus the n-1 prior months.
function rangeStart(range) {
  const now = new Date();
  if (range === "ytd") return new Date(now.getFullYear(), 0, 1);
  const months = range === "12m" ? 11 : 5;
  return new Date(now.getFullYear(), now.getMonth() - months, 1);
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

export async function getSummary(user, { foundationId }) {
  const where = scopeWhere(user, foundationId);

  const [received, pending, distinctDonors, printedCount] = await Promise.all([
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
  ]);

  // SUPERADMIN platform-wide view also surfaces foundation count to power
  // the "X active foundations" widget; ADMIN ignores this field.
  let foundationCount = null;
  if (user.role === "SUPERADMIN" && !foundationId) {
    foundationCount = await prisma.foundation.count({});
  }

  return {
    totalAmount: Number(received._sum.amount ?? 0),
    receivedCount: received._count._all,
    pendingAmount: Number(pending._sum.amount ?? 0),
    pendingCount: pending._count._all,
    donorCount: distinctDonors.length,
    printedCount,
    foundationCount,
  };
}

export async function getTrends(user, { range, foundationId }) {
  const where = scopeWhere(user, foundationId);
  const start = rangeStart(range);

  // Raw SQL handles the date_trunc bucketing; Prisma's groupBy doesn't
  // support computed group keys. The tenant filter is built carefully so a
  // null/missing foundationId leaves the AND clause empty.
  const foundationFilter = where.foundationId
    ? Prisma.sql`AND "foundationId" = ${where.foundationId}`
    : Prisma.empty;

  const monthlyRaw = await prisma.$queryRaw`
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
  `;

  // Fill missing months with zero rows so the line chart has a stable axis.
  const byMonth = new Map(
    monthlyRaw.map((r) => [
      r.month,
      { amount: Number(r.amount ?? 0), donorCount: Number(r.donor_count ?? 0) },
    ])
  );
  const monthly = monthKeys(start).map((month) => ({
    month,
    amount: byMonth.get(month)?.amount ?? 0,
    donorCount: byMonth.get(month)?.donorCount ?? 0,
  }));

  // Type breakdown over the same window — drives the pie chart.
  const byType = await prisma.donation.groupBy({
    by: ["type"],
    where: { ...where, donationDate: { gte: start } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  return {
    range,
    monthly,
    byType: byType.map((b) => ({
      type: b.type,
      amount: Number(b._sum.amount ?? 0),
      count: b._count._all,
    })),
  };
}

export async function getTopDonors(user, { foundationId, limit }) {
  const where = scopeWhere(user, foundationId);

  const groups = await prisma.donation.groupBy({
    by: ["donorId"],
    where: { ...where, donationReceived: "RECEIVED" },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (groups.length === 0) return [];

  const donors = await prisma.donor.findMany({
    where: { id: { in: groups.map((g) => g.donorId) } },
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
