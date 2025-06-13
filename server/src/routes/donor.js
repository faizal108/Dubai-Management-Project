import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createDonorSchema,
  updateDonorSchema,
  paginationSchema,
  panQuerySchema,
} from "../schemas/donorSchemas.js";
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
  validate(panQuerySchema, "query"),
  isExistByPan
);

router.get(
  "/fetchDonationByPan",
  authorize(["admin", "user"]),
  validate(panQuerySchema, "query"),
  fetchDonationByPan
);

// List + Pagination
router.get(
  "/",
  authorize(["admin", "user"]),
  validate(paginationSchema, "query"),
  listDonors
);

// Create
router.post(
  "/",
  authorize(["admin", "user"]),
  validate(createDonorSchema, "body"),
  createDonor
);

// Read single
router.get("/:id", authorize(["admin", "user"]), getDonor);

// Update
router.put(
  "/:id",
  authorize(["admin", "user"]),
  validate(updateDonorSchema, "body"),
  updateDonor
);

// Soft Delete
router.delete("/:id", authorize(["admin"]), removeDonor);

// Trashed & Restore
router.get("/trashed", authorize(["admin"]), listTrashedDonors);
router.post("/:id/restore", authorize(["admin"]), restoreDonor);

export default router;
