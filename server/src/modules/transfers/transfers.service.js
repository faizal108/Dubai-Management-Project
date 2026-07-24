import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { buildOrderBy, applyColumnFilters } from "../../lib/listQuery.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";
import { postTransaction, reverseTransactionFor } from "../../lib/bankLedger.js";
import {
  resolveFinancialYearForDate,
  ensureFyWritable,
} from "../../lib/financialYear.js";

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

const num = (v) => (v == null ? null : Number(v));

const ACCOUNT_SNIPPET = {
  select: { id: true, label: true, category: true, accountNumber: true },
};

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

// Interest earned is derived, never stored: return - principal (only meaningful
// once the FD is CLOSED and returnAmount is set).
function interestEarned(fd) {
  if (fd.returnAmount == null) return null;
  return Number(fd.returnAmount) - Number(fd.principal);
}

function serializeFixedDeposit(fd) {
  if (!fd) return null;
  return {
    id: fd.id,
    foundationId: fd.foundationId,
    financialYearId: fd.financialYearId,
    label: fd.label,
    category: fd.category,
    bankName: fd.bankName,
    receiptNumber: fd.receiptNumber,
    principal: num(fd.principal),
    interestRate: num(fd.interestRate),
    openedOn: fd.openedOn,
    maturityDate: fd.maturityDate,
    status: fd.status,
    returnAmount: num(fd.returnAmount),
    interestEarned: interestEarned(fd),
    closedOn: fd.closedOn,
    sourceBankAccount: serializeAccount(fd.sourceBankAccount),
    closedToBankAccount: serializeAccount(fd.closedToBankAccount),
    notes: fd.notes,
    createdAt: fd.createdAt,
    updatedAt: fd.updatedAt,
  };
}

function serializeTransfer(t) {
  if (!t) return null;
  return {
    id: t.id,
    foundationId: t.foundationId,
    financialYearId: t.financialYearId,
    kind: t.kind,
    amount: num(t.amount),
    fromBankAccount: serializeAccount(t.fromBankAccount),
    toBankAccount: serializeAccount(t.toBankAccount),
    fixedDeposit: t.fixedDeposit
      ? {
          id: t.fixedDeposit.id,
          label: t.fixedDeposit.label,
          status: t.fixedDeposit.status,
          principal: num(t.fixedDeposit.principal),
          returnAmount: num(t.fixedDeposit.returnAmount),
        }
      : null,
    occurredAt: t.occurredAt,
    notes: t.notes,
    createdAt: t.createdAt,
  };
}

