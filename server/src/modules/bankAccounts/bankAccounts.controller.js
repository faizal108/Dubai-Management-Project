import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./bankAccounts.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listBankAccounts(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const bankAccount = await service.getBankAccount(req.user, req.params.id);
  res.json({ bankAccount });
});

export const createHandler = asyncHandler(async (req, res) => {
  const bankAccount = await service.createBankAccount(req.user, req.body);
  res.status(201).json({ bankAccount });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const bankAccount = await service.updateBankAccount(
    req.user,
    req.params.id,
    req.body
  );
  res.json({ bankAccount });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteBankAccount(req.user, req.params.id);
  res.status(204).send();
});
