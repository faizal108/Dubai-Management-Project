import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./accounting.service.js";

export const summaryHandler = asyncHandler(async (req, res) => {
  const data = await service.getAccountingSummary(req.user, req.query);
  res.json({ summary: data });
});

// Ledger listings return a standard paged envelope plus `financialYear` and
// `totalAmount` so the accounting screens can render the summary bar without
// a second call. See listLedger in the service for envelope shape.
export const incomeLedgerHandler = asyncHandler(async (req, res) => {
  const page = await service.listIncomeLedger(req.user, req.query);
  res.json(page);
});

export const expenseLedgerHandler = asyncHandler(async (req, res) => {
  const page = await service.listExpenseLedger(req.user, req.query);
  res.json(page);
});

export const cashBookHandler = asyncHandler(async (req, res) => {
  const page = await service.listCashBook(req.user, req.query);
  res.json(page);
});

export const bankBookHandler = asyncHandler(async (req, res) => {
  const page = await service.listBankBook(req.user, req.query);
  res.json(page);
});

export const reportsHandler = asyncHandler(async (req, res) => {
  const data = await service.getAccountingReport(req.user, req.query);
  res.json({ report: data });
});
