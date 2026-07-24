import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { buildOrderBy, applyColumnFilters } from "../../lib/listQuery.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";
import { PERMISSIONS, hasPermission } from "../../lib/permissions.js";
import {
  postTransaction,
  reverseTransactionFor,
  findDefaultBankAccount,
} from "../../lib/bankLedger.js";
import {
  resolveFinancialYearForDate,
  ensureFyWritable,
} from "../../lib/financialYear.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  categoryId: true,
  activityId: true,
  bankAccountId: true,
  financialYearId: true,
  createdById: true,
  amount: true,
  paidTo: true,
  paidOn: true,
  referenceNo: true,
  notes: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

// Restricts expense queries to rows the user created when they lack the
// expense:viewAll permission. Mirrors the donation ownership scope.
function ownershipWhere(user) {
  if (hasPermission(user, PERMISSIONS.EXPENSE_VIEW_ALL)) return {};
  return { createdById: user.id };
}

function buildWhere(
  user,
  {
    q,
    includeDeleted,
    foundationId,
    categoryId,
    activityId,
    createdById,
    from,
    to,
    minAmount,
    maxAmount,
  }
) {
  const where = { ...tenantWhere(user, foundationId), ...ownershipWhere(user) };
  if (categoryId) where.categoryId = categoryId;
  if (activityId) where.activityId = activityId;
  if (createdById) where.createdById = createdById;
  if (from || to) {
    where.paidOn = {};
    if (from) where.paidOn.gte = from;
    if (to) where.paidOn.lte = to;
  }
  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {};
    if (minAmount !== undefined) where.amount.gte = minAmount;
    if (maxAmount !== undefined) where.amount.lte = maxAmount;
  }
  if (q) {
    where.OR = [
      { paidTo: { contains: q, mode: "insensitive" } },
      { referenceNo: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user), ...ownershipWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.expense.findFirst({ where, select: PUBLIC_FIELDS });
}

// Validates that the referenced category exists, belongs to the given
// foundation, and is not soft-deleted. Called on create/update.
async function assertCategoryValid(foundationId, categoryId) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, foundationId, kind: "EXPENSE", isDeleted: false },
    select: { id: true },
  });
  if (!category) {
    throw ApiError.badRequest("Category not found in this foundation");
  }
}

// Validates that the referenced activity exists and belongs to the same
// foundation. Soft-deleted activities are rejected     an expense against an
// archived program is almost always a data-entry mistake.
async function assertActivityValid(foundationId, activityId) {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, foundationId, isDeleted: false },
    select: { id: true },
  });
  if (!activity) {
    throw ApiError.badRequest("Activity not found in this foundation");
  }
}

const EXPENSE_FILTERS = {
  paidTo: { type: "text" },
  referenceNo: { type: "text" },
};

const EXPENSE_SORT = {
  map: {
    paidOn: "paidOn",
    amount: "amount",
    paidTo: "paidTo",
    createdAt: "createdAt",
  },
  fallback: [{ paidOn: "desc" }, { createdAt: "desc" }],
};

export async function listExpenses(user, query) {
  const where = buildWhere(user, query);
  applyColumnFilters(where, query, EXPENSE_FILTERS);
  const orderBy = buildOrderBy(query.sortBy, query.sortDir, EXPENSE_SORT);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        ...PUBLIC_FIELDS,
        category: { select: { id: true, name: true } },
        activity: { select: { id: true, title: true } },
        bankAccount: {
          select: { id: true, label: true, accountNumber: true },
        },
      },
      orderBy,
      ...paging,
    }),
    prisma.expense.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getExpense(user, id) {
  const where = { id, ...tenantWhere(user), ...ownershipWhere(user) };
  const expense = await prisma.expense.findFirst({
    where,
    select: {
      ...PUBLIC_FIELDS,
      category: { select: { id: true, name: true } },
      activity: { select: { id: true, title: true } },
      bankAccount: {
        select: { id: true, label: true, accountNumber: true },
      },
    },
  });
  if (!expense) throw ApiError.notFound("Expense not found");
  return expense;
}


