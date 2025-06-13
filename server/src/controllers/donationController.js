// server/src/controllers/donationController.js
import * as donationService from "../services/donationService.js";

export async function createDonation(req, res) {
  try {
    const {
      donorId,
      type,
      bankName,
      utr,
      ifsc,
      donationDate,
      transactionDate,
      amount,
    } = req.body;

    const donation = await donationService.createDonation({
      foundationId: req.user.foundationId,
      payload: {
        donorId,
        type,
        bankName,
        utr,
        ifsc,
        donationDate: donationDate ? new Date(donationDate) : undefined,
        transactionDate: transactionDate ? new Date(transactionDate) : null,
        amount: parseFloat(amount),
        donationReceived: "PENDING",
      },
    });

    res.status(201).json(donation);
  } catch (err) {
    console.error("Create Donation Error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function listDonations(req, res) {
  try {
    // Parse query params with defaults
    let pageNo = parseInt(req.query.pageNo, 10);
    let pageSize = parseInt(req.query.pageSize, 10);

    if (isNaN(pageNo) || pageNo < 0) pageNo = 0;
    if (isNaN(pageSize) || pageSize <= 0) pageSize = 20;

    const { total, donations } = await donationService.getDonations({
      foundationId: req.user.foundationId,
      pageNo,
      pageSize,
    });

    const pageCount = Math.ceil(total / pageSize) || 1;

    return res.json({
      totalRecords: total,
      pageCount,
      currentPage: pageNo,
      pageSize,
      data: donations,
    });
  } catch (err) {
    console.error("Error in listDonations:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getDonation(req, res) {
  try {
    const donation = await donationService.getDonationById({
      foundationId: req.user.foundationId,
      donationId: req.params.id,
    });
    if (!donation) return res.status(404).json({ error: "Donation not found" });
    res.json(donation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateDonation(req, res) {
  try {
    const donation = await donationService.updateDonation({
      foundationId: req.user.foundationId,
      donationId: req.params.id,
      donationData: req.body,
    });
    res.json(donation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeDonation(req, res) {
  try {
    await donationService.deleteDonation({
      foundationId: req.user.foundationId,
      donationId: req.params.id,
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function searchDonations(req, res) {
  try {
    console.log("Searching donations with params:", req.query);

    const donations = await donationService.searchDonations({
      foundationId: cmb3n2rpe0000do9fkfsy5lw1,
      fullName: req.query.name,
      pan: req.query.pan,
    });

    if (!donations || donations.length === 0) {
      return res.status(404).json({ message: "No donations found" });
    }

    res.json(donations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch donations" });
  }
}
export async function markPrintedDonation(req, res) {
  try {
    const updated = await donationService.markPrintedDonation({
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

export async function countDonations(req, res) {
  try {
    const foundationId = req.user?.foundationId;
    if (!foundationId)
      return res.status(400).json({ error: "Missing foundation ID" });

    const total = await svc.countDonations(foundationId);
    return res.json({ total });
  } catch (err) {
    console.error("[countDonations] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listTrashedDonations(req, res) {
  try {
    const foundationId = req.user?.foundationId;
    if (!foundationId)
      return res.status(400).json({ error: "Missing foundation ID" });

    const trashed = await svc.getTrashedDonations(foundationId);
    return res.json(trashed);
  } catch (err) {
    console.error("[listTrashedDonations] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function restoreDonation(req, res) {
  try {
    const foundationId = req.user?.foundationId;
    const donationId = req.params?.id;

    if (!foundationId || !donationId) {
      return res
        .status(400)
        .json({ error: "Missing foundation ID or donation ID" });
    }

    const result = await svc.restoreDonation({ foundationId, donationId });
    return res.json(result);
  } catch (err) {
    console.error("[restoreDonation] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
