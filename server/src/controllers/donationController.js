// server/src/controllers/donationController.js
import * as donationService from '../services/donationService.js';

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

    // if (
    //   !donorId ||
    //   !type ||
    //   !bankName ||
    //   !utr ||
    //   !ifsc ||
    //   !donationDate ||
    //   amount == null
    // ) {
    //   return res.status(400).json({ message: 'Missing required fields' });
    // }

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
        donationReceived: 'PENDING',
      },
    });

    res.status(201).json(donation);
  } catch (err) {
    console.error('Create Donation Error:', err);
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
    console.error('Error in listDonations:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getDonation(req, res) {
  try {
    const donation = await donationService.getDonationById({
      foundationId: req.user.foundationId,
      donationId: req.params.id,
    });
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
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
    console.log('Searching donations with params:', req.query);

    const donations = await donationService.searchDonations({
      foundationId: cmb3n2rpe0000do9fkfsy5lw1,
      fullName: req.query.name,
      pan: req.query.pan,
    });

    if (!donations || donations.length === 0) {
      return res.status(404).json({ message: 'No donations found' });
    }

    res.json(donations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
}
