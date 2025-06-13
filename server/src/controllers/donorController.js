// server/src/controllers/donorController.js
import * as donorService from "../services/donorService.js";

export async function createDonor(req, res) {
  try {
    const donor = await donorService.createDonor({
      foundationId: req.user.foundationId,
      donorData: req.body,
    });
    res.status(201).json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function listDonors(req, res) {
  try {
    const pageNo = parseInt(req.query.pageNo, 10) || 0;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;

    const { donors, total } = await donorService.getDonors({
      foundationId: req.user.foundationId,
      pageNo,
      pageSize,
    });

    return res.json({ pageNo, pageSize, total, donors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDonor(req, res) {
  try {
    const donor = await donorService.getDonorById({
      foundationId: req.user.foundationId,
      donorId: req.params.id,
    });
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateDonor(req, res) {
  try {
    const donor = await donorService.updateDonor({
      foundationId: req.user.foundationId,
      donorId: req.params.id,
      donorData: req.body,
    });
    res.json(donor);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export async function removeDonor(req, res) {
  try {
    await donorService.deleteDonor({
      foundationId: req.user.foundationId,
      donorId: req.params.id,
    });
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export async function isExistByPan(req, res) {
  try {
    const { pan } = req.query;

    // Log for debugging
    console.log("Received PAN:", pan);

    if (!pan || pan.trim() === "") {
      console.log("PAN is missing or empty");
      return res.status(400).json({ message: "PAN is required" });
    }

    const donor = await donorService.isExistByPan(req.user.foundationId, pan);

    if (!donor) {
      console.log("Donor not found for PAN:", pan);
      return res.status(404).json({ message: "Donor not found" });
    }

    return res.status(200).json({
      exists: true,
      donor: {
        id: donor.id,
        fullName: donor.fullName,
        pan: donor.pan,
      },
    });
  } catch (err) {
    console.error("Error in isExistByPan:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function fetchDonationByPan(req, res) {
  try {
    const { pan } = req.query;

    if (!pan || pan.trim() === "") {
      return res.status(400).json({ message: "PAN is required" });
    }

    const donor = await donorService.isExistByPan(req.user.foundationId, pan);

    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }

    const donations = await donorService.getDonationsByDonorId(
      req.user.foundationId,
      donor.id
    );

    if (!donations || donations.length === 0) {
      return res
        .status(404)
        .json({ message: "No donations found for this donor" });
    }
    return res.status(200).json({
      donor: {
        id: donor.id,
        fullName: donor.fullName,
        pan: donor.pan,
      },
      donations,
    });
  } catch (err) {
    console.error("Error in isExistByPan:", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listTrashedDonors(req, res) {
  try {
    const trashed = await donorService.getTrashedDonors(req.user.foundationId);
    res.json(trashed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function restoreDonor(req, res) {
  try {
    const donor = await donorService.restoreDonor({
      foundationId: req.user.foundationId,
      donorId: req.params.id,
    });
    res.json(donor);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export async function countDonors(req, res) {
  try {
    const total = await donorService.countDonors(req.user.foundationId);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
