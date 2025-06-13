import { api } from "./api";

const API_VERSION = "v1";
const AUTH_BASE = `/api/v1/auth`;
const DONOR_BASE = `/api/v1/donors`;
const DONATION_BASE = `/api/v1/donations`;

const ENDPOINTS = {
  // AUTH & USER
  login: () => `${AUTH_BASE}/login`,
  getAuthDetails: (userId) => `${AUTH_BASE}/getAuthDetails?userId=${userId}`,
  getUserProfile: (userId) => `${USER_BASE}/keycloak/getUsers?userId=${userId}`,
  createUser: () => `${USER_BASE}/create`,

  // DONOR
  getAllDonors: () => `${DONOR_BASE}/`,
  addDonor: () => `${DONOR_BASE}/`,
  getDonorById: (donorId) => `${DONOR_BASE}/${donorId}`,
  updateDonor: (donorId) => `${DONOR_BASE}/${donorId}`,
  deleteDonor: (donorId) => `${DONOR_BASE}/${donorId}`,
  fetchDonorByPan: (pan) => `${DONOR_BASE}/existByPan?pan=${pan}`,
  fetchDonationsByPan: (pan) => `${DONOR_BASE}/fetchDonationByPan?pan=${pan}`,

  // DONATION
  getAllDonations: () => `${DONATION_BASE}/`,
  addDonation: (pageNo, pageSize) => `${DONATION_BASE}/?pageNo=${pageNo}&pageSize=${pageSize}`,
  getDonationById: (donationId) => `${DONATION_BASE}/${donationId}`,
  updateDonation: (donationId) => `${DONATION_BASE}/${donationId}`,
  deleteDonation: (donationId) => `${DONATION_BASE}/${donationId}`,
  searchDonation: (fullName, pan) => `${DONATION_BASE}/search?fullName=${fullName}&pan=${pan}`,
  updatePrintStatus: (donationId) => `${DONATION_BASE}/${donationId}/markPrinted`,


  // (Feel free to add more resource-specific URIs here)
};

// Authentication Endpoints
export const userlogin = (userData) => api.post(ENDPOINTS.login(), userData);

// Donor Endpoints
export const getAllDonors = () => api.get(ENDPOINTS.getAllDonors());
export const addDonor = (donorData) =>
  api.post(ENDPOINTS.addDonor(), donorData);
export const getDonorById = (donorId) =>
  api.get(ENDPOINTS.getDonorById(donorId));
export const updateDonor = (donorId, donorData) =>
  api.put(ENDPOINTS.updateDonor(donorId), donorData);
export const deleteDonor = (donorId) =>
  api.delete(ENDPOINTS.deleteDonor(donorId));
export const fetchDonorByPan = (pan) =>
  api.get(ENDPOINTS.fetchDonorByPan(pan));
export const fetchDonationsByPan = (pan) =>
  api.get(ENDPOINTS.fetchDonationsByPan(pan));

// Donation Endpoints
export const getAllDonations = (pageNo, pageSize) => api.get(ENDPOINTS.getAllDonations(pageNo, pageSize));
export const addDonation = (donationData) =>
  api.post(ENDPOINTS.addDonation(), donationData);
export const getDonationById = (donationId) =>
  api.get(ENDPOINTS.getDonationById(donationId));
export const updateDonation = (donationId, donationData) =>
  api.put(ENDPOINTS.updateDonation(donationId), donationData);
export const deleteDonation = (donationId) =>
  api.delete(ENDPOINTS.deleteDonation(donationId));
export const searchDonation = (fullName, pan) =>
  api.delete(ENDPOINTS.deleteDonation(fullName, pan));
export const updatePrintStatus = (donationId) =>
  api.put(ENDPOINTS.updatePrintStatus(donationId));