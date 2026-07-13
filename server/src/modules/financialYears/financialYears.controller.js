import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./financialYears.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listFinancialYears(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const financialYear = await service.getFinancialYear(req.user, req.params.id);
  res.json({ financialYear });
});

export const createHandler = asyncHandler(async (req, res) => {
  const financialYear = await service.createFinancialYear(req.user, req.body);
  res.status(201).json({ financialYear });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const financialYear = await service.updateFinancialYear(
    req.user,
    req.params.id,
    req.body
  );
  res.json({ financialYear });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteFinancialYear(req.user, req.params.id);
  res.status(204).send();
});

export const closeHandler = asyncHandler(async (req, res) => {
  const financialYear = await service.closeFinancialYear(
    req.user,
    req.params.id
  );
  res.json({ financialYear });
});

export const reopenHandler = asyncHandler(async (req, res) => {
  const financialYear = await service.reopenFinancialYear(
    req.user,
    req.params.id
  );
  res.json({ financialYear });
});
