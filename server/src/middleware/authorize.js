import { ApiError } from "../lib/apiError.js";
import { hasPermission } from "../lib/permissions.js";

// Restricts access to the given roles. Use after authenticate().
export function authorize(...allowedRoles) {
  const allowed = new Set(allowedRoles);
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.has(req.user.role)) return next(ApiError.forbidden("Insufficient role"));
    next();
  };
}

// Ensures the acting user is bound to a foundation. SUPERADMIN can be
// scope-less; ADMIN/CUSTOMER routes that touch tenant data must use this.
export function requireFoundation(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.foundationId) {
    return next(ApiError.forbidden("Account is not bound to a foundation"));
  }
  next();
}

// Requires the caller to hold every listed permission. ADMIN/SUPERADMIN
// bypass automatically (see hasPermission()).
export function requirePermission(...required) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    for (const perm of required) {
      if (!hasPermission(req.user, perm)) {
        return next(ApiError.forbidden(`Missing permission: ${perm}`));
      }
    }
    next();
  };
}
