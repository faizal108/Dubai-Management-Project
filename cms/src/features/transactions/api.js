// src/features/transactions/api.js
// Ledger reads. The Transaction table is append-only and populated as a side
// effect of donation / expense mutations, so there's no create / update /
// delete endpoint — only listing with filters. Read is gated on
// bankAccount:view, matching the bank-account workspace.

import { api, withQuery } from "../../lib/api";

const BASE = "/transactions";

export const listTransactions = (params) =>
  api.get(withQuery(BASE, params));
