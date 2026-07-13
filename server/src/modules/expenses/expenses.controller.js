import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./expenses.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listExpenses(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const expense = await service.getExpense(req.user, req.params.id);
  res.json({ expense });
});

export const createHandler = asyncHandler(async (req, res) => {
  const expense = await service.createExpense(req.user, req.body);
  res.status(201).json({ expense });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const expense = await service.updateExpense(
    req.user,
    req.params.id,
    req.body
  );
  res.json({ expense });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteExpense(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const expense = await service.restoreExpense(req.user, req.params.id);
  res.json({ expense });
});
