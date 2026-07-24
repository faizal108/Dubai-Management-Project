// src/features/transfers/api.js
// Wrappers over the /transfers endpoints. Transfers move money between the
// foundation's own buckets (cash <-> bank) and open/close fixed deposits.
// Reads are gated by bankAccount:view, writes by transfer:manage server-side.

import { api, withQuery } from "../../lib/api";

const BASE = "/transfers";

export const listTransfers = (params) =>
  api.get(withQuery(BASE, params));

export const listFixedDeposits = (params) =>
  api.get(withQuery(`${BASE}/fixed-deposits`, params));

export const createTransfer = (payload) => api.post(BASE, payload);

export const deleteTransfer = (id) => api.delete(`${BASE}/${id}`);
