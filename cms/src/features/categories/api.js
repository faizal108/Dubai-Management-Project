// src/features/categories/api.js
// Unified category CRUD (kind = INCOME | EXPENSE | OTHER_INCOME). Reads are open
// to any authenticated tenant user; writes require category:manage server-side.

import { api, withQuery } from "../../lib/api";

const BASE = "/categories";

export const listCategories = (params) => api.get(withQuery(BASE, params));
export const createCategory = (data) => api.post(BASE, data);
export const updateCategory = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteCategory = (id) => api.delete(`${BASE}/${id}`);
export const restoreCategory = (id) => api.post(`${BASE}/${id}/restore`);
