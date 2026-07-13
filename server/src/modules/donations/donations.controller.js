import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./donations.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listDonations(req.user, req.query);
  res.json(page);
});

export const getHandler = asyncHandler(async (req, res) => {
  const donation = await service.getDonation(req.user, req.params.id);
  res.json({ donation });
});

export const createHandler = asyncHandler(async (req, res) => {
  const donation = await service.createDonation(req.user, req.body);
  res.status(201).json({ donation });
});

export const updateHandler = asyncHandler(async (req, res) => {
  const donation = await service.updateDonation(req.user, req.params.id, req.body);
  res.json({ donation });
});

export const markReceivedHandler = asyncHandler(async (req, res) => {
  const donation = await service.markReceived(req.user, req.params.id);
  res.json({ donation });
});

export const markPrintedHandler = asyncHandler(async (req, res) => {
  const donation = await service.markPrinted(req.user, req.params.id);
  res.json({ donation });
});

export const deleteHandler = asyncHandler(async (req, res) => {
  await service.deleteDonation(req.user, req.params.id);
  res.status(204).send();
});

export const restoreHandler = asyncHandler(async (req, res) => {
  const donation = await service.restoreDonation(req.user, req.params.id);
  res.json({ donation });
});

export const resendWhatsappHandler = asyncHandler(async (req, res) => {
  const donation = await service.resendWhatsappReceipt(req.user, req.params.id);
  res.json({ donation });
});
