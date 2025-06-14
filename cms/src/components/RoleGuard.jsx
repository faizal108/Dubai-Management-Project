import React from "react";
import { useAuth } from "../context/AuthContext";

const RoleGuard = ({ allowedRoles, fallback = null, children }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) return fallback;

  return <>{children}</>;
};

export default RoleGuard;

// demo
{/* <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPERADMIN]}>
  <SettingsPanel />
</RoleGuard> */}