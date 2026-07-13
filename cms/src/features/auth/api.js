// src/features/auth/api.js
// Auth-feature endpoints (login + current user).

import { api } from "../../lib/api";

const AUTH_BASE = "/auth";

export const userLogin = (credentials) =>
  api.post(`${AUTH_BASE}/login`, credentials);

export const fetchMe = () => api.get(`${AUTH_BASE}/me`);

export const updateProfile = (payload) =>
  api.patch(`${AUTH_BASE}/profile`, payload);

export const changePassword = (payload) =>
  api.post(`${AUTH_BASE}/change-password`, payload);
