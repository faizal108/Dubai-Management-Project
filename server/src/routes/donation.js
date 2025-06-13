import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

import {
  listDonations,
  createDonation,
  getDonation,
  updateDonation,
  removeDonation,
  searchDonations,
  countDonations,
  listTrashedDonations,
  restoreDonation,
  markPrintedDonation,
} from "../controllers/donationController.js";

const router = Router();
router.use(authenticate);

// Basic CRUD + pagination
router.get("/", authorize(["admin", "user"]), listDonations);
router.post("/", authorize(["admin", "user"]), createDonation);
router.get("/:id", authorize(["admin", "user"]), getDonation);
router.put("/:id", authorize(["admin", "user"]), updateDonation);
router.delete("/:id", authorize(["admin"]), removeDonation);

// Search
router.get("/search", authorize(["admin", "user"]), searchDonations);
router.put(
  "/:id/markPrinted",
  authorize(["admin", "user"]),
  markPrintedDonation
);

// Utility endpoints
router.get("/count", authorize(["admin", "user"]), countDonations);
router.get("/trashed", authorize(["admin"]), listTrashedDonations);
router.post("/:id/restore", authorize(["admin"]), restoreDonation);

export default router;
