import { Prisma } from "@prisma/client";
import { ApiError } from "./apiError.js";

// Loads the isDefault=true row for the given category. Returns null when
// nothing is configured     callers decide whether that's an error.
export async function findDefaultBankAccount(client, foundationId, category) {
  return client.bankAccount.findFirst({
    where: {
      foundationId,
      category,
      isDefault: true,
      isActive: true,
      isDeleted: false,
    },
    select: { id: true, category: true, balance: true, label: true },
  });
}

// Loads an account within tenant scope. Rejects inactive / missing / deleted
// rows with a clear code so the API surface stays predictable.
async function loadBankAccount(client, foundationId, bankAccountId) {
  const account = await client.bankAccount.findFirst({
    where: { id: bankAccountId, foundationId, isDeleted: false },
    select: { id: true, category: true, balance: true, label: true, isActive: true },
  });
  if (!account) {
    throw ApiError.notFound("Bank account not found", {
      code: "BANK_ACCOUNT_NOT_FOUND",
    });
  }
  if (!account.isActive) {
    throw ApiError.conflict(
      `Bank account "${account.label}" is inactive`,
      { code: "BANK_ACCOUNT_INACTIVE" }
    );
  }
  return account;
}

// Posts one ledger row + atomically updates the account balance. Must be
// invoked inside a Prisma $transaction     the caller passes `tx`. Handles
// insufficient-balance validation for DEBIT and back-links reversal rows
// to their originals in the same transaction so the chain is consistent.
export async function postTransaction(tx, {
  foundationId,
  bankAccountId,
  financialYearId,
  type,
  amount,
  entityType,
  entityId,
  donationId = null,
  expenseId = null,
  occurredAt,
  description,
  reversalOf = null,
}) {
  const account = await loadBankAccount(tx, foundationId, bankAccountId);
  const amountDec = new Prisma.Decimal(String(amount));
  const delta = type === "CREDIT" ? amountDec : amountDec.negated();
  const nextBalance = new Prisma.Decimal(account.balance.toString()).plus(delta);
  if (type === "DEBIT" && nextBalance.isNegative()) {
    throw ApiError.unprocessable(
      `Insufficient balance in "${account.label}"     need    ${amountDec.toString()}, have    ${account.balance.toString()}`,
      { code: "INSUFFICIENT_BALANCE" }
    );
  }
  await tx.bankAccount.update({
    where: { id: bankAccountId },
    data: { balance: nextBalance },
  });
  const row = await tx.transaction.create({
    data: {
      foundationId,
      bankAccountId,
      financialYearId: financialYearId ?? null,
      type,
      amount: amountDec,
      balanceAfter: nextBalance,
      entityType,
      entityId,
      donationId,
      expenseId,
      occurredAt: occurredAt ?? new Date(),
      description: description ?? null,
      reversalOf,
    },
  });
  if (reversalOf) {
    await tx.transaction.update({
      where: { id: reversalOf },
      data: { reversedBy: row.id },
    });
  }
  return row;
}

// Reverses the current live ledger row for a donation / expense (idempotent
// via the reversalOf / reversedBy chain). Returns null when there's nothing
// to reverse     e.g. a PENDING donation that never posted a CREDIT.
export async function reverseTransactionFor(tx, foundationId, entityType, entityId) {
  const original = await tx.transaction.findFirst({
    where: {
      foundationId,
      entityType,
      entityId,
      reversalOf: null,
      reversedBy: null,
    },
    orderBy: { createdAt: "asc" },
  });
  if (!original) return null;
  const oppositeType = original.type === "CREDIT" ? "DEBIT" : "CREDIT";
  return postTransaction(tx, {
    foundationId,
    bankAccountId: original.bankAccountId,
    financialYearId: original.financialYearId,
    type: oppositeType,
    amount: original.amount,
    entityType,
    entityId,
    donationId: original.donationId,
    expenseId: original.expenseId,
    occurredAt: new Date(),
    description: `Reversal of ${original.id}`,
    reversalOf: original.id,
  });
}
