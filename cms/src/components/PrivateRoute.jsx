// src/components/PrivateRoute.jsx

import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// roles: array of strings, e.g. ["admin", "manager"];
// If omitted → any authenticated user is allowed.
const PrivateRoute = ({ roles = [], children }) => {
  const { user, isAuthenticated } = useAuth();

  // 1. Not signed in? redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. If roles specified, ensure user has at least one of them
  if (roles.length > 0) {
    console.log("PrivateRoute : ", user, " isAuthenticated : ", isAuthenticated);
    
    // user.roles is assumed to be an array of role identifiers (["admin", "user", ...])
    const hasRequiredRole = roles.includes(user?.role);
    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // 3. Otherwise, render the protected subtree:
  //    If this component is used directly (wrapping a single-element),
  //    we render children; else, if you’re using nested <Route> with <Outlet/>, change accordingly.
  return children ? children : <Outlet />;
};

export default PrivateRoute;
