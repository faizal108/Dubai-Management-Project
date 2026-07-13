import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./transactions.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listTransactions(req.user, req.query);
  res.json(page);
});