const TRANSFER_INCLUDE = {
  fromBankAccount: ACCOUNT_SNIPPET,
  toBankAccount: ACCOUNT_SNIPPET,
  fixedDeposit: {
    select: {
      id: true,
      label: true,
      status: true,
      principal: true,
      returnAmount: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Internal loaders / guards (operate inside the caller's tx)
// ---------------------------------------------------------------------------

// Loads a tenant-scoped, active account and asserts its kind. `expectKind` is
// "bank" (accountNumber set) or "cash" (accountNumber null). Cash vs bank is
// derived exactly the way accounting.service.js / transactions.service.js do.
async function loadAccount(tx, foundationId, id, expectKind) {
  if (!id) throw ApiError.badRequest("Account is required");
  const acc = await tx.bankAccount.findFirst({
    where: { id, foundationId, isDeleted: false },
    select: {
      id: true,
      label: true,
      category: true,
      accountNumber: true,
      isActive: true,
      bankName: true,
    },
  });
  if (!acc) {
    throw ApiError.notFound("Bank account not found", {
      code: "BANK_ACCOUNT_NOT_FOUND",
    });
  }
  if (!acc.isActive) {
    throw ApiError.conflict(`Bank account "${acc.label}" is inactive`, {
      code: "BANK_ACCOUNT_INACTIVE",
    });
  }
  const kind = acc.accountNumber ? "bank" : "cash";
  if (expectKind && kind !== expectKind) {
    throw ApiError.unprocessable(
      expectKind === "bank"
        ? `"${acc.label}" is a cash account — pick a bank account`
        : `"${acc.label}" is a cash account holder — pick a cash account`,
      { code: "ACCOUNT_KIND_MISMATCH" }
    );
  }
  return acc;
}

// Finds the foundation's cash account for a fund category, auto-creating a
// "Cash in Hand" account when none exists (per product decision). Cash = a
// BankAccount with accountNumber = null.
async function ensureCashAccount(tx, foundationId, category) {
  const existing = await tx.bankAccount.findFirst({
    where: {
      foundationId,
      category,
      accountNumber: null,
      isDeleted: false,
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      category: true,
      accountNumber: true,
      isActive: true,
      bankName: true,
    },
  });
  if (existing) return existing;
  const label = category === "CSR" ? "Cash in Hand (CSR)" : "Cash in Hand";
  return tx.bankAccount.create({
    data: {
      foundationId,
      label,
      category,
      openingBalance: 0,
      balance: 0,
      isActive: true,
      isDefault: false,
      notes: "Auto-created for cash transfers",
    },
    select: {
      id: true,
      label: true,
      category: true,
      accountNumber: true,
      isActive: true,
      bankName: true,
    },
  });
}

async function reloadTransfer(tx, id) {
  return tx.transfer.findFirst({ where: { id }, include: TRANSFER_INCLUDE });
}

// ---------------------------------------------------------------------------
// Create — one branch per kind. All run inside a single $transaction so the
// ledger legs + balance updates + record inserts commit atomically.
// ---------------------------------------------------------------------------

async function createCashBankTransfer(tx, { foundationId, fy, movementDate, input }) {
  let bank, cash;
  if (input.kind === "CASH_TO_BANK") {
    bank = await loadAccount(tx, foundationId, input.toBankAccountId, "bank");
    cash = input.fromBankAccountId
      ? await loadAccount(tx, foundationId, input.fromBankAccountId, "cash")
      : await ensureCashAccount(tx, foundationId, bank.category);
  } else {
    bank = await loadAccount(tx, foundationId, input.fromBankAccountId, "bank");
    cash = input.toBankAccountId
      ? await loadAccount(tx, foundationId, input.toBankAccountId, "cash")
      : await ensureCashAccount(tx, foundationId, bank.category);
  }

  const fromId = input.kind === "CASH_TO_BANK" ? cash.id : bank.id;
  const toId = input.kind === "CASH_TO_BANK" ? bank.id : cash.id;
  const description =
    input.kind === "CASH_TO_BANK"
      ? `Cash deposited to ${bank.label}`
      : `Cash withdrawn from ${bank.label}`;

  const transfer = await tx.transfer.create({
    data: {
      foundationId,
      financialYearId: fy?.id ?? null,
      kind: input.kind,
      amount: input.amount,
      fromBankAccountId: fromId,
      toBankAccountId: toId,
      occurredAt: movementDate,
      notes: input.notes ?? null,
    },
  });

  // DEBIT the source first so the insufficient-balance guard fires before the
  // matching CREDIT lands.
  await postTransaction(tx, {
    foundationId,
    bankAccountId: fromId,
    financialYearId: fy?.id ?? null,
    type: "DEBIT",
    amount: input.amount,
    entityType: "Transfer",
    entityId: transfer.id,
    occurredAt: movementDate,
    description,
  });
  await postTransaction(tx, {
    foundationId,
    bankAccountId: toId,
    financialYearId: fy?.id ?? null,
    type: "CREDIT",
    amount: input.amount,
    entityType: "Transfer",
    entityId: transfer.id,
    occurredAt: movementDate,
    description,
  });

  return { transfer: await reloadTransfer(tx, transfer.id) };
}

async function createBankToFd(tx, { foundationId, fy, movementDate, input }) {
  const bank = await loadAccount(tx, foundationId, input.fromBankAccountId, "bank");

  const fd = await tx.fixedDeposit.create({
    data: {
      foundationId,
      financialYearId: fy?.id ?? null,
      label: input.label,
      category: bank.category,
      bankName: input.bankName ?? bank.bankName ?? null,
      receiptNumber: input.receiptNumber ?? null,
      principal: input.amount,
      interestRate: input.interestRate ?? null,
      openedOn: movementDate,
      maturityDate: input.maturityDate ?? null,
      sourceBankAccountId: bank.id,
      status: "ACTIVE",
      notes: input.notes ?? null,
    },
  });

  const transfer = await tx.transfer.create({
    data: {
      foundationId,
      financialYearId: fy?.id ?? null,
      kind: "BANK_TO_FD",
      amount: input.amount,
      fromBankAccountId: bank.id,
      fixedDepositId: fd.id,
      occurredAt: movementDate,
      notes: input.notes ?? null,
    },
  });

  await postTransaction(tx, {
    foundationId,
    bankAccountId: bank.id,
    financialYearId: fy?.id ?? null,
    type: "DEBIT",
    amount: input.amount,
    entityType: "Transfer",
    entityId: transfer.id,
    occurredAt: movementDate,
    description: `Fixed deposit opened: ${fd.label}`,
  });

  return { transfer: await reloadTransfer(tx, transfer.id), fdAfter: fd };
}

async function createFdToBank(tx, { foundationId, fy, movementDate, input }) {
  const fd = await tx.fixedDeposit.findFirst({
    where: { id: input.fixedDepositId, foundationId, isDeleted: false },
  });
  if (!fd) throw ApiError.notFound("Fixed deposit not found");
  if (fd.status !== "ACTIVE") {
    throw ApiError.conflict("Fixed deposit has already been returned", {
      code: "FD_ALREADY_CLOSED",
    });
  }
  const bank = await loadAccount(tx, foundationId, input.toBankAccountId, "bank");

  const transfer = await tx.transfer.create({
    data: {
      foundationId,
      financialYearId: fy?.id ?? null,
      kind: "FD_TO_BANK",
      amount: input.returnAmount,
      toBankAccountId: bank.id,
      fixedDepositId: fd.id,
      occurredAt: movementDate,
      notes: input.notes ?? null,
    },
  });

  const fdAfter = await tx.fixedDeposit.update({
    where: { id: fd.id },
    data: {
      status: "CLOSED",
      returnAmount: input.returnAmount,
      closedOn: movementDate,
      closedToBankAccountId: bank.id,
    },
  });

  await postTransaction(tx, {
    foundationId,
    bankAccountId: bank.id,
    financialYearId: fy?.id ?? null,
    type: "CREDIT",
    amount: input.returnAmount,
    entityType: "Transfer",
    entityId: transfer.id,
    occurredAt: movementDate,
    description: `Fixed deposit returned: ${fd.label}`,
  });

  return { transfer: await reloadTransfer(tx, transfer.id), fdBefore: fd, fdAfter };
}

export async function createTransfer(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  const movementDate =
    input.kind === "FD_TO_BANK"
      ? input.closedOn ?? new Date()
      : input.occurredAt ?? new Date();

  // Resolve + guard the financial year on the movement date (same rule the
  // donation / expense services apply). Refuses writes into a CLOSED FY.
  const fy = await resolveFinancialYearForDate(foundationId, movementDate);
  ensureFyWritable(fy);

  const out = await prisma.$transaction(async (tx) => {
    switch (input.kind) {
      case "CASH_TO_BANK":
      case "BANK_TO_CASH":
        return createCashBankTransfer(tx, { foundationId, fy, movementDate, input });
      case "BANK_TO_FD":
        return createBankToFd(tx, { foundationId, fy, movementDate, input });
      case "FD_TO_BANK":
        return createFdToBank(tx, { foundationId, fy, movementDate, input });
      default:
        throw ApiError.badRequest("Unsupported transfer kind");
    }
  });

  const serialized = serializeTransfer(out.transfer);
  await recordAudit({
    action: "CREATE",
    entity: "Transfer",
    entityId: serialized.id,
    after: serialized,
    foundationId,
  });
  if (out.fdAfter && input.kind === "BANK_TO_FD") {
    await recordAudit({
      action: "CREATE",
      entity: "FixedDeposit",
      entityId: out.fdAfter.id,
      after: serializeFixedDeposit(out.fdAfter),
      foundationId,
    });
  }
  if (out.fdAfter && input.kind === "FD_TO_BANK") {
    await recordAudit({
      action: "UPDATE",
      entity: "FixedDeposit",
      entityId: out.fdAfter.id,
      before: serializeFixedDeposit(out.fdBefore),
      after: serializeFixedDeposit(out.fdAfter),
      foundationId,
    });
  }
  return serialized;
}

// ---------------------------------------------------------------------------
// Reverse (soft-delete) — undoes every ledger leg and reverts the linked FD.
// ---------------------------------------------------------------------------

// Reverses every still-live ledger leg for a transfer. Cash<->bank transfers
// have two legs; FD transfers have one. reverseTransactionFor handles one live
// row per call, so we loop until none remain.
async function reverseAllLegs(tx, foundationId, transferId) {
  let guard = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await reverseTransactionFor(tx, foundationId, "Transfer", transferId)) {
    if (++guard > 4) break; // no transfer posts more than two legs
  }
}

export async function deleteTransfer(user, id) {
  const before = await prisma.transfer.findFirst({
    where: { id, ...tenantWhere(user) },
    include: TRANSFER_INCLUDE,
  });
  if (!before) throw ApiError.notFound("Transfer not found");

  // Can't reverse a movement dated inside a CLOSED financial year.
  if (before.financialYearId) {
    const fy = await prisma.financialYear.findFirst({
      where: { id: before.financialYearId },
    });
    ensureFyWritable(fy);
  }

  // Guard FD-linked reversals before touching the ledger.
  if (before.kind === "BANK_TO_FD" && before.fixedDepositId) {
    const fd = await prisma.fixedDeposit.findFirst({
      where: { id: before.fixedDepositId },
    });
    if (fd && fd.status !== "ACTIVE") {
      throw ApiError.conflict(
        "This deposit has already been returned. Reverse the FD → Bank transfer first.",
        { code: "FD_ALREADY_CLOSED" }
      );
    }
  }

  const out = await prisma.$transaction(async (tx) => {
    await reverseAllLegs(tx, before.foundationId, id);

    let fdBefore = null;
    let fdAfter = null;
    if (before.kind === "BANK_TO_FD" && before.fixedDepositId) {
      fdBefore = await tx.fixedDeposit.findFirst({
        where: { id: before.fixedDepositId },
      });
      if (fdBefore) {
        // The FD never really existed — soft-delete it.
        fdAfter = await tx.fixedDeposit.softDelete({ where: { id: fdBefore.id } });
      }
    } else if (before.kind === "FD_TO_BANK" && before.fixedDepositId) {
      fdBefore = await tx.fixedDeposit.findFirst({
        where: { id: before.fixedDepositId },
      });
      if (fdBefore) {
        // Re-open the deposit: it was never actually returned.
        fdAfter = await tx.fixedDeposit.update({
          where: { id: fdBefore.id },
          data: {
            status: "ACTIVE",
            returnAmount: null,
            closedOn: null,
            closedToBankAccountId: null,
          },
        });
      }
    }

    await tx.transfer.softDelete({ where: { id } });
    return { fdBefore, fdAfter };
  });

  await recordAudit({
    action: "DELETE",
    entity: "Transfer",
    entityId: id,
    before: serializeTransfer(before),
    foundationId: before.foundationId,
  });
  if (out.fdBefore) {
    await recordAudit({
      action: before.kind === "BANK_TO_FD" ? "DELETE" : "UPDATE",
      entity: "FixedDeposit",
      entityId: out.fdBefore.id,
      before: serializeFixedDeposit(out.fdBefore),
      after: out.fdAfter ? serializeFixedDeposit(out.fdAfter) : null,
      foundationId: before.foundationId,
    });
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const TRANSFER_SORT = {
  map: {
    occurredAt: "occurredAt",
    amount: "amount",
    kind: "kind",
    createdAt: "createdAt",
  },
  fallback: [{ occurredAt: "desc" }, { createdAt: "desc" }],
};

export async function listTransfers(user, query) {
  const where = { ...tenantWhere(user, query.foundationId) };
  if (query.financialYearId) where.financialYearId = query.financialYearId;
  if (query.kind) where.kind = query.kind;
  if (query.from || query.to) {
    where.occurredAt = {};
    if (query.from) where.occurredAt.gte = query.from;
    if (query.to) where.occurredAt.lte = query.to;
  }
  applyColumnFilters(where, query, { notes: { type: "text" } });
  const orderBy = buildOrderBy(query.sortBy, query.sortDir, TRANSFER_SORT);
  const paging = toPrismaPaging(query);
  const [rows, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy,
      ...paging,
    }),
    prisma.transfer.count({ where }),
  ]);
  return buildPage({
    items: rows.map(serializeTransfer),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

export async function listFixedDeposits(user, query) {
  const where = { ...tenantWhere(user, query.foundationId) };
  if (query.financialYearId) where.financialYearId = query.financialYearId;
  if (query.status) where.status = query.status;
  const paging = toPrismaPaging(query);
  const [rows, total] = await Promise.all([
    prisma.fixedDeposit.findMany({
      where,
      include: {
        sourceBankAccount: ACCOUNT_SNIPPET,
        closedToBankAccount: ACCOUNT_SNIPPET,
      },
      orderBy: [{ status: "asc" }, { openedOn: "desc" }, { createdAt: "desc" }],
      ...paging,
    }),
    prisma.fixedDeposit.count({ where }),
  ]);
  return buildPage({
    items: rows.map(serializeFixedDeposit),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}
