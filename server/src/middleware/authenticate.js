import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";
import { ApiError } from "../lib/apiError.js";
import { setContext } from "../lib/requestContext.js";
import { prisma } from "../lib/prisma.js";

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or invalid Authorization header");
    }
    const token = header.slice(7).trim();
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        foundationId: true,
        permissions: true,
        isActive: true,
        isDeleted: true,
      },
    });
    if (!user || user.isDeleted || !user.isActive) {
      throw ApiError.unauthorized("Account is not active");
    }

    req.user = user;
    setContext({
      userId: user.id,
      foundationId: user.foundationId,
      role: user.role,
    });
    next();
  } catch (err) {
    next(err);
  }
}
