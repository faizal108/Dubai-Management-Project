import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./activities.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listActivities(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const activity = await service.getActivity(req.user, req.params.id);
  res.json({ activity });
});

export const createHandler = asyncHandler(async (req, res) => {
  const activity = await service.createActivity(req.user, req.body);
  res.status(201).json({ activity });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const activity = await service.updateActivity(req.user, req.params.id, req.body);
  res.json({ activity });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteActivity(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const activity = await service.restoreActivity(req.user, req.params.id);
  res.json({ activity });
});
