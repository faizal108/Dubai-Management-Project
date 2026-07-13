import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./auth.service.js";

export const loginHandler = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  res.json(result);
});

export const signupCustomerHandler = asyncHandler(async (req, res) => {
  const result = await service.signupCustomer(req.body);
  res.status(201).json(result);
});

export const meHandler = asyncHandler(async (req, res) => {
  const user = await service.me(req.user.id);
  res.json({ user });
});

export const updateProfileHandler = asyncHandler(async (req, res) => {
  const user = await service.updateProfile(req.user.id, req.body);
  res.json({ user });
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  await service.changePassword(req.user.id, req.body);
  res.status(204).end();
});
