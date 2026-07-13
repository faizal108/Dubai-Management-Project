// src/features/activities/api.js
// Activity CRUD. ADMIN/EMPLOYEE are scoped to their own foundation by the
// backend; SUPERADMIN may pass foundationId explicitly.

import { api, withQuery } from "../../lib/api";

const BASE = "/activities";

export const listActivities = (params) => api.get(withQuery(BASE, params));

// Server wraps single-activity responses as { activity }. Unwrap here so
// callers receive a flat object — matches the donor pattern.
export const getActivity = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res?.activity ?? res;
};

export const createActivity = async (data) => {
  const res = await api.post(BASE, data);
  return res?.activity ?? res;
};

export const updateActivity = async (id, data) => {
  const res = await api.patch(`${BASE}/${id}`, data);
  return res?.activity ?? res;
};

export const deleteActivity = (id) => api.delete(`${BASE}/${id}`);

export const restoreActivity = async (id) => {
  const res = await api.post(`${BASE}/${id}/restore`);
  return res?.activity ?? res;
};
