import { prisma } from "../../lib/prisma.js";
import { tenantWhere } from "../../lib/tenantScope.js";
import { resolveActiveFinancialYear } from "../../lib/financialYear.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { buildOrderBy, applyColumnFilters } from "../../lib/listQuery.js";

// Sort map for the income / expense ledger tables. Books ignore this and keep
// their ascending chronological order so the running balance reads correctly.
const LEDGER_SORT = {
  map: {
    occurredAt: "occurredAt",
    amount: "amount",
    balanceAfter: "balanceAfter",
  },
  fallback: [{ occurredAt: "desc" }, { createdAt: "desc" }],
};

// Serializable FY summary attached to every accounting payload so the client
// can render the "FY 2025-26" label without a follow-up call. Mirrors the
// helper in stats.service so the frontend can consume either payload with
// the same UI code.
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

// Resolves the FY row that anchors the accounting window. Returns null when
// the caller is platform-wide (SUPERADMIN without foundationId) — the
// dashboard tiles gracefully render "—" in that case.
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

// Sums the ledger for a given tenant/FY window split by CREDIT vs DEBIT.
// Uses Transaction as the single source of truth (donations + expenses both
// append here) so cash and bank books stay reconciled with the dashboard.
// Internal transfers (entityType "Transfer") are EXCLUDED — a cash->bank move
// is neither income nor expense, so counting its legs would inflate both.
async function sumLedger(where) {
  const notTransfer = { entityType: { not: "Transfer" } };
  const [credit, debit] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, ...notTransfer, type: "CREDIT" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, ...notTransfer, type: "DEBIT" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const income = Number(credit._sum.amount ?? 0);
  const expense = Number(debit._sum.amount ?? 0);
  return {
    income,
    incomeCount: credit._count._all,
    expense,
    expenseCount: debit._count._all,
    net: income - expense,
  };
}

