import { prisma } from "../../lib/prisma.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { tenantWhere } from "../../lib/tenantScope.js";

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
    type, entityType, accountKind, from, to,
  } = query;
  const where = { ...tenantWhere(user, foundationId) };
  if (bankAccountId) where.bankAccountId = bankAccountId;
  if (financialYearId) where.financialYearId = financialYearId;
  if (type) where.type = type;
  if (entityType) where.entityType = entityType;
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
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      ...paging,
    }),
    prisma.transaction.count({ where }),
  ]);
  return buildPage({
    items, total, page: query.page, pageSize: query.pageSize,
  });
}
