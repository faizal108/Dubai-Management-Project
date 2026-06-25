import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";
import { resolveFoundationId, tenantWhere } from "../../lib/tenantScope.js";
import { PERMISSIONS, hasPermission } from "../../lib/permissions.js";
import { sendDonationReceipt } from "../notifications/whatsapp/index.js";
import { logger } from "../../lib/logger.js";

const PUBLIC_FIELDS = {
  id: true,
  foundationId: true,
  donorId: true,
  createdById: true,
  amount: true,
  type: true,
  category: true,
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
      `Cash donations cannot exceed ₹${limitNum.toLocaleString("en-IN")}`,
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
  //   SENT    → whatsappSentAt is set
  //   PENDING → opted in, not yet sent, no error
  //   FAILED  → whatsappError is set
  //   NONE    → donor never opted in / no attempt
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
    select: { id: true, foundationId: true },
  });
  if (!donor) throw ApiError.badRequest("Donor not found in this foundation");
  return donor;
}

export async function listDonations(user, query) {
  const where = buildWhere(user, query);
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
            // predicate (and any future bulk email flow) — they used to be
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
      },
      orderBy: [{ donationDate: "desc" }, { createdAt: "desc" }],
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

export async function createDonation(user, input) {
  const foundationId = resolveFoundationId(user, input.foundationId);
  await getDonorForFoundation(input.donorId, foundationId);
  await enforceCashLimit(foundationId, input.type, input.amount);

  const { foundationId: _ignored, ...rest } = input;
  // CASH locks transactionDate to donationDate (always RECEIVED). Other types
  // keep whatever the caller sent; status follows from transactionDate.
  const donationDate = rest.donationDate ?? new Date();
  const transactionDate =
    rest.type === "CASH" ? donationDate : rest.transactionDate ?? null;
  const donationReceived = computeStatus(rest.type, transactionDate);

  // Tag the creator for ownership scoping. SUPERADMIN may not belong to the
  // foundation in question, so we still set createdById from the actor.
  const created = await prisma.donation.create({
    data: {
      ...rest,
      foundationId,
      createdById: user.id,
      donationDate,
      transactionDate,
      donationReceived,
    },
    select: PUBLIC_FIELDS,
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
  // Disallow mutating donations already marked as received — they are
  // financial records that participated in receipt issuance.
  if (before.donationReceived === "RECEIVED") {
    throw ApiError.conflict("Received donations cannot be edited");
  }

  const nextType = input.type ?? before.type;
  const nextAmount = input.amount ?? before.amount;
  await enforceCashLimit(before.foundationId, nextType, nextAmount);

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

  const after = await prisma.donation.update({
    where: { id },
    data: { donationReceived: "RECEIVED" },
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
// rather than silently writing a "skipped: …" string.
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
      "Donor has no phone number on file — update the donor first"
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

  await prisma.donation.softDelete({ where: { id } });
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
