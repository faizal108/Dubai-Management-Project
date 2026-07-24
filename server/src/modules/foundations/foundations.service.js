import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { toPrismaPaging, buildPage } from "../../lib/pagination.js";

// Fields safe to return to API callers and to embed into audit snapshots.
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  pan: true,
  logoUrl: true,
  signatureUrl: true,
  receiptName: true,
  registrationNumber: true,
  email: true,
  address: true,
  receiptTemplateId: true,
  receiptSettings: true,
  isActive: true,
  isDeleted: true,
  deletedAt: true,
  cashLimit: true,
  hasWhatsappBusiness: true,
  whatsappBusinessNumber: true,
  fyStartMonth: true,
  createdAt: true,
  updatedAt: true,
};

// Audit snapshots elide the base64 image blobs (logo / signature) so the
// AuditLog stays lean — we record only whether an image is set, not its bytes.
function auditSnapshot(row) {
  if (!row) return row;
  const redact = (v) => (v ? "[image]" : v);
  return { ...row, logoUrl: redact(row.logoUrl), signatureUrl: redact(row.signatureUrl) };
}

function buildWhere({ q, includeDeleted }) {
  const where = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { pan: { contains: q.toUpperCase() } },
    ];
  }
  // The Prisma extension auto-filters isDeleted:false unless the caller already
  // owns the key. Setting it to undefined keeps the own-property (so the
  // extension skips injection) while telling Prisma to apply no filter.
  if (includeDeleted === true) where.isDeleted = undefined;
  return where;
}

export async function listFoundations(query) {
  const where = buildWhere(query);
  const paging = toPrismaPaging(query);
  const [items, total] = await Promise.all([
    prisma.foundation.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: "desc" },
      ...paging,
    }),
    prisma.foundation.count({ where }),
  ]);
  return buildPage({ items, total, page: query.page, pageSize: query.pageSize });
}

export async function getFoundation(id) {
  const found = await prisma.foundation.findUnique({
    where: { id },
    select: PUBLIC_FIELDS,
  });
  if (!found) throw ApiError.notFound("Foundation not found");
  return found;
}

export async function createFoundation(input) {
  const created = await prisma.foundation.create({
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "CREATE",
    entity: "Foundation",
    entityId: created.id,
    after: auditSnapshot(created),
    foundationId: created.id,
  });
  return created;
}

export async function updateFoundation(id, input) {
  const before = await prisma.foundation.findUnique({
    where: { id },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Foundation not found");

  const after = await prisma.foundation.update({
    where: { id },
    data: input,
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "UPDATE",
    entity: "Foundation",
    entityId: id,
    before: auditSnapshot(before),
    after: auditSnapshot(after),
    foundationId: id,
  });
  return after;
}

export async function deleteFoundation(id) {
  const before = await prisma.foundation.findUnique({
    where: { id },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Foundation not found");

  await prisma.foundation.softDelete({ where: { id } });
  await recordAudit({
    action: "DELETE",
    entity: "Foundation",
    entityId: id,
    before: auditSnapshot(before),
    foundationId: id,
  });
}

export async function restoreFoundation(id) {
  // Bypass soft-delete read filter to find a deleted row.
  const before = await prisma.foundation.findFirst({
    where: { id, isDeleted: true },
    select: PUBLIC_FIELDS,
  });
  if (!before) throw ApiError.notFound("Deleted foundation not found");

  await prisma.foundation.restore({ where: { id } });
  const after = await prisma.foundation.findUnique({
    where: { id },
    select: PUBLIC_FIELDS,
  });
  await recordAudit({
    action: "RESTORE",
    entity: "Foundation",
    entityId: id,
    before: auditSnapshot(before),
    after: auditSnapshot(after),
    foundationId: id,
  });
  return after;
}

// ADMIN-facing helpers. The authenticated user's foundationId is resolved by
// the controller     these functions trust the caller to pass a scoped id.
export async function getMyFoundation(foundationId) {
  if (!foundationId) throw ApiError.forbidden("No foundation in scope");
  return getFoundation(foundationId);
}

export async function updateMyFoundation(foundationId, input) {
  if (!foundationId) throw ApiError.forbidden("No foundation in scope");
  return updateFoundation(foundationId, input);
}
