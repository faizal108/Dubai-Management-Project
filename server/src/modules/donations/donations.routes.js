import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createDonationSchema,
  updateDonationSchema,
  donationIdParamSchema,
  listDonationsQuerySchema,
} from "./donations.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  markReceivedHandler,
  markPrintedHandler,
  deleteHandler,
  restoreHandler,
  resendWhatsappHandler,
} from "./donations.controller.js";

const router = Router();

// EMPLOYEE is admitted at the route level; per-mutation permission gates
// downstream enforce the granular capabilities.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get("/", validate({ query: listDonationsQuerySchema }), listHandler);
router.post(
  "/",
  requirePermission(PERMISSIONS.DONATION_CREATE),
  validate({ body: createDonationSchema }),
  createHandler
);
router.get("/:id", validate({ params: donationIdParamSchema }), getHandler);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.DONATION_UPDATE),
  validate({ params: donationIdParamSchema, body: updateDonationSchema }),
  updateHandler
);
router.post(
  "/:id/mark-received",
  requirePermission(PERMISSIONS.DONATION_MARK_RECEIVED),
  validate({ params: donationIdParamSchema }),
  markReceivedHandler
);
router.post(
  "/:id/mark-printed",
  requirePermission(PERMISSIONS.DONATION_MARK_PRINTED),
  validate({ params: donationIdParamSchema }),
  markPrintedHandler
);
// Manual WhatsApp receipt re-trigger. Reuses DONATION_UPDATE so any operator
// allowed to edit the donation can also resend its receipt.
router.post(
  "/:id/whatsapp/resend",
  requirePermission(PERMISSIONS.DONATION_UPDATE),
  validate({ params: donationIdParamSchema }),
  resendWhatsappHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DONATION_DELETE),
  validate({ params: donationIdParamSchema }),
  deleteHandler
);
// Restore stays admin-only     it's a recovery operation.
router.post(
  "/:id/restore",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: donationIdParamSchema }),
  restoreHandler
);

export default router;
