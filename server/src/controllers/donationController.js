// server/src/controllers/donationController.js
import * as svc from "../services/donationService.js";

export async function listDonations(req, res) {
  const { pageNo, pageSize } = req.query;
  const { total, donations } = await svc.getDonations({
    foundationId: req.user.foundationId,
    pageNo,
    pageSize,
  });
  res.json({
    totalRecords: total,
    pageCount: Math.ceil(total / pageSize) || 1,
    currentPage: pageNo,
    pageSize,
    data: donations,
  });
}

export async function createDonation(req, res) {
  const payload = {
    ...req.body,
    donationDate: req.body.donationDate && new Date(req.body.donationDate),
    transactionDate:
      req.body.transactionDate && new Date(req.body.transactionDate),
  };
  const d = await svc.createDonation({
    foundationId: req.user.foundationId,
    payload,
  });
  res.status(201).json(d);
}

export async function getDonation(req, res) {
  const d = await svc.getDonationById({
    foundationId: req.user.foundationId,
    donationId: req.params.id,
  });
  if (!d) return res.status(404).json({ error: "Not found" });
  res.json(d);
}

export async function updateDonation(req, res) {
  const payload = req.body;
  const d = await svc.updateDonation({
    foundationId: req.user.foundationId,
    donationId: req.params.id,
    donationData: payload,
  });
  res.json(d);
}

export async function removeDonation(req, res) {
  await svc.deleteDonation({
    foundationId: req.user.foundationId,
    donationId: req.params.id,
  });
  res.status(204).send();
}

export async function searchDonations(req, res) {
  const { name, pan } = req.query;
  const results = await svc.searchDonations({
    foundationId: req.user.foundationId,
    fullName: name,
    pan,
  });
  res.json(results);
}
export async function markPrintedDonation(req, res) {
  try {
    const updated = await svc.markPrintedDonation({
      foundationId: req.user.foundationId,
      donationId: req.params.id,
    });
    if (!updated) {
      return res.status(404).json({ error: "Donation not found" });
    }
    res.json(updated);
  } catch (err) {
    console.error("Error marking printed:", err);
    res.status(500).json({ error: err.message });
  }
}
// Utility
export async function countDonations(req, res) {
  const total = await svc.countDonations(req.user.foundationId);
  res.json({ total });
}

export async function listTrashedDonations(req, res) {
  const trashed = await svc.getTrashedDonations(req.user.foundationId);
  res.json(trashed);
}

export async function restoreDonation(req, res) {
  const d = await svc.restoreDonation({
    foundationId: req.user.foundationId,
    donationId: req.params.id,
  });
  res.json(d);
}
