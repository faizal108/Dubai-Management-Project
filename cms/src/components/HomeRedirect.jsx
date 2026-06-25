import React from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { ROLES } from "../constants/roles";

export default function HomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    // shouldn't happen – parent PrivateRoute already guards this
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case ROLES.SUPERADMIN:
      // SUPERADMIN's primary surface is foundation management.
      return <Navigate to="/foundations" replace />;

    case ROLES.ADMIN:
      return <Navigate to="/dashboard" replace />;

    case ROLES.EMPLOYEE:
      // Employees default to All Donations — their main daily surface.
      return <Navigate to="/donation/search" replace />;

    case ROLES.CUSTOMER:
      // Customer-facing surfaces land here later (Phase E).
      return <Navigate to="/unauthorized" replace />;

    default:
      return <Navigate to="/unauthorized" replace />;
  }
}
