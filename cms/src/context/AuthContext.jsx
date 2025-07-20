// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { userlogin } from "../apis/endpoints";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import { getAuthToken, getAuthUser } from "../utils/authHelpers";

const AuthContext = createContext({
  token: null,
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  // 1. Initialize from helpers
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(() => getAuthUser());

  // 2. Helper: Check JWT expiry
  const isTokenValid = (t) => {
    if (!t) return false;
    try {
      const { exp } = jwtDecode(t);
      return Date.now() < exp * 1000;
    } catch {
      return false;
    }
  };

  // 3. login(): call backend, unpack token, decode to user, persist
  const login = async (username, password) => {
    try {
      const { token: newToken } = await userlogin({ username, password });
      if (!newToken) throw new Error("No token received");

      // Decode user info
      const { userId, role, foundationId } = jwtDecode(newToken);
      const newUser = { id: userId, role, foundationId };

      // Persist under ONE key: "auth"
      localStorage.setItem(
        "auth",
        JSON.stringify({ token: newToken, user: newUser })
      );

      setToken(newToken);
      setUser(newUser);
      toast.success("Logged in successfully.");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Login failed. Check credentials.");
      return false;
    }
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
      value={{ token, user, isAuthenticated, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
