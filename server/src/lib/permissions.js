// Granular permission keys assignable to EMPLOYEE users.
// SUPERADMIN and ADMIN bypass these checks server-side (see hasPermission).
export const PERMISSIONS = {
  DONOR_CREATE: "donor:create",
  DONOR_UPDATE: "donor:update",
  DONOR_DELETE: "donor:delete",

  DONATION_CREATE: "donation:create",
  DONATION_UPDATE: "donation:update",
  DONATION_DELETE: "donation:delete",
  DONATION_VIEW_ALL: "donation:viewAll",
  DONATION_MARK_RECEIVED: "donation:markReceived",
  DONATION_MARK_PRINTED: "donation:markPrinted",

  ACTIVITY_CREATE: "activity:create",
  ACTIVITY_UPDATE: "activity:update",
  ACTIVITY_DELETE: "activity:delete",

  REPORT_VIEW: "report:view",
  DASHBOARD_VIEW: "dashboard:view",
};

// Flat list — useful for validation in the employees schema.
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Roles for which permission checks always pass — these users have full
// authority within their scope.
const PRIVILEGED_ROLES = new Set(["SUPERADMIN", "ADMIN"]);

/**
 * Returns true when `user` is authorized for `permission`.
 * SUPERADMIN/ADMIN are always authorized. EMPLOYEE must hold the exact key in
 * their permissions array.
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  if (PRIVILEGED_ROLES.has(user.role)) return true;
  if (!Array.isArray(user.permissions)) return false;
  return user.permissions.includes(permission);
}
