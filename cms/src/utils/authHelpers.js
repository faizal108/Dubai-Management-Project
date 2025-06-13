// src/utils/authHelpers.js

/**
 * We assume that after login, you store:
 *    localStorage.setItem("auth", JSON.stringify({ token: "...", user: { id, roles: [...] } }));
 *
 * getAuthToken() will parse localStorage and return the raw Bearer token string, or null.
 */

export const getAuthToken = () => {
  try {
    const stored = localStorage.getItem("auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.token || null;
  } catch (e) {
    console.error("Error parsing auth data from localStorage", e);
    return null;
  }
};

export const getAuthUser = () => {
  try {
    const stored = localStorage.getItem("auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.user || null;
  } catch (e) {
    console.error("Error parsing user data from localStorage", e);
    return null;
  }
};
