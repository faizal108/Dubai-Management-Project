// src/features/accounting/api.js
// Thin wrappers over the read-only /accounting endpoints. Every route is
// FY-scoped; the service falls back to the tenant's active FY when
// financialYearId is omitted. All responses are already serialized (Decimals
// as Numbers) so callers can render directly.

import { api, withQuery } from "../../lib/api";

const BASE = "/accounting";

export const getAccountingSummary = (params) =>
  api.get(withQuery(`${BASE}/summary`, params));

export const listIncomeLedger = (params) =>
  api.get(withQuery(`${BASE}/ledger/income`, params));

export const listExpenseLedger = (params) =>
  api.get(withQuery(`${BASE}/ledger/expense`, params));

export const listCashBook = (params) =>
  api.get(withQuery(`${BASE}/books/cash`, params));

export const listBankBook = (params) =>
  api.get(withQuery(`${BASE}/books/bank`, params));

export const getAccountingReport = (params) =>
  api.get(withQuery(`${BASE}/reports`, params));
