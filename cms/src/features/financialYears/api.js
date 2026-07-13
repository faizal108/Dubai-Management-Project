// src/features/financialYears/api.js
// Financial-year CRUD + close/reopen. Reads are open to any authenticated
// tenant user; writes gate on financialYear:manage, and /reopen additionally
// requires ADMIN/SUPERADMIN role — the server enforces both.
//
// Single-resource endpoints return { financialYear }; we unwrap so callers
// can treat the result like a plain object (mirrors donations/expenses).

import { api, withQuery } from "../../lib/api";

const BASE = "/financial-years";

export const listFinancialYears = (params) =>
  api.get(withQuery(BASE, params));

export const getFinancialYear = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res?.financialYear ?? res;
};

export const createFinancialYear = async (data) => {
  const res = await api.post(BASE, data);
  return res?.financialYear ?? res;
};

export const updateFinancialYear = async (id, data) => {
  const res = await api.patch(`${BASE}/${id}`, data);
  return res?.financialYear ?? res;
};

export const deleteFinancialYear = (id) => api.delete(`${BASE}/${id}`);

export const closeFinancialYear = async (id) => {
  const res = await api.post(`${BASE}/${id}/close`);
  return res?.financialYear ?? res;
};

export const reopenFinancialYear = async (id) => {
  const res = await api.post(`${BASE}/${id}/reopen`);
  return res?.financialYear ?? res;
};
