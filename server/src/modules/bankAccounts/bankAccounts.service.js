import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";

const PUBLIC_FIELDS = {
  id: true, foundationId: true, label: true, category: true,
  bankName: true, accountNumber: true, ifsc: true, upiId: true,
  openingBalance: true, balance: true, isDefault: true, isActive: true,
  notes: true, isDeleted: true, deletedAt: true,
  createdAt: true, updatedAt: true,
};

function buildWhere(user, { q, includeDeleted, foundationId, category, isActive }) {
  const where = { ...tenantWhere(user, foundationId) };
  if (category) where.category = category;
  if (isActive !== undefined) where.isActive = isActive;
  if (q) {
    where.OR = [
      { label: { contains: q, mode: "insensitive" } },
      { bankName: { contains: q, mode: "insensitive" } },
      { accountNumber: { contains: q, mode: "insensitive" } },
      { upiId: { contains: q, mode: "insensitive" } },
    ];
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findScoped(user, id) {
  return prisma.bankAccount.findFirst({
    where: { id, ...tenantWhere(user) },
    select: PUBLIC_FIELDS,
  });
}

async function assertLabelUnique(foundationId, label, { excludeId } = {}) {
  const dupe = await prisma.bankAccount.findFirst({
    where: {
      foundationId,
      label: { equals: label, mode: "insensitive" },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (dupe) throw ApiError.conflict("Bank account label already in use");
}

// Flips isDefault=false on every other active row in the same category so
// exactly one account per (foundationId, category) carries the flag. Runs
// inside the caller's tx so the swap is atomic with the write that
// triggered it (DB has a matching partial unique index as a safety net).
async function clearOtherDefaults(tx, foundationId, category, exceptId) {
  await tx.bankAccount.updateMany({
    where: {
      foundationId, category, isDefault: true, isDeleted: false,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

export async function listBankAccounts(user, query) {
  const where = buildWhere(user, query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: [{ category: "asc" }, { isDefault: "desc" }, { label: "asc" }],
      ...paging,
    }),
    prisma.bankAccount.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getBankAccount(user, id) {
  const acc = await findScoped(user, id);
  if (!acc) throw ApiError.notFound("Bank account not found");
  return acc;
}

export async function createBankAccount(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await assertLabelUnique(foundationId, input.label);
  const opening = input.openingBalance ?? "0";
  const created = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await clearOtherDefaults(tx, foundationId, input.category, null);
    }
    return tx.bankAccount.create({
      data: {
        foundationId,
        label: input.label,
        category: input.category,
        bankName: input.bankName ?? null,
        accountNumber: input.accountNumber ?? null,
        ifsc: input.ifsc ?? null,
        upiId: input.upiId ?? null,
        openingBalance: opening,
        balance: opening,
        isDefault: Boolean(input.isDefault),
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
      },
      select: PUBLIC_FIELDS,
    });
  });
  await recordAudit({
    action: "CREATE", entity: "BankAccount", entityId: created.id,
    after: created, foundationId,
  });
  return created;
}

export async function updateBankAccount(user, id, input) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Bank account not found");
  if (input.label && input.label.toLowerCase() !== before.label.toLowerCase()) {
    await assertLabelUnique(before.foundationId, input.label, { excludeId: id });
  }
  const after = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await clearOtherDefaults(tx, before.foundationId, before.category, id);
    }
    return tx.bankAccount.update({
      where: { id }, data: input, select: PUBLIC_FIELDS,
    });
  });
  await recordAudit({
    action: "UPDATE", entity: "BankAccount", entityId: id,
    before, after, foundationId: after.foundationId,
  });
  return after;
}

export async function deleteBankAccount(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Bank account not found");
  const [donationCount, expenseCount] = await Promise.all([
    prisma.donation.count({ where: { bankAccountId: id, isDeleted: false } }),
    prisma.expense.count({ where: { bankAccountId: id, isDeleted: false } }),
  ]);
  if (donationCount > 0 || expenseCount > 0) {
    throw ApiError.conflict(
      "Bank account has linked donations or expenses     deactivate it instead"
    );
  }
  await prisma.bankAccount.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE", entity: "BankAccount", entityId: id,
    before, foundationId: before.foundationId,
  });
}
