import { ApiError } from "./apiError.js";

// Resolves the foundationId for a write/scoped read. SUPERADMIN must pass it
// explicitly (no ambient tenant); ADMIN is locked to their own foundation and
// cannot target a different one.
export function resolveFoundationId(user, requested) {
  if (!user) throw ApiError.unauthorized();
  if (user.role === "SUPERADMIN") {
    if (!requested) throw ApiError.badRequest("foundationId is required");
    return requested;
  }
  if (user.role === "ADMIN" || user.role === "EMPLOYEE") {
    if (!user.foundationId) {
      throw ApiError.forbidden("Account is not bound to a foundation");
    }
    if (requested && requested !== user.foundationId) {
      throw ApiError.forbidden("Cannot operate outside your foundation");
    }
    return user.foundationId;
  }
  throw ApiError.forbidden("Insufficient role");
}

// Builds the foundationId filter for list/read endpoints. ADMIN/EMPLOYEE see
// only their foundation; SUPERADMIN can optionally narrow with `requested` or
// see all foundations when no filter is supplied.
export function tenantWhere(user, requested) {
  if (!user) throw ApiError.unauthorized();
  if (user.role === "SUPERADMIN") {
    return requested ? { foundationId: requested } : {};
  }
  if (user.role === "ADMIN" || user.role === "EMPLOYEE") {
    if (!user.foundationId) {
      throw ApiError.forbidden("Account is not bound to a foundation");
    }
    if (requested && requested !== user.foundationId) {
      throw ApiError.forbidden("Cannot read outside your foundation");
    }
    return { foundationId: user.foundationId };
  }
  throw ApiError.forbidden("Insufficient role");
}
