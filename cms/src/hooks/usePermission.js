import { useAuth } from "../context/AuthContext";

export const usePermission = () => {
  const { user } = useAuth();

  const canAccess = (...allowedRoles) => {
    if (!user?.role) return false;
    return allowedRoles.includes(user.role);
  };

  return { canAccess };
};

// Demo
// import { usePermission } from "../hooks/usePermission";

// const { canAccess } = usePermission();

// if (canAccess("admin", "superadmin")) {
//   // run logic or show something
// }
