import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./otherIncome.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listOtherIncome(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const otherIncome = await service.getOtherIncome(req.user, req.params.id);
  res.json({ otherIncome });
});

export const createHandler = asyncHandler(async (req, res) => {
  const otherIncome = await service.createOtherIncome(req.user, req.body);
  res.status(201).json({ otherIncome });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const otherIncome = await service.updateOtherIncome(req.user, req.params.id, req.body);
  res.json({ otherIncome });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteOtherIncome(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const otherIncome = await service.restoreOtherIncome(req.user, req.params.id);
  res.json({ otherIncome });
});
