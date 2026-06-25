import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { ApiError } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  permissions: true,
  foundationId: true,
  donorId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
};

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, foundationId: user.foundationId ?? null },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized("Invalid credentials");

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken(user);
  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: PUBLIC_USER_FIELDS,
  });
  return { token, user: safeUser };
}

export async function signupCustomer({ email, password, fullName, pan, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict("Email already registered");

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "CUSTOMER",
    },
    select: PUBLIC_USER_FIELDS,
  });

  // PAN/phone captured here are not linked to a foundation yet. They will be
  // used to attach the customer to a Donor record when they donate or are
  // explicitly attached by an admin.
  void pan;
  void phone;

  const token = signToken({ id: user.id, role: user.role, foundationId: null });
  return { token, user };
}

export async function me(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_FIELDS,
  });
}

// Self-service profile update. `passwordHash` is never read or written here;
// password changes go through changePassword() which requires currentPassword.
export async function updateProfile(userId, input) {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_FIELDS,
  });
  if (!before) throw ApiError.notFound("User not found");

  // Pre-check uniqueness for email / username to surface a friendly 409
  // instead of letting Prisma raise P2002.
  if (input.email && input.email !== before.email) {
    const clash = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (clash && clash.id !== userId) {
      throw ApiError.conflict("Email already registered");
    }
  }
  if (input.username && input.username !== before.username) {
    const clash = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (clash && clash.id !== userId) {
      throw ApiError.conflict("Username already taken");
    }
  }

  const after = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: PUBLIC_USER_FIELDS,
  });

  await recordAudit({
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    before,
    after,
    foundationId: after.foundationId,
  });
  return after;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  // Load the row directly — we need passwordHash for verification, so we
  // can't use PUBLIC_USER_FIELDS here.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    // Deliberately NOT a 401 — the user is authenticated; only the
    // currentPassword field is wrong. A 401 here would trip the frontend's
    // session-expiry interceptor and log the user out.
    throw ApiError.badRequest("Current password is incorrect", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Audit a password change without leaking either hash. The before/after
  // snapshots intentionally elide passwordHash; we just mark the event.
  await recordAudit({
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    before: { passwordChanged: false },
    after: { passwordChanged: true },
    foundationId: user.foundationId,
  });
}
