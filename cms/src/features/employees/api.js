// src/features/employees/api.js
// Foundation-staff EMPLOYEE role management — ADMIN (own foundation) and
// SUPERADMIN (any foundation via foundationId param).

import { api, withQuery } from "../../lib/api";

const BASE = "/employees";

export const listEmployees = (params) => api.get(withQuery(BASE, params));
export const createEmployee = (data) => api.post(BASE, data);
export const getEmployee = (id) => api.get(`${BASE}/${id}`);
export const updateEmployee = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteEmployee = (id) => api.delete(`${BASE}/${id}`);
export const restoreEmployee = (id) => api.post(`${BASE}/${id}/restore`);
