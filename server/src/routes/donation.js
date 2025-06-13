// server/src/routes/donation.js
import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import {
  createDonation,
  listDonations,
  getDonation,
  updateDonation,
  removeDonation,
  searchDonations,
} from '../controllers/donationController.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['admin', 'user']), listDonations);
router.post('/', authorize(['admin', 'user']), createDonation);
router.get('/:id', authorize(['admin', 'user']), getDonation);
router.put('/:id', authorize(['admin', 'user']), updateDonation);
router.delete('/:id', authorize(['admin']), removeDonation);
router.get('/search', authorize(['admin', 'user']),searchDonations);

export default router;
