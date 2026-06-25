import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./stats.service.js";

export const summaryHandler = asyncHandler(async (req, res) => {
  const data = await service.getSummary(req.user, req.query);
  res.json({ summary: data });
});

export const trendsHandler = asyncHandler(async (req, res) => {
  const data = await service.getTrends(req.user, req.query);
  res.json({ trends: data });
});

export const topDonorsHandler = asyncHandler(async (req, res) => {
  const data = await service.getTopDonors(req.user, req.query);
  res.json({ topDonors: data });
});

export const recentDonationsHandler = asyncHandler(async (req, res) => {
  const data = await service.getRecentDonations(req.user, req.query);
  res.json({ recentDonations: data });
});
