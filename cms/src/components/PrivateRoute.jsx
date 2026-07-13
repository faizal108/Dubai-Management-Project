// src/components/PrivateRoute.jsx

import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";

/**
 * PrivateRoute will:
 *  1. Auto‑logout (and redirect) if the token/user ever become invalid.
 *  2. Enforce optional role‑based access via `roles`.
 *  3. Enforce optional permission gating via `perm` / `anyOf` / `allOf`.
 *     SUPERADMIN and ADMIN auto-pass all permission checks.
 */
const PrivateRoute = ({
  roles = [],
  perm,
  anyOf,
  allOf,
  children,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { can, canAny, canAll } = usePermissions();

  // Auto‑logout side‑effect
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear stale session and redirect to /login
      logout();
    }
  }, [isAuthenticated, logout]);

  // While logout() is flushing state, avoid rendering protected UI
  if (!isAuthenticated) {
    return null;
  }

  // Role‑check
  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Permission-check (ADMIN/SUPERADMIN auto-pass via usePermissions)
  if (perm && !can(perm)) {
    return <Navigate to="/unauthorized" replace />;
  }
  if (Array.isArray(anyOf) && anyOf.length > 0 && !canAny(anyOf)) {
    return <Navigate to="/unauthorized" replace />;
  }
  if (Array.isArray(allOf) && allOf.length > 0 && !canAll(allOf)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Render wrapped component(s) or nested routes
  return children ? children : <Outlet />;
};

export default PrivateRoute;
