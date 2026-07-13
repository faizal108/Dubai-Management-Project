// src/features/donations/api.js
// Donation CRUD + lifecycle transitions.

import { api, withQuery } from "../../lib/api";

const BASE = "/donations";

export const listDonations = (params) => api.get(withQuery(BASE, params));
export const createDonation = (data) => api.post(BASE, data);
export const getDonation = (id) => api.get(`${BASE}/${id}`);
export const updateDonation = (id, data) => api.patch(`${BASE}/${id}`, data);
export const deleteDonation = (id) => api.delete(`${BASE}/${id}`);
export const restoreDonation = (id) => api.post(`${BASE}/${id}/restore`);
export const markDonationReceived = (id) =>
  api.post(`${BASE}/${id}/mark-received`);
export const markDonationPrinted = (id) =>
  api.post(`${BASE}/${id}/mark-printed`);
export const resendDonationWhatsapp = (id) =>
  api.post(`${BASE}/${id}/whatsapp/resend`);
