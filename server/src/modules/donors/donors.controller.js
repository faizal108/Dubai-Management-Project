import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./donors.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listDonors(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const donor = await service.getDonor(req.user, req.params.id);
  res.json({ donor });
});

export const createHandler = asyncHandler(async (req, res) => {
  const donor = await service.createDonor(req.user, req.body);
  res.status(201).json({ donor });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const donor = await service.updateDonor(req.user, req.params.id, req.body);
  res.json({ donor });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteDonor(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const donor = await service.restoreDonor(req.user, req.params.id);
  res.json({ donor });
});
