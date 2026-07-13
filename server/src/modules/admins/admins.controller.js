import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./admins.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listAdmins(req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const admin = await service.getAdmin(req.params.id);
  res.json({ admin });
});

export const createHandler = asyncHandler(async (req, res) => {
  const admin = await service.createAdmin(req.body);
  res.status(201).json({ admin });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const admin = await service.updateAdmin(req.params.id, req.body);
  res.json({ admin });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteAdmin(req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const admin = await service.restoreAdmin(req.params.id);
  res.json({ admin });
});
