import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  summaryQuerySchema,
  trendsQuerySchema,
  topDonorsQuerySchema,
  recentDonationsQuerySchema,
  pendingDonationsQuerySchema,
} from "./stats.schema.js";
import {
  summaryHandler,
  trendsHandler,
  topDonorsHandler,
  recentDonationsHandler,
  pendingDonationsHandler,
} from "./stats.controller.js";

const router = Router();

// EMPLOYEE may access stats only when granted dashboard:view. ADMIN/SUPERADMIN
// auto-pass via the permission helper.
router.use(
  authenticate,
  authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"),
  requirePermission(PERMISSIONS.DASHBOARD_VIEW)
);

router.get("/summary", validate({ query: summaryQuerySchema }), summaryHandler);
router.get("/trends", validate({ query: trendsQuerySchema }), trendsHandler);
router.get(
  "/top-donors",
  validate({ query: topDonorsQuerySchema }),
  topDonorsHandler
);
router.get(
  "/recent-donations",
  validate({ query: recentDonationsQuerySchema }),
  recentDonationsHandler
);
router.get(
  "/pending-donations",
  validate({ query: pendingDonationsQuerySchema }),
  pendingDonationsHandler
);

export default router;
