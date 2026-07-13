// src/features/foundations/api.js
// Foundation CRUD (SUPERADMIN-only on the server, but reused as a read-only
// dropdown source by ADMIN-facing donors/admins screens).

import { api, withQuery } from "../../lib/api";

const BASE = "/foundations";

export const listFoundations = (params) => api.get(withQuery(BASE, params));
export const createFoundation = (data) => api.post(BASE, data);
export const getFoundation = (id) => api.get(`${BASE}/${id}`);
export const updateFoundation = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteFoundation = (id) => api.delete(`${BASE}/${id}`);
export const restoreFoundation = (id) => api.post(`${BASE}/${id}/restore`);

// ADMIN self-serve endpoints — read/update the caller's own foundation
// (cashLimit, WhatsApp Business). Server resolves foundationId from the JWT.
export const getMyFoundation = () => api.get(`${BASE}/me`);
export const updateMyFoundation = (data) => api.patch(`${BASE}/me`, data);
