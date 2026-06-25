// src/lib/api.js
// Single Axios instance for the whole app. Owns auth header injection, 401
// session-expiry handling, and standardised error-toast surfacing.

import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { getAuthToken } from "./authHelpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

// REQUEST: inject Bearer token, set JSON Content-Type unless FormData.
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE: unwrap data, route 401 to /login, expose parsed error envelope.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem("auth");
        toast.error("Your session has expired. Please log in again.");
        window.location.href = "/login";
        return Promise.reject(error);
      }
      // Backend error envelope: { error: { code, message, details: { fieldErrors } } }
      const envelope = data?.error;
      const message =
        envelope?.message ||
        data?.message ||
        "An unexpected error occurred. Please try again.";
      toast.error(`Error ${status}: ${message}`);
      error.apiError = envelope || { message };
      return Promise.reject(error);
    }
    toast.error("Network error: could not reach the API.");
    return Promise.reject(error);
  }
);

// Serialize a flat params object, dropping null/undefined/empty values.
export const qs = (params) => {
  if (!params) return "";
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    usp.append(k, v);
  });
  return usp.toString();
};

// Helper for endpoints that accept query params: appends "?…" only if non-empty.
export const withQuery = (path, params) => {
  const s = qs(params);
  return s ? `${path}?${s}` : path;
};