// Resolves the bank account an expense should debit. Bank accounts are now
// categorised by purpose (GENERAL / CSR) rather than payment mode, so the
// expense form lets the operator pick any active account regardless of
// category. When no explicit account is passed we fall back to the first
// default (any category), then to any active account, keeping the flow
// unblocked while still requiring a real account to satisfy the ledger FK.
async function resolveExpenseBankAccount(tx, foundationId, bankAccountIdInput) {
  if (bankAccountIdInput) {
    const acc = await tx.bankAccount.findFirst({
      where: { id: bankAccountIdInput, foundationId, isActive: true, isDeleted: false },
      select: { id: true, category: true, label: true },
    });
    if (!acc) {
      throw ApiError.notFound("Bank account not found", {
        code: "BANK_ACCOUNT_NOT_FOUND",
      });
    }
    return acc.id;
  }
  const def = await tx.bankAccount.findFirst({
    where: { foundationId, isDefault: true, isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (def) return def.id;
  const any = await tx.bankAccount.findFirst({
    where: { foundationId, isActive: true, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!any) {
    throw ApiError.unprocessable(
      "No bank account is configured for this foundation. Create one or pick an account explicitly.",
      { code: "BANK_ACCOUNT_REQUIRED" }
    );
  }
  return any.id;
}

export async function createExpense(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertCategoryValid(foundationId, input.categoryId);
  if (input.activityId) {
    await assertActivityValid(foundationId, input.activityId);
  }

  const { foundationId: _ignored, bankAccountId: bankAccountIdInput, ...rest } = input;
  const paidOn = rest.paidOn ?? new Date();
  const fy = await resolveFinancialYearForDate(foundationId, paidOn);
  ensureFyWritable(fy);

  const created = await prisma.$transaction(async (tx) => {
    const bankAccountId = await resolveExpenseBankAccount(
      tx, foundationId, bankAccountIdInput
    );
    const expense = await tx.expense.create({
      data: {
        ...rest,
        foundationId,
        createdById: user.id,
        paidOn,
        bankAccountId,
        financialYearId: fy?.id ?? null,
      },
      select: PUBLIC_FIELDS,
    });
    await postTransaction(tx, {
      foundationId,
      bankAccountId,
      financialYearId: fy?.id ?? null,
      type: "DEBIT",
      amount: expense.amount,
      entityType: "Expense",
      entityId: expense.id,
      expenseId: expense.id,
      occurredAt: paidOn,
      description: `Expense: ${expense.paidTo ?? "unspecified payee"}`,
    });
    return expense;
  });

  await recordAudit({
    action: "CREATE",
    entity: "Expense",
    entityId: created.id,
    after: created,
    foundationId,
  });
  return created;
}

export async function updateExpense(user, id, input) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Expense not found");

  // Re-validate FK targets whenever they change. `null` on activityId is an
  // explicit clear     the schema allows it and we skip validation in that case.
  if (input.categoryId && input.categoryId !== before.categoryId) {
    await assertCategoryValid(before.foundationId, input.categoryId);
  }
  if (input.activityId) {
    await assertActivityValid(before.foundationId, input.activityId);
  }

  // Any change to the ledger-shaping fields (amount, account, paidOn) requires
  // a reverse-and-repost so balances stay correct. Text-only edits (notes,
  // paidTo, referenceNo) skip the ledger cycle. bankAccountId === undefined
  // means "no change"; explicit null would be a clear, but we don't allow that
  //     every expense keeps an account.
  const amountChanged = input.amount !== undefined && String(input.amount) !== String(before.amount);
  const accountChanged =
    input.bankAccountId !== undefined && input.bankAccountId !== before.bankAccountId;
  const paidOnChanged =
    input.paidOn !== undefined &&
    new Date(input.paidOn).getTime() !== new Date(before.paidOn).getTime();
  const ledgerImpact = amountChanged || accountChanged || paidOnChanged;

  // FY guard: block the update when either the source or destination period is
  // closed. We resolve the destination FY only when paidOn is actually changing.
  if (before.financialYearId) {
    const fyBefore = await prisma.financialYear.findUnique({
      where: { id: before.financialYearId },
    });
    ensureFyWritable(fyBefore);
  }
  const nextPaidOn = paidOnChanged ? new Date(input.paidOn) : before.paidOn;
  const fyAfter = ledgerImpact
    ? await resolveFinancialYearForDate(before.foundationId, nextPaidOn)
    : null;
  if (ledgerImpact) ensureFyWritable(fyAfter);

  const after = await prisma.$transaction(async (tx) => {
    if (ledgerImpact) {
      // Reverse the current posting first     this frees the ledger slot for a
      // fresh one keyed to the new amount/account/date.
      await reverseTransactionFor(tx, before.foundationId, "Expense", id);
    }

    const nextAccountId = accountChanged
      ? await resolveExpenseBankAccount(tx, before.foundationId, input.bankAccountId)
      : before.bankAccountId;

    const { bankAccountId: _bai, ...restInput } = input;
    const updated = await tx.expense.update({
      where: { id },
      data: {
        ...restInput,
        ...(accountChanged ? { bankAccountId: nextAccountId } : {}),
        ...(ledgerImpact ? { financialYearId: fyAfter?.id ?? null } : {}),
      },
      select: PUBLIC_FIELDS,
    });

    if (ledgerImpact) {
      await postTransaction(tx, {
        foundationId: before.foundationId,
        bankAccountId: nextAccountId,
        financialYearId: fyAfter?.id ?? null,
        type: "DEBIT",
        amount: updated.amount,
        entityType: "Expense",
        entityId: updated.id,
        expenseId: updated.id,
        occurredAt: nextPaidOn,
        description: `Expense: ${updated.paidTo ?? "unspecified payee"}`,
      });
    }
    return updated;
  });

  await recordAudit({
    action: "UPDATE",
    entity: "Expense",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function deleteExpense(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Expense not found");

  // Reversal is a write     refuse in a closed FY so the period lock holds.
  if (before.financialYearId) {
    const fy = await prisma.financialYear.findUnique({
      where: { id: before.financialYearId },
    });
    ensureFyWritable(fy);
  }

  await prisma.$transaction(async (tx) => {
    await reverseTransactionFor(tx, before.foundationId, "Expense", id);
    await tx.expense.softDelete({ where: { id } });
  });
  await recordAudit({
    action: "DELETE",
    entity: "Expense",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreExpense(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.expense.findFirst({
    where: { id, isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted expense not found");

  await prisma.expense.restore({ where: { id } });
  const after = await findScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "Expense",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
