// src/features/admins/api.js
// Foundation-staff (ADMIN role) management — SUPERADMIN only.

import { api, withQuery } from "../../lib/api";

const BASE = "/admins";

export const listAdmins = (params) => api.get(withQuery(BASE, params));
export const createAdmin = (data) => api.post(BASE, data);
export const getAdmin = (id) => api.get(`${BASE}/${id}`);
export const updateAdmin = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteAdmin = (id) => api.delete(`${BASE}/${id}`);
export const restoreAdmin = (id) => api.post(`${BASE}/${id}/restore`);
export const resetAdminPassword = (id, data) =>
  api.post(`${BASE}/${id}/reset-password`, data);