// Per-bank-account balances scoped to the same tenant filter. The balance
// column on BankAccount is maintained transactionally by the donation/
// expense services, so this is a straight read; the account category and
// accountNumber let the client bucket rows into "cash" vs "bank" without
// hitting the ledger.
async function listAccountBalances(where) {
  const accounts = await prisma.bankAccount.findMany({
    where: { ...where, isDeleted: false, isActive: true },
    select: {
      id: true,
      label: true,
      category: true,
      bankName: true,
      accountNumber: true,
      openingBalance: true,
      balance: true,
      isDefault: true,
    },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  return accounts.map((a) => ({
    ...a,
    openingBalance: Number(a.openingBalance ?? 0),
    balance: Number(a.balance ?? 0),
    // Derived kind — matches the accountKind filter accepted by the
    // transactions listing endpoint so the two screens stay consistent.
    kind: a.accountNumber ? "bank" : "cash",
  }));
}

// Fixed-deposit holdings for the dashboard. activePrincipal is money currently
// parked (status ACTIVE); interestEarned is the lifetime gain realised on
// returned FDs (sum of returnAmount - principal over CLOSED rows). Not
// FY-scoped — FD holdings are a point-in-time position, not a period flow.
async function sumFixedDeposits(where) {
  const [active, closed] = await Promise.all([
    prisma.fixedDeposit.aggregate({
      where: { ...where, status: "ACTIVE" },
      _sum: { principal: true },
      _count: { _all: true },
    }),
    prisma.fixedDeposit.findMany({
      where: { ...where, status: "CLOSED" },
      select: { principal: true, returnAmount: true },
    }),
  ]);
  const interestEarned = closed.reduce(
    (s, fd) => s + (Number(fd.returnAmount ?? 0) - Number(fd.principal ?? 0)),
    0
  );
  return {
    activeCount: active._count._all,
    activePrincipal: Number(active._sum.principal ?? 0),
    interestEarned,
  };
}

// In-kind / other-income holdings for the dashboard. Non-cash receipts tracked
// separately from money — `estimatedValue` is informational and never mixed
// into the ledger totals above. FY-scoped by financialYearId when known.
async function sumOtherIncome(where, fy) {
  const w = { ...where };
  if (fy) w.financialYearId = fy.id;
  const agg = await prisma.otherIncome.aggregate({
    where: w,
    _sum: { estimatedValue: true },
    _count: { _all: true },
  });
  return {
    count: agg._count._all,
    estimatedValue: Number(agg._sum.estimatedValue ?? 0),
  };
}

// Dashboard aggregate. Returns FY-scoped totals for the top tiles plus a
// cash/bank breakdown and per-account balances so the UI can render the
// full accounting overview from one call.
export async function getAccountingSummary(user, { foundationId, financialYearId }) {
  const where = tenantWhere(user, foundationId);
  const fy = await resolveFyContext(where, financialYearId);
  const fyWhere = fy
    ? { ...where, financialYearId: fy.id }
    : { ...where };

  const [totals, cashTotals, bankTotals, accounts, fixedDeposits, otherIncome] = await Promise.all([
    sumLedger(fyWhere),
    sumLedger({ ...fyWhere, bankAccount: { is: { accountNumber: null } } }),
    sumLedger({ ...fyWhere, bankAccount: { is: { accountNumber: { not: null } } } }),
    listAccountBalances(where),
    sumFixedDeposits(where),
    sumOtherIncome(where, fy),
  ]);

  // Split the account balances by derived kind so the UI can render the
  // "Cash on hand" and "Bank balances" cards without post-processing.
  const cashAccounts = accounts.filter((a) => a.kind === "cash");
  const bankAccounts = accounts.filter((a) => a.kind === "bank");
  const cashOnHand = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const bankOnHand = bankAccounts.reduce((s, a) => s + a.balance, 0);

  return {
    financialYear: serializeFy(fy),
    totals,
    cash: { ...cashTotals, onHand: cashOnHand, accounts: cashAccounts },
    bank: { ...bankTotals, onHand: bankOnHand, accounts: bankAccounts },
    fixedDeposits,
    otherIncome,
    accounts,
  };
}


// Small serializer for the bank-account snippet embedded in ledger / book
// rows. Keeps client rendering consistent across screens (kind is derived
// the same way the /summary payload derives it).
function serializeAccount(a) {
  if (!a) return null;
  return {
    id: a.id,
    label: a.label,
    category: a.category,
    accountNumber: a.accountNumber,
    kind: a.accountNumber ? "bank" : "cash",
  };
}

// Resolves the effective date window for a ledger/book/report query. Priority:
// explicit from/to (either or both) > FY window > null (unbounded). `fy` is
// the FY row when known, so callers get a consistent [startDate, endDate)
// window that matches how transactions are FY-tagged.
function resolveWindow({ from, to, fy }) {
  const start = from ?? (fy ? fy.startDate : null);
  const end = to ?? (fy ? fy.endDate : null);
  return { start, end };
}

// Builds the Transaction `where` used by ledger / book listings. `type` is
// CREDIT for income listings and DEBIT for expense listings; books pass a
// `kind` predicate on bankAccount.accountNumber. The FY filter is applied
// via financialYearId when we resolved one — that column is populated on
// every new ledger row.
function buildLedgerWhere(user, query, { type, kind, fy }) {
  const where = { ...tenantWhere(user, query.foundationId) };
  if (query.bankAccountId) where.bankAccountId = query.bankAccountId;
  if (type) where.type = type;
  // Income / expense ledgers (kind null) list donation/expense activity only —
  // internal transfers are excluded. Cash / bank books (kind set) intentionally
  // KEEP transfer rows so the running balance column reconciles.
  if (!kind) where.entityType = { not: "Transfer" };
  if (kind === "cash") where.bankAccount = { is: { accountNumber: null } };
  if (kind === "bank") where.bankAccount = { is: { accountNumber: { not: null } } };
  if (fy) where.financialYearId = fy.id;
  const { start, end } = resolveWindow({ from: query.from, to: query.to, fy: null });
  if (start || end) {
    where.occurredAt = {};
    if (start) where.occurredAt.gte = start;
    if (end) where.occurredAt.lt = end;
  }
  return where;
}

// Shared select for ledger / book rows. Income listings care about the
// donation join (donor + category); expense listings care about the expense
// join (category + activity + paidTo). Both selects are cheap composite
// reads on already-indexed FKs.
const LEDGER_ROW_SELECT = {
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
  bankAccount: {
    select: { id: true, label: true, category: true, accountNumber: true },
  },
  donation: {
    select: {
      id: true,
      donationDate: true,
      transactionDate: true,
      type: true,
      category: true,
      utr: true,
      chequeNumber: true,
      donorNameSnapshot: true,
      donorPhoneSnapshot: true,
      donor: { select: { id: true, fullName: true, phone: true } },
    },
  },
  expense: {
    select: {
      id: true,
      paidOn: true,
      paidTo: true,
      referenceNo: true,
      category: { select: { id: true, name: true } },
      activity: { select: { id: true, title: true } },
    },
  },
};

// Shapes a raw Transaction row into the ledger/book response envelope. Keeps
// numeric fields as Numbers (Decimal stringifies otherwise) and flattens the
// bank-account snippet via serializeAccount so the client renders `kind`
// without post-processing.
function serializeLedgerRow(row) {
  return {
    id: row.id,
    foundationId: row.foundationId,
    bankAccountId: row.bankAccountId,
    financialYearId: row.financialYearId,
    type: row.type,
    amount: Number(row.amount ?? 0),
    balanceAfter: Number(row.balanceAfter ?? 0),
    entityType: row.entityType,
    entityId: row.entityId,
    donationId: row.donationId,
    expenseId: row.expenseId,
    occurredAt: row.occurredAt,
    description: row.description,
    reversalOf: row.reversalOf,
    reversedBy: row.reversedBy,
    createdAt: row.createdAt,
    bankAccount: serializeAccount(row.bankAccount),
    donation: row.donation
      ? {
          ...row.donation,
          donorName:
            row.donation.donor?.fullName ?? row.donation.donorNameSnapshot ?? null,
          donorPhone:
            row.donation.donor?.phone ?? row.donation.donorPhoneSnapshot ?? null,
        }
      : null,
    expense: row.expense
      ? {
          ...row.expense,
          categoryName: row.expense.category?.name ?? null,
          activityTitle: row.expense.activity?.title ?? null,
        }
      : null,
  };
}

// Generic ledger listing. Split by type + kind (see buildLedgerWhere). The
// running total (`totalAmount`) for the filtered window is returned alongside
// the page so the UI header can render "Total: ₹X" without a second call.
async function listLedger(user, query, { type, kind }) {
  const where = tenantWhere(user, query.foundationId);
  const fy = await resolveFyContext(where, query.financialYearId);
  const listWhere = buildLedgerWhere(user, query, { type, kind, fy });
  // Income / expense ledgers expose per-column search + sort (DataTable). The
  // chronological books keep their fixed ascending order + no column filters.
  if (!kind) applyColumnFilters(listWhere, query, { description: { type: "text" } });
  const paging = toPrismaPaging(query);
  // Cash / bank books read chronologically so the balanceAfter column reads
  // as a running balance. Income / expense ledgers read newest-first by
  // default, or by the caller's chosen sort column.
  const orderBy = kind
    ? [{ occurredAt: "asc" }, { createdAt: "asc" }]
    : buildOrderBy(query.sortBy, query.sortDir, LEDGER_SORT);
  const [rows, total, agg] = await Promise.all([
    prisma.transaction.findMany({
      where: listWhere,
      select: LEDGER_ROW_SELECT,
      orderBy,
      ...paging,
    }),
    prisma.transaction.count({ where: listWhere }),
    prisma.transaction.aggregate({ where: listWhere, _sum: { amount: true } }),
  ]);
  const page = buildPage({
    items: rows.map(serializeLedgerRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
  return {
    ...page,
    financialYear: serializeFy(fy),
    totalAmount: Number(agg._sum.amount ?? 0),
  };
}

// Public entry points. Thin wrappers so the controller / routes read cleanly.
export function listIncomeLedger(user, query) {
  return listLedger(user, query, { type: "CREDIT", kind: null });
}
export function listExpenseLedger(user, query) {
  return listLedger(user, query, { type: "DEBIT", kind: null });
}
export function listCashBook(user, query) {
  return listLedger(user, query, { type: null, kind: "cash" });
}
export function listBankBook(user, query) {
  return listLedger(user, query, { type: null, kind: "bank" });
}

// Computes the opening balance for a single account at `windowStart` — the
// balance carried forward from before the window. Uses the last transaction
// with occurredAt < windowStart; falls back to the account's openingBalance
// when the window predates the account's history.
async function computeOpeningBalance(account, windowStart) {
  if (!windowStart) return Number(account.openingBalance ?? 0);
  const last = await prisma.transaction.findFirst({
    where: { bankAccountId: account.id, occurredAt: { lt: windowStart } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: { balanceAfter: true },
  });
  if (last) return Number(last.balanceAfter);
  return Number(account.openingBalance ?? 0);
}

// Sums the credit / debit activity for one account inside a window. Used by
// the reports endpoint to build the per-account statement. Income / expense
// count donation/expense activity only; internal transfers are reported
// separately (transferIn / transferOut) so the closing balance still
// reconciles: closing = opening + income - expense + transferIn - transferOut.
async function sumAccountWindow(bankAccountId, start, end) {
  const where = { bankAccountId };
  if (start || end) {
    where.occurredAt = {};
    if (start) where.occurredAt.gte = start;
    if (end) where.occurredAt.lt = end;
  }
  const notTransfer = { entityType: { not: "Transfer" } };
  const isTransfer = { entityType: "Transfer" };
  const [credit, debit, transferCredit, transferDebit] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, ...notTransfer, type: "CREDIT" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, ...notTransfer, type: "DEBIT" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, ...isTransfer, type: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, ...isTransfer, type: "DEBIT" },
      _sum: { amount: true },
    }),
  ]);
  return {
    income: Number(credit._sum.amount ?? 0),
    incomeCount: credit._count._all,
    expense: Number(debit._sum.amount ?? 0),
    expenseCount: debit._count._all,
    transferIn: Number(transferCredit._sum.amount ?? 0),
    transferOut: Number(transferDebit._sum.amount ?? 0),
  };
}

// Reports endpoint. Returns an opening/closing statement per bank account for
// the resolved window (from/to overrides FY when both are present). Grand
// totals aggregate every account so the UI can render a single "Summary"
// row without re-summing client-side.
export async function getAccountingReport(user, query) {
  const where = tenantWhere(user, query.foundationId);
  const fy = await resolveFyContext(where, query.financialYearId);
  const { start, end } = resolveWindow({ from: query.from, to: query.to, fy });

  const accounts = await prisma.bankAccount.findMany({
    where: { ...where, isDeleted: false },
    select: {
      id: true,
      label: true,
      category: true,
      accountNumber: true,
      openingBalance: true,
      balance: true,
    },
    orderBy: [{ label: "asc" }],
  });

  const perAccount = await Promise.all(
    accounts.map(async (a) => {
      const [opening, movement] = await Promise.all([
        computeOpeningBalance(a, start),
        sumAccountWindow(a.id, start, end),
      ]);
      const transferNet = movement.transferIn - movement.transferOut;
      const closing =
        opening + movement.income - movement.expense + transferNet;
      return {
        account: serializeAccount(a),
        opening,
        income: movement.income,
        incomeCount: movement.incomeCount,
        expense: movement.expense,
        expenseCount: movement.expenseCount,
        transferIn: movement.transferIn,
        transferOut: movement.transferOut,
        transferNet,
        net: movement.income - movement.expense,
        closing,
      };
    })
  );

  const totals = perAccount.reduce(
    (acc, r) => ({
      opening: acc.opening + r.opening,
      income: acc.income + r.income,
      incomeCount: acc.incomeCount + r.incomeCount,
      expense: acc.expense + r.expense,
      expenseCount: acc.expenseCount + r.expenseCount,
      transferIn: acc.transferIn + r.transferIn,
      transferOut: acc.transferOut + r.transferOut,
      transferNet: acc.transferNet + r.transferNet,
      net: acc.net + r.net,
      closing: acc.closing + r.closing,
    }),
    {
      opening: 0, income: 0, incomeCount: 0, expense: 0, expenseCount: 0,
      transferIn: 0, transferOut: 0, transferNet: 0, net: 0, closing: 0,
    }
  );

  const cash = perAccount.filter((r) => r.account.kind === "cash");
  const bank = perAccount.filter((r) => r.account.kind === "bank");

  return {
    financialYear: serializeFy(fy),
    window: { start, end },
    totals,
    cash,
    bank,
    accounts: perAccount,
  };
}