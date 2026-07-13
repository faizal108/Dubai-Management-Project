// src/features/bankAccounts/api.js
// Bank-account CRUD. Reads gate on bankAccount:view; writes on bankAccount:manage.
// Server enforces both. Single-resource endpoints return { bankAccount }; we
// unwrap so callers can treat the result like a plain object (mirrors
// financialYears / donations / expenses).

import { api, withQuery } from "../../lib/api";

const BASE = "/bank-accounts";

export const listBankAccounts = (params) =>
  api.get(withQuery(BASE, params));

export const getBankAccount = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res?.bankAccount ?? res;
};

export const createBankAccount = async (data) => {
  const res = await api.post(BASE, data);
  return res?.bankAccount ?? res;
};

export const updateBankAccount = async (id, data) => {
  const res = await api.patch(`${BASE}/${id}`, data);
  return res?.bankAccount ?? res;
};

export const deleteBankAccount = (id) => api.delete(`${BASE}/${id}`);
