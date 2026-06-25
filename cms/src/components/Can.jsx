import React from "react";
import { usePermissions } from "../hooks/usePermissions";

/**
 * Conditionally renders children based on the current user's permissions.
 *
 *   <Can perm="donation:delete">
 *     <button>Delete</button>
 *   </Can>
 *
 *   <Can anyOf={["donation:update", "donation:markReceived"]}>...</Can>
 *   <Can allOf={["donor:create", "donation:create"]}>...</Can>
 *
 * Renders `fallback` (default: null) when the check fails.
 */
const Can = ({ perm, anyOf, allOf, fallback = null, children }) => {
  const { can, canAny, canAll } = usePermissions();

  let allowed = true;
  if (perm) allowed = allowed && can(perm);
  if (Array.isArray(anyOf) && anyOf.length > 0) allowed = allowed && canAny(anyOf);
  if (Array.isArray(allOf) && allOf.length > 0) allowed = allowed && canAll(allOf);

  return allowed ? <>{children}</> : fallback;
};

export default Can;
