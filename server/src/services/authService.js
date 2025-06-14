import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

export async function registerUser({ username, password, role }, foundationId) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw { status: 400, message: "User already exists" };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash, role, foundationId },
  });

  return { id: user.id, username: user.username };
}

export async function authenticateUser({ username, password }) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw { status: 401, message: "Invalid credentials" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw { status: 401, message: "Invalid credentials" };

  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      foundationId: user.foundationId,
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
}
