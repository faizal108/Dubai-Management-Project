import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

import {
  createDonor,
  listDonors,
  getDonor,
  updateDonor,
  removeDonor,
  isExistByPan,
  fetchDonationByPan,
  listTrashedDonors,
  restoreDonor,
} from "../controllers/donorController.js";

const router = Router();
router.use(authenticate);

// Existence check by PAN
router.get(
  "/existByPan",
  authorize(["admin", "user"]),
  isExistByPan
);

router.get(
  "/fetchDonationByPan",
  authorize(["admin", "user"]),
  fetchDonationByPan
);

// List + Pagination
router.get(
  "/",
  authorize(["admin", "user"]),
  listDonors
);

// Create
router.post(
  "/",
  authorize(["admin", "user"]),
  createDonor
);

// Read single
router.get("/:id", authorize(["admin", "user"]), getDonor);

// Update
router.put(
  "/:id",
  authorize(["admin", "user"]),
  updateDonor
);

// Soft Delete
router.delete("/:id", authorize(["admin"]), removeDonor);

// Trashed & Restore
router.get("/trashed", authorize(["admin"]), listTrashedDonors);
router.post("/:id/restore", authorize(["admin"]), restoreDonor);

export default router;
