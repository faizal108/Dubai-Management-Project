// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { userLogin } from "../features/auth/api";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import { getAuthToken, getAuthUser } from "../lib/authHelpers";

const AuthContext = createContext({
  token: null,
  user: null,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
  updateUser: () => {},
});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(() => getAuthUser());

  const isTokenValid = (t) => {
    if (!t) return false;
    try {
      const { exp } = jwtDecode(t);
      return Date.now() < exp * 1000;
    } catch {
      return false;
    }
  };

  // login(): POST /auth/login → { token, user }. Persist both verbatim.
  const login = async (email, password) => {
    try {
      const { token: newToken, user: newUser } = await userLogin({
        email,
        password,
      });
      if (!newToken || !newUser) throw new Error("Malformed login response");

      localStorage.setItem(
        "auth",
        JSON.stringify({ token: newToken, user: newUser })
      );

      setToken(newToken);
      setUser(newUser);
      toast.success("Logged in successfully.");
      return true;
    } catch (err) {
      // api.js interceptor already surfaced the toast; keep return contract.
      console.error("Login failed:", err);
      return false;
    }
  };

  // Refresh the cached user after a self-service profile edit. Keeps the
  // localStorage `auth` blob in sync with React state so a page reload
  // doesn't show stale fullName/email/username.
  const updateUser = (nextUser) => {
    if (!nextUser) return;
    setUser(nextUser);
    const stored = localStorage.getItem("auth");
    const parsed = stored ? JSON.parse(stored) : {};
    localStorage.setItem(
      "auth",
      JSON.stringify({ ...parsed, user: nextUser })
    );
  };

  // 4. logout(): clear EVERYTHING
  const logout = () => {
    localStorage.removeItem("auth");
    setToken(null);
    setUser(null);
    // toast.info("Session ended.");
    window.location.href = "/login";
  };

  // 5. If token is missing/expired, blow away storage & state
  useEffect(() => {
    const hadToken = Boolean(token);
    const nowValid = isTokenValid(token);

    // Only trigger logout if we once had a token that now isn’t valid
    if (hadToken && !nowValid) {
      logout();
    }
  }, [token, logout]);

  const isAuthenticated = Boolean(user) && isTokenValid(token);

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated, login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
