import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { buildOrderBy, applyColumnFilters } from "../../lib/listQuery.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";
import { PERMISSIONS, hasPermission } from "../../lib/permissions.js";
import { sendDonationReceipt } from "../notifications/whatsapp/index.js";
import { logger } from "../../lib/logger.js";
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
  donorId: true,
  // Snapshots survive donor edits / deletes and are the source of truth for
  // Tier 3 (anonymous) donations where donorId is null.
  donorNameSnapshot: true,
  donorPhoneSnapshot: true,
  createdById: true,
  amount: true,
  type: true,
  category: true,
  bankAccountId: true,
  financialYearId: true,
  incomeCategoryId: true,
  bankName: true,
  utr: true,
  ifsc: true,
  chequeNumber: true,
  donationDate: true,
  transactionDate: true,
  donationReceived: true,
  isPrinted: true,
  notes: true,
  whatsappOptIn: true,
  whatsappSentAt: true,
  whatsappError: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

// Derives the donation's RECEIVED/PENDING state from its type + transactionDate.
// CASH is always immediately RECEIVED (cash-in-hand at the desk). CHEQUE / UPI /
// ONLINE flip to RECEIVED once a transactionDate is recorded, otherwise stay
// PENDING. Centralised here so create + update share one rule.
function computeStatus(type, transactionDate) {
  if (type === "CASH") return "RECEIVED";
  return transactionDate ? "RECEIVED" : "PENDING";
}

// Enforces the foundation's configured CASH ceiling. Loaded lazily so non-CASH
// donations don't pay for the extra round-trip. Throws a 422 with the limit in
// the error details so the UI can surface it inline.
async function enforceCashLimit(foundationId, type, amount) {
  if (type !== "CASH") return;
  const foundation = await prisma.foundation.findUnique({
    where: { id: foundationId },
    select: { cashLimit: true },
  });
  const limit = foundation?.cashLimit;
  if (!limit) return;
  const limitNum = Number(limit.toString());
  const amountNum = Number(amount);
  if (Number.isFinite(limitNum) && Number.isFinite(amountNum) && amountNum > limitNum) {
    throw ApiError.unprocessable(
      `Cash donations cannot exceed    ${limitNum.toLocaleString("en-IN")}`,
      { cashLimit: limitNum, amount: amountNum }
    );
  }
}

// Restricts donation queries to rows the user created when they lack the
// donation:viewAll permission. ADMIN/SUPERADMIN auto-pass via hasPermission.
function ownershipWhere(user) {
  if (hasPermission(user, PERMISSIONS.DONATION_VIEW_ALL)) return {};
  return { createdById: user.id };
}

