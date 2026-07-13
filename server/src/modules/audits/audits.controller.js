import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./audits.service.js";

export const listHandler = asyncHandler(async (req, res) => {
  const page = await service.listAudits(req.query);
  res.json(page);
});
