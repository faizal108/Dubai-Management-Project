import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./categories.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listCategories(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const category = await service.getCategory(req.user, req.params.id);
  res.json({ category });
});

export const createHandler = asyncHandler(async (req, res) => {
  const category = await service.createCategory(req.user, req.body);
  res.status(201).json({ category });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const category = await service.updateCategory(req.user, req.params.id, req.body);
  res.json({ category });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteCategory(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const category = await service.restoreCategory(req.user, req.params.id);
  res.json({ category });
});
