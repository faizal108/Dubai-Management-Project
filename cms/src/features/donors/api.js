// src/features/donors/api.js
// Donor CRUD. ADMIN is scoped to their own foundation by the backend.

import { api, withQuery } from "../../lib/api";

const BASE = "/donors";

export const listDonors = (params) => api.get(withQuery(BASE, params));
export const createDonor = (data) => api.post(BASE, data);
// Server wraps the single-donor response as { donor }. Unwrap here so callers
// receive a flat donor object — matches fetchDonorByPan and avoids each
// consumer having to remember the envelope.
export const getDonor = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res?.donor ?? res;
};
export const updateDonor = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteDonor = (id) => api.delete(`${BASE}/${id}`);
export const restoreDonor = (id) => api.post(`${BASE}/${id}/restore`);

// Look up a donor by exact PAN. The backend search uses ?q= and matches PAN
// substring (case-insensitive), so we always confirm an exact PAN match
// client-side before returning a hit. ADMIN scope is enforced server-side.
export async function fetchDonorByPan(pan) {
  const normalized = (pan || "").trim().toUpperCase();
  if (!normalized) return null;
  const page = await listDonors({ q: normalized, pageSize: 5 });
  const items = page?.items ?? [];
  return items.find((d) => d.pan?.toUpperCase() === normalized) ?? null;
}
