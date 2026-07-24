import { prisma } from "../../lib/prisma.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { buildOrderBy, applyColumnFilters } from "../../lib/listQuery.js";
import { tenantWhere } from "../../lib/tenantScope.js";

const TRANSACTION_FILTERS = {
  description: { type: "text" },
};

const TRANSACTION_SORT = {
  map: {
    occurredAt: "occurredAt",
    amount: "amount",
    type: "type",
    balanceAfter: "balanceAfter",
    createdAt: "createdAt",
  },
  fallback: [{ occurredAt: "desc" }, { createdAt: "desc" }],
};

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  bankAccountId: true,
  financialYearId: true,
  type: true,
  amount: true,
  balanceAfter: true,
  entityType: true,
  entityId: true,
  donationId: true,
  expenseId: true,
  occurredAt: true,
  description: true,
  reversalOf: true,
  reversedBy: true,
  createdAt: true,
};

export function buildWhere(user, query) {
  const {
    foundationId, bankAccountId, financialYearId,
    type, entityType, accountKind, from, to, q,
  } = query;
  const where = { ...tenantWhere(user, foundationId) };
  if (bankAccountId) where.bankAccountId = bankAccountId;
  if (financialYearId) where.financialYearId = financialYearId;
  if (type) where.type = type;
  if (entityType) where.entityType = entityType;
  // Global search across the ledger row's own text (description) and the
  // linked account label.
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { bankAccount: { is: { label: { contains: q, mode: "insensitive" } } } },
    ];
  }
  // Cash vs bank split is derived from BankAccount.accountNumber. Prisma
  // relation filters translate to an EXISTS join, so the ledger stays
  // scoped without a denormalized column.
  if (accountKind === "cash") {
    where.bankAccount = { is: { accountNumber: null } };
  } else if (accountKind === "bank") {
    where.bankAccount = { is: { accountNumber: { not: null } } };
  }
  if (from || to) {
    where.occurredAt = {};
    if (from) where.occurredAt.gte = from;
    if (to) where.occurredAt.lte = to;
  }
  return where;
}

export async function listTransactions(user, query) {
  const where = buildWhere(user, query);
  applyColumnFilters(where, query, TRANSACTION_FILTERS);
  const orderBy = buildOrderBy(query.sortBy, query.sortDir, TRANSACTION_SORT);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      select: {
        ...PUBLIC_FIELDS,
        bankAccount: {
          select: {
            id: true,
            label: true,
            category: true,
            accountNumber: true,
          },
        },
      },
      orderBy,
      ...paging,
    }),
    prisma.transaction.count({ where }),
  ]);
  return buildPage({
    items, total, page: query.page, pageSize: query.pageSize,
  });
}
