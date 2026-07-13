// src/features/expenses/api.js
// Expense + expense-category CRUD. ADMIN/EMPLOYEE are scoped to their own
// foundation by the backend; SUPERADMIN may pass foundationId explicitly.
// Follows the same single-resource unwrap pattern used by activities/donors —
// the server wraps single-item responses as { expense } / { category }.

import { api, withQuery } from "../../lib/api";

// ── Expenses ────────────────────────────────────────────────────────────────
const EXPENSES = "/expenses";

export const listExpenses = (params) => api.get(withQuery(EXPENSES, params));

export const getExpense = async (id) => {
  const res = await api.get(`${EXPENSES}/${id}`);
  return res?.expense ?? res;
};

export const createExpense = async (data) => {
  const res = await api.post(EXPENSES, data);
  return res?.expense ?? res;
};

export const updateExpense = async (id, data) => {
  const res = await api.patch(`${EXPENSES}/${id}`, data);
  return res?.expense ?? res;
};

export const deleteExpense = (id) => api.delete(`${EXPENSES}/${id}`);

export const restoreExpense = async (id) => {
  const res = await api.post(`${EXPENSES}/${id}/restore`);
  return res?.expense ?? res;
};

// ── Expense Categories ──────────────────────────────────────────────────────
const CATEGORIES = "/expense-categories";

export const listExpenseCategories = (params) =>
  api.get(withQuery(CATEGORIES, params));

export const getExpenseCategory = async (id) => {
  const res = await api.get(`${CATEGORIES}/${id}`);
  return res?.category ?? res;
};

export const createExpenseCategory = async (data) => {
  const res = await api.post(CATEGORIES, data);
  return res?.category ?? res;
};

export const updateExpenseCategory = async (id, data) => {
  const res = await api.patch(`${CATEGORIES}/${id}`, data);
  return res?.category ?? res;
};

export const deleteExpenseCategory = (id) => api.delete(`${CATEGORIES}/${id}`);

export const restoreExpenseCategory = async (id) => {
  const res = await api.post(`${CATEGORIES}/${id}/restore`);
  return res?.category ?? res;
};
