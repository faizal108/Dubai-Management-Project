// server/src/routes/donor.js
import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import {
  createDonor,
  listDonors,
  getDonor,
  updateDonor,
  removeDonor,
  isExistByPan,
  fetchDonationByPan,
} from '../controllers/donorController.js';

const router = Router();

// All donor routes require a valid JWT:
router.use(authenticate);

// → check donor exist by pan (all roles)
router.get('/existByPan', authorize(['admin', 'user']), isExistByPan);

router.get('/fetchDonationByPan', authorize(['admin', 'user']), fetchDonationByPan);

// GET    /api/donors       → listDonors (all roles)
router.get('/', authorize(['admin', 'user']), listDonors);

// POST   /api/donors       → createDonor (admin, staff)
router.post('/', authorize(['admin', 'user']), createDonor);

// GET    /api/donors/:id   → getDonor (all roles)
router.get('/:id', authorize(['admin', 'user']), getDonor);

// PUT    /api/donors/:id   → updateDonor (admin, staff)
router.put('/:id', authorize(['admin', 'user']), updateDonor);

// DELETE /api/donors/:id   → removeDonor (admin only)
router.delete('/:id', authorize(['admin']), removeDonor);



export default router;
