import { randomUUID } from "node:crypto";
import { runWithContext } from "../lib/requestContext.js";

// Establishes per-request AsyncLocalStorage context. Must run before auth
// so authenticate() can populate userId/foundationId/role into the same store.
export function requestContextMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  res.setHeader("x-request-id", requestId);
  runWithContext(
    {
      requestId,
      userId: null,
      foundationId: null,
      role: null,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    },
    () => next()
  );
}
