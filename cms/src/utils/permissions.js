export const hasRole = (user, roles = []) => {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};
