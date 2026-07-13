// src/features/dashboard/api.js
// Aggregated stats for the Dashboard. All endpoints accept an optional
// `foundationId` (SUPERADMIN-only narrowing; ADMIN is locked server-side).

import { api, withQuery } from "../../lib/api";

const BASE = "/stats";

export const getSummary = (params) =>
  api.get(withQuery(`${BASE}/summary`, params));

export const getTrends = (params) =>
  api.get(withQuery(`${BASE}/trends`, params));

export const getTopDonors = (params) =>
  api.get(withQuery(`${BASE}/top-donors`, params));

export const getRecentDonations = (params) =>
  api.get(withQuery(`${BASE}/recent-donations`, params));

export const getPendingDonations = (params) =>
  api.get(withQuery(`${BASE}/pending-donations`, params));