function buildWhere(
  user,
  {
    q,
    includeDeleted,
    foundationId,
    donorId,
    type,
    status,
    from,
    to,
    whatsapp,
    minAmount,
    maxAmount,
  }
) {
  const where = { ...tenantWhere(user, foundationId), ...ownershipWhere(user) };
  if (donorId) where.donorId = donorId;
  if (type) where.type = type;
  if (status) where.donationReceived = status;
  if (from || to) {
    where.donationDate = {};
    if (from) where.donationDate.gte = from;
    if (to) where.donationDate.lte = to;
  }
  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {};
    if (minAmount !== undefined) where.amount.gte = minAmount;
    if (maxAmount !== undefined) where.amount.lte = maxAmount;
  }
  // WhatsApp delivery-state filter. Derived from the same fields the UI
  // badges read, so the dropdown values stay consistent across surfaces.
  //   SENT        whatsappSentAt is set
  //   PENDING     opted in, not yet sent, no error
  //   FAILED      whatsappError is set
  //   NONE        donor never opted in / no attempt
  if (whatsapp) {
    if (whatsapp === "SENT") where.whatsappSentAt = { not: null };
    else if (whatsapp === "PENDING")
      Object.assign(where, {
        whatsappOptIn: true,
        whatsappSentAt: null,
        whatsappError: null,
      });
    else if (whatsapp === "FAILED") where.whatsappError = { not: null };
    else if (whatsapp === "NONE")
      Object.assign(where, { whatsappOptIn: false, whatsappSentAt: null });
  }
  if (q) {
    // q matches donation-level identifiers (UTR / cheque / notes) as well as
    // donor name + PAN via the relation, so a single search box covers
    // operator expectations across "by reference" and "by donor".
    where.OR = [
      { utr: { contains: q, mode: "insensitive" } },
      { chequeNumber: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      {
        donor: {
          is: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { pan: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

async function findScoped(user, id, { includeDeleted = false } = {}) {
  const where = { id, ...tenantWhere(user), ...ownershipWhere(user) };
  if (includeDeleted) where.isDeleted = undefined;
  return prisma.donation.findFirst({ where, select: PUBLIC_FIELDS });
}

async function getDonorForFoundation(donorId, foundationId) {
  const donor = await prisma.donor.findFirst({
    where: { id: donorId, foundationId },
    select: {
      id: true,
      foundationId: true,
      fullName: true,
      phone: true,
    },
  });
  if (!donor) throw ApiError.badRequest("Donor not found in this foundation");
  return donor;
}

// Resolves the donor for a donation across the three identifier tiers.
//
// Tier 1     PAN present: find-or-create keyed by (foundationId, pan). Reuse
//   an existing (non-deleted) donor if found; otherwise insert a new one with
//   every optional field the caller provided.
// Tier 2     phone present, PAN absent: find-or-create keyed by (foundationId,
//   phone). Same reuse-then-create pattern; the partial unique index on phone
//   prevents duplicates.
// Tier 3     only fullName: no donor record is created. donorId stays null and
//   the snapshot columns preserve the operator's captured name/phone.
//
// Returns { donorId, nameSnapshot, phoneSnapshot }     always populated so the
// caller can persist snapshots unconditionally.
async function resolveOrCreateDonor(foundationId, { donorId, donor }) {
  // Path A: caller pointed at an existing donor by id. Validate scope and
  // snapshot the current fullName/phone at donation time.
  if (donorId) {
    const existing = await getDonorForFoundation(donorId, foundationId);
    return {
      donorId: existing.id,
      nameSnapshot: existing.fullName,
      phoneSnapshot: existing.phone ?? null,
    };
  }

  // Path B: no id     the schema guarantees an inline `donor` with fullName.
  const inline = donor ?? {};
  const { pan, phone, fullName } = inline;

  // Tier 1: PAN     find-or-create.
  if (pan) {
    const match = await prisma.donor.findFirst({
      where: { foundationId, pan, isDeleted: undefined },
      select: { id: true, fullName: true, phone: true },
    });
    if (match) {
      return {
        donorId: match.id,
        nameSnapshot: match.fullName,
        phoneSnapshot: match.phone ?? phone ?? null,
      };
    }
    const created = await prisma.donor.create({
      data: { ...inline, foundationId },
      select: { id: true, fullName: true, phone: true },
    });
    await recordAudit({
      action: "CREATE",
      entity: "Donor",
      entityId: created.id,
      after: created,
      foundationId,
    });
    return {
      donorId: created.id,
      nameSnapshot: created.fullName,
      phoneSnapshot: created.phone ?? null,
    };
  }

  // Tier 2: phone (no PAN)     find-or-create. Uses the partial unique index.
  if (phone) {
    const match = await prisma.donor.findFirst({
      where: { foundationId, phone, isDeleted: undefined },
      select: { id: true, fullName: true, phone: true },
    });
    if (match) {
      return {
        donorId: match.id,
        nameSnapshot: match.fullName,
        phoneSnapshot: match.phone ?? phone,
      };
    }
    const created = await prisma.donor.create({
      data: { ...inline, foundationId },
      select: { id: true, fullName: true, phone: true },
    });
    await recordAudit({
      action: "CREATE",
      entity: "Donor",
      entityId: created.id,
      after: created,
      foundationId,
    });
    return {
      donorId: created.id,
      nameSnapshot: created.fullName,
      phoneSnapshot: created.phone ?? null,
    };
  }

  // Tier 3: name only     no donor row created; donation stands alone with
  // snapshotted identifying details.
  return {
    donorId: null,
    nameSnapshot: fullName ?? null,
    phoneSnapshot: null,
  };
}

// Per-column filter map (DataTable). Text columns filter the relation / row;
// donor name + PAN reach through the Donor relation and fall back to the
// snapshot columns so anonymous (Tier 3) rows still match.
const DONATION_FILTERS = {
  donorName: {
    where: (v) => ({
      OR: [
        { donor: { is: { fullName: { contains: v, mode: "insensitive" } } } },
        { donorNameSnapshot: { contains: v, mode: "insensitive" } },
      ],
    }),
  },
  pan: {
    where: (v) => ({ donor: { is: { pan: { contains: v, mode: "insensitive" } } } }),
  },
  bankName: { type: "text" },
  utr: {
    where: (v) => ({
      OR: [
        { utr: { contains: v, mode: "insensitive" } },
        { chequeNumber: { contains: v, mode: "insensitive" } },
      ],
    }),
  },
  incomeCategoryId: { field: "incomeCategoryId" },
};

const DONATION_SORT = {
  map: {
    donationDate: "donationDate",
    amount: "amount",
    type: "type",
    donationReceived: "donationReceived",
    createdAt: "createdAt",
  },
  fallback: [{ donationDate: "desc" }, { createdAt: "desc" }],
};

export async function listDonations(user, query) {
  const where = buildWhere(user, query);
  applyColumnFilters(where, query, DONATION_FILTERS);
  const orderBy = buildOrderBy(query.sortBy, query.sortDir, DONATION_SORT);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      select: {
        ...PUBLIC_FIELDS,
        donor: {
          select: {
            id: true,
            fullName: true,
            pan: true,
            // phone + email are required by the frontend's bulk WhatsApp
            // predicate (and any future bulk email flow)     they used to be
            // omitted, which made Boolean(d.donor?.phone) always false.
            phone: true,
            email: true,
            address1: true,
            address2: true,
            city: true,
            state: true,
            country: true,
            pincode: true,
          },
        },
        incomeCategory: { select: { id: true, name: true } },
      },
      orderBy,
      ...paging,
    }),
    prisma.donation.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getDonation(user, id) {
  // Single-record fetch returns the donor relation so the edit form on the
  // frontend can display PAN / donor name without a second round-trip.
  const where = { id, ...tenantWhere(user), ...ownershipWhere(user) };
  const donation = await prisma.donation.findFirst({
    where,
    select: {
      ...PUBLIC_FIELDS,
      donor: {
        select: {
          id: true,
          fullName: true,
          pan: true,
          phone: true,
          email: true,
          address1: true,
          address2: true,
          city: true,
          state: true,
          country: true,
          pincode: true,
        },
      },
    },
  });
  if (!donation) throw ApiError.notFound("Donation not found");
  return donation;
}

// Resolves the bank account a donation should credit. When the caller
// provides an explicit bankAccountId we validate ownership (via the tx
// client's tenant filter) and enforce category coherence with the payment
// type (CASH     CASH, UPI     UPI, CHEQUE/ONLINE     BANK). When omitted we fall
// back to the foundation's isDefault account for that category. Runs inside
// the same tx as the ledger post so a concurrent default-swap can't leave
// the balance stale.
async function resolveDonationBankAccount(tx, foundationId, category, bankAccountIdInput) {
  if (bankAccountIdInput) {
    const acc = await tx.bankAccount.findFirst({
      where: { id: bankAccountIdInput, foundationId, isActive: true },
      select: { id: true, category: true, label: true },
    });
    if (!acc) {
      throw ApiError.notFound("Bank account not found", {
        code: "BANK_ACCOUNT_NOT_FOUND",
      });
    }
    if (acc.category !== category) {
      throw ApiError.unprocessable(
        `Selected account "${acc.label}" is ${acc.category}, expected ${category} for a ${category} donation`,
        { code: "BANK_ACCOUNT_CATEGORY_MISMATCH" }
      );
    }
    return acc.id;
  }
  const def = await findDefaultBankAccount(tx, foundationId, category);
  if (!def) {
    throw ApiError.unprocessable(
      `No default ${category} bank account is configured. Create one or pick an account explicitly.`,
      { code: "BANK_ACCOUNT_REQUIRED" }
    );
  }
  return def.id;
}

// Validates an optional income category belongs to the foundation, is of
// kind INCOME, and is active. No-op when categoryId is falsy.
async function assertIncomeCategory(foundationId, incomeCategoryId) {
  if (!incomeCategoryId) return;
  const cat = await prisma.category.findFirst({
    where: { id: incomeCategoryId, foundationId, kind: "INCOME", isDeleted: false },
    select: { id: true },
  });
  if (!cat) throw ApiError.badRequest("Invalid income category");
}

export async function createDonation(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await enforceCashLimit(foundationId, input.type, input.amount);
  await assertIncomeCategory(foundationId, input.incomeCategoryId);

  // Resolve the donor across all three identifier tiers (PAN, phone, or
  // name-only). This may create a new Donor row inline; snapshots capture
  // whatever we ended up with so the donation stays intact even if the donor
  // is later edited or deleted.
  const { donorId, nameSnapshot, phoneSnapshot } = await resolveOrCreateDonor(
    foundationId,
    { donorId: input.donorId, donor: input.donor }
  );

  // Strip the inline donor payload and any client-supplied donorId     we use
  // the resolved values below. Pull bankAccountId out too so it doesn't leak
  // into the rest spread (we set it explicitly after resolution).
  const {
    foundationId: _ignored,
    donor: _inlineDonor,
    donorId: _donorIdInput,
    bankAccountId: bankAccountIdInput,
    ...rest
  } = input;
  // CASH locks transactionDate to donationDate (always RECEIVED). Other types
  // keep whatever the caller sent; status follows from transactionDate.
  const donationDate = rest.donationDate ?? new Date();
  const transactionDate =
    rest.type === "CASH" ? donationDate : rest.transactionDate ?? null;
  const donationReceived = computeStatus(rest.type, transactionDate);

  // Resolve + guard the FY once, outside the tx. The ledger-shaping date is
  // the transactionDate when set (money actually moved) else donationDate.
  const ledgerDate = transactionDate ?? donationDate;
  const fy = await resolveFinancialYearForDate(foundationId, ledgerDate);
  ensureFyWritable(fy);

  const created = await prisma.$transaction(async (tx) => {
    // For a RECEIVED donation we MUST have a bank account (posting a CREDIT
    // requires one). For PENDING we allow an operator-preselected account or
    // no account at all     the row will resolve one on markReceived.
    let bankAccountId = null;
    if (donationReceived === "RECEIVED") {
      bankAccountId = await resolveDonationBankAccount(
        tx, foundationId, rest.category ?? "GENERAL", bankAccountIdInput
      );
    } else if (bankAccountIdInput) {
      const acc = await tx.bankAccount.findFirst({
        where: { id: bankAccountIdInput, foundationId, isActive: true },
        select: { id: true },
      });
      if (!acc) {
        throw ApiError.notFound("Bank account not found", {
          code: "BANK_ACCOUNT_NOT_FOUND",
        });
      }
      bankAccountId = acc.id;
    }

    const donation = await tx.donation.create({
      data: {
        ...rest,
        foundationId,
        donorId,
        donorNameSnapshot: nameSnapshot,
        donorPhoneSnapshot: phoneSnapshot,
        createdById: user.id,
        donationDate,
        transactionDate,
        donationReceived,
        bankAccountId,
        financialYearId: fy?.id ?? null,
      },
      select: PUBLIC_FIELDS,
    });

    if (donationReceived === "RECEIVED" && bankAccountId) {
      await postTransaction(tx, {
        foundationId,
        bankAccountId,
        financialYearId: fy?.id ?? null,
        type: "CREDIT",
        amount: donation.amount,
        entityType: "Donation",
        entityId: donation.id,
        donationId: donation.id,
        occurredAt: ledgerDate,
        description: `Donation: ${nameSnapshot ?? "anonymous"}`,
      });
    }
    return donation;
  });

  await recordAudit({
    action: "CREATE",
    entity: "Donation",
    entityId: created.id,
    after: created,
    foundationId,
  });

  // Fire-and-forget WhatsApp receipt. The orchestrator re-reads the donation
  // with its foundation + donor relations and applies its own pre-conditions
  // (foundation opted in, donor has phone, etc.); we only dispatch when the
  // caller asked for it. Errors are persisted onto the row, never thrown back.
  if (created.whatsappOptIn) {
    setImmediate(() => {
      sendDonationReceipt(created.id).catch((err) => {
        logger.error(
          { donationId: created.id, err: err?.message },
          "sendDonationReceipt unhandled rejection"
        );
      });
    });
  }

  return created;
}

export async function updateDonation(user, id, input) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Donation not found");
  // Disallow mutating donations already marked as received     they are
  // financial records that participated in receipt issuance.
  if (before.donationReceived === "RECEIVED") {
    throw ApiError.conflict("Received donations cannot be edited");
  }

  const nextType = input.type ?? before.type;
  const nextAmount = input.amount ?? before.amount;
  await enforceCashLimit(before.foundationId, nextType, nextAmount);
  if (input.incomeCategoryId) {
    await assertIncomeCategory(before.foundationId, input.incomeCategoryId);
  }

  // Re-derive status whenever type or transactionDate is touched. `null`
  // explicitly clears transactionDate (Zod schema allows it on update).
  const data = { ...input };
  const transactionDateProvided = Object.prototype.hasOwnProperty.call(
    input,
    "transactionDate"
  );
  const nextTransactionDate = transactionDateProvided
    ? input.transactionDate
    : before.transactionDate;
  if (input.type !== undefined || transactionDateProvided) {
    data.donationReceived = computeStatus(nextType, nextTransactionDate);
  }

  const after = await prisma.donation.update({
    where: { id },
    data,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Donation",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function markReceived(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Donation not found");
  if (before.donationReceived === "RECEIVED") return before;

  // Resolve + guard FY on the effective ledger date (same rule as create).
  const ledgerDate = before.transactionDate ?? before.donationDate ?? new Date();
  const fy = await resolveFinancialYearForDate(before.foundationId, ledgerDate);
  ensureFyWritable(fy);

  const after = await prisma.$transaction(async (tx) => {
    const bankAccountId = await resolveDonationBankAccount(
      tx, before.foundationId, before.category ?? "GENERAL", before.bankAccountId
    );
    const updated = await tx.donation.update({
      where: { id },
      data: {
        donationReceived: "RECEIVED",
        bankAccountId,
        financialYearId: fy?.id ?? before.financialYearId ?? null,
      },
      select: PUBLIC_FIELDS,
    });
    await postTransaction(tx, {
      foundationId: before.foundationId,
      bankAccountId,
      financialYearId: fy?.id ?? null,
      type: "CREDIT",
      amount: updated.amount,
      entityType: "Donation",
      entityId: updated.id,
      donationId: updated.id,
      occurredAt: ledgerDate,
      description: `Donation: ${updated.donorNameSnapshot ?? "anonymous"}`,
    });
    return updated;
  });

  await recordAudit({
    action: "UPDATE",
    entity: "Donation",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function markPrinted(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Donation not found");
  if (before.isPrinted) return before;

  const after = await prisma.donation.update({
    where: { id },
    data: { isPrinted: true },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Donation",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

// Manual re-trigger for the WhatsApp receipt. Operators reach for this when:
//   * the initial dispatch failed (whatsappError set) and they want to retry;
//   * the donor missed the message and they want to resend the same template;
//   * the original record was created without opt-in and the donor now consents.
// We reset whatsappSentAt + whatsappError, force opt-in to true so the
// orchestrator's pre-conditions pass, then fire-and-forget the dispatch. The
// orchestrator owns its own pre-condition checks (donor phone, etc.) and
// persists any new error onto the row; we additionally guard the obvious
// up-front failures here so the HTTP response can carry a useful message
// rather than silently writing a "skipped:    " string.
export async function resendWhatsappReceipt(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Donation not found");

  const context = await prisma.donation.findUnique({
    where: { id },
    select: {
      donor: { select: { phone: true } },
      foundation: {
        select: { hasWhatsappBusiness: true, whatsappBusinessNumber: true },
      },
    },
  });
  if (!context?.foundation?.hasWhatsappBusiness) {
    throw ApiError.badRequest(
      "WhatsApp is not enabled for this foundation"
    );
  }
  if (!context.foundation.whatsappBusinessNumber) {
    throw ApiError.badRequest(
      "Foundation WhatsApp Business number is not configured"
    );
  }
  if (!context.donor?.phone) {
    throw ApiError.badRequest(
      "Donor has no phone number on file     update the donor first"
    );
  }

  const after = await prisma.donation.update({
    where: { id },
    data: {
      whatsappOptIn: true,
      whatsappSentAt: null,
      whatsappError: null,
    },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Donation",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });

  setImmediate(() => {
    sendDonationReceipt(id).catch((err) => {
      logger.error(
        { donationId: id, err: err?.message },
        "sendDonationReceipt unhandled rejection (resend)"
      );
    });
  });

  return after;
}

export async function deleteDonation(user, id) {
  const before = await findScoped(user, id);
  if (!before) throw ApiError.notFound("Donation not found");

  // A ledger reversal is itself a write     refuse to delete out of a closed FY
  // so the audit trail stays consistent with the accounting period lock.
  if (before.financialYearId) {
    const fy = await prisma.financialYear.findUnique({
      where: { id: before.financialYearId },
    });
    ensureFyWritable(fy);
  }

  await prisma.$transaction(async (tx) => {
    // No-op when the donation never posted (PENDING or already reversed).
    await reverseTransactionFor(tx, before.foundationId, "Donation", id);
    await tx.donation.softDelete({ where: { id } });
  });
  await recordAudit({
    action: "DELETE",
    entity: "Donation",
    entityId: id,
    before,
    foundationId: before.foundationId,
  });
}

export async function restoreDonation(user, id) {
  const scope = tenantWhere(user);
  const before = await prisma.donation.findFirst({
    where: { id, isDeleted: true, ...scope },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted donation not found");

  await prisma.donation.restore({ where: { id } });
  const after = await findScoped(user, id);
  await recordAudit({
    action: "RESTORE",
    entity: "Donation",
    entityId: id,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}
