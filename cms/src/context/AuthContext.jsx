// src/context/AuthContext.jsx

import React, { createContext, useState, useEffect, useContext } from "react";
import { userlogin } from "../apis/endpoints";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  login: async (username, password) => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // on initial mount, check localStorage
    const stored = localStorage.getItem("auth");
    if (stored) {
      try {
        const { token, user } = JSON.parse(stored);
        return user;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const isAuthenticated = Boolean(user);

  // login: call backend, store token & user object
  const login = async (username, password) => {
    try {
      const response = await userlogin({ username, password });
      // console.log("AuthContext login Response:", response);

      const { token } = response || {};
      if (!token) {
        throw new Error("Token missing in response.");
      }

      // Optionally decode the token if needed
      const decoded = jwtDecode(token); // contains: userId, role, foundationId

      const user = {
        id: decoded.userId,
        role: decoded.role,
        foundationId: decoded.foundationId,
      };

      // Persist to localStorage
      localStorage.setItem("auth", JSON.stringify({ token, user }));

      // Update context
      setUser(user);

      toast.success("Logged in successfully.");
      return true;
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Login failed. Please check credentials.");
      return false;
    }
  };

  // logout: remove token + user, redirect to /login
  const logout = () => {
    localStorage.removeItem("auth");
    setUser(null);
    toast.info("You have been logged out.");
    window.location.href = "/login";
  };

  // Optionally: if you want to “ping” /validate the token on refresh, you could do that here.
  useEffect(() => {
    // Example: call /auth/validate to confirm token is still valid
    // If invalid, call logout().
    // For brevity, skipping actual implementation.
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easier consumption
export const useAuth = () => useContext(AuthContext);
