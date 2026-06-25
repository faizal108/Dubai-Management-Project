import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./foundations.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listFoundations(req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const foundation = await service.getFoundation(req.params.id);
  res.json({ foundation });
});

export const createHandler = asyncHandler(async (req, res) => {
  const foundation = await service.createFoundation(req.body);
  res.status(201).json({ foundation });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const foundation = await service.updateFoundation(req.params.id, req.body);
  res.json({ foundation });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteFoundation(req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const foundation = await service.restoreFoundation(req.params.id);
  res.json({ foundation });
});

// ADMIN self-serve: read the caller's own foundation. SUPERADMIN may also call
// this — it resolves whichever foundation they happen to be bound to (or 403s
// when they aren't bound to one).
export const getMyHandler = asyncHandler(async (req, res) => {
  const foundation = await service.getMyFoundation(req.user.foundationId);
  res.json({ foundation });
});

export const updateMyHandler = asyncHandler(async (req, res) => {
  const foundation = await service.updateMyFoundation(
    req.user.foundationId,
    req.body
  );
  res.json({ foundation });
});
