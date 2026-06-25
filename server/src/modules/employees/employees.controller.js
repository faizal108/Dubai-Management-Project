import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./employees.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listEmployees(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const employee = await service.getEmployee(req.user, req.params.id);
  res.json({ employee });
});

export const createHandler = asyncHandler(async (req, res) => {
  const employee = await service.createEmployee(req.user, req.body);
  res.status(201).json({ employee });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const employee = await service.updateEmployee(req.user, req.params.id, req.body);
  res.json({ employee });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteEmployee(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const employee = await service.restoreEmployee(req.user, req.params.id);
  res.json({ employee });
});
