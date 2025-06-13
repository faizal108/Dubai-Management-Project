// src/apis/api.js

import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { getAuthToken } from "../utils/authHelpers"; // small helper to parse localStorage auth

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create a single Axios instance for the entire app.
export const api = axios.create({
  baseURL: API_BASE_URL,
  // You can tune timeouts or other defaults here
  timeout: 15_000,
});

// REQUEST INTERCEPTOR:
// • Auto-inject Bearer token if present
// • Auto-set Content-Type (or let browser handle FormData)
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    // If sending FormData, let browser set Content-Type boundary
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else {
      // Default to JSON for regular JSON payloads
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE INTERCEPTOR:
// • If 401 → clear local auth, inform user via toast, redirect to login.
// • Else if any other HTTP error → surface toast with error message.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        // Unauthorized: session probably expired
        localStorage.removeItem("auth");
        toast.error("Your session has expired. Please log in again.");
        window.location.href = "/login";
        return Promise.reject(error);
      }
      // For any other 4xx/5xx, show a toast with the server-provided message
      const message =
        data?.message ||
        data?.error ||
        "An unexpected error occurred. Please try again.";
      toast.error(`Error ${status}: ${message}`);
      return Promise.reject(error);
    }
    // Network or CORS error (no response)
    toast.error("Network error: could not reach the API.");
    return Promise.reject(error);
  }
);
