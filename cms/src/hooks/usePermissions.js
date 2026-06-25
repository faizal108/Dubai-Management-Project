import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";

// SUPERADMIN and ADMIN automatically have every permission — matches the
// server-side hasPermission() helper.
const PRIVILEGED_ROLES = new Set([ROLES.SUPERADMIN, ROLES.ADMIN]);

/**
 * Returns a stable helpers object for permission checks.
 *
 *   const { can, canAny, canAll, permissions, isPrivileged } = usePermissions();
 *   if (can("donation:delete")) { ... }
 */
export function usePermissions() {
  const { user } = useAuth();

  return useMemo(() => {
    const role = user?.role ?? null;
    const isPrivileged = role !== null && PRIVILEGED_ROLES.has(role);
    const permissions = Array.isArray(user?.permissions)
      ? user.permissions
      : [];

    const can = (perm) => {
      if (!user) return false;
      if (isPrivileged) return true;
      return permissions.includes(perm);
    };

    const canAny = (perms) => perms.some((p) => can(p));
    const canAll = (perms) => perms.every((p) => can(p));

    return { can, canAny, canAll, permissions, role, isPrivileged };
  }, [user]);
}
