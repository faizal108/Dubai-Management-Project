// src/components/PrivateRoute.jsx

import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * PrivateRoute will:
 *  1. Auto‑logout (and redirect) if the token/user ever become invalid.
 *  2. Enforce optional role‑based access.
 */
const PrivateRoute = ({ roles = [], children }) => {
  const { user, isAuthenticated, logout } = useAuth();

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

  // Render wrapped component(s) or nested routes
  return children ? children : <Outlet />;
};

export default PrivateRoute;
