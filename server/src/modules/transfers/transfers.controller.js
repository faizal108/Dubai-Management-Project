import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./transfers.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listTransfers(req.user, req.query);
  res.json(page);
});

export const listFixedDepositsHandler = asyncHandler(async (req, res) => {
  const page = await service.listFixedDeposits(req.user, req.query);
  res.json(page);
});

export const createHandler = asyncHandler(async (req, res) => {
  const transfer = await service.createTransfer(req.user, req.body);
  res.status(201).json({ transfer });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteTransfer(req.user, req.params.id);
  res.status(204).send();
});
