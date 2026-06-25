import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createDonorSchema,
  updateDonorSchema,
  donorIdParamSchema,
  listDonorsQuerySchema,
} from "./donors.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./donors.controller.js";

const router = Router();

// Donors are managed by foundation staff. EMPLOYEE is admitted at the route
// level; per-mutation permission gates downstream enforce the granular caps.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get("/", validate({ query: listDonorsQuerySchema }), listHandler);
router.post(
  "/",
  requirePermission(PERMISSIONS.DONOR_CREATE),
  validate({ body: createDonorSchema }),
  createHandler
);
router.get("/:id", validate({ params: donorIdParamSchema }), getHandler);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.DONOR_UPDATE),
  validate({ params: donorIdParamSchema, body: updateDonorSchema }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DONOR_DELETE),
  validate({ params: donorIdParamSchema }),
  deleteHandler
);
// Restore stays admin-only — recovery operation.
router.post(
  "/:id/restore",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: donorIdParamSchema }),
  restoreHandler
);

export default router;
