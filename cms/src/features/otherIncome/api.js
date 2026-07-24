// src/features/otherIncome/api.js
// In-kind / non-cash receipts (goods donated). Never touches the money ledger.

import { api, withQuery } from "../../lib/api";

const BASE = "/other-income";

export const listOtherIncome = (params) => api.get(withQuery(BASE, params));
export const createOtherIncome = (data) => api.post(BASE, data);
export const updateOtherIncome = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteOtherIncome = (id) => api.delete(`${BASE}/${id}`);
export const restoreOtherIncome = (id) => api.post(`${BASE}/${id}/restore`);
