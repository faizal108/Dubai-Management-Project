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
    case ROLES.ADMIN:
      return <Navigate to="/dashboard" replace />;

    case ROLES.USER:
      return <Navigate to="/donor/add" replace />;

    // add more roles here as you grow
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}
