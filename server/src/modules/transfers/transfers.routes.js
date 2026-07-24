import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createTransferSchema,
  transferIdParamSchema,
  listTransfersQuerySchema,
  listFixedDepositsQuerySchema,
} from "./transfers.schema.js";
import {
  listHandler,
  listFixedDepositsHandler,
  createHandler,
  deleteHandler,
} from "./transfers.controller.js";

const router = Router();

// Transfers move money between the foundation's own buckets. Reads reuse
// BANK_ACCOUNT_VIEW (same as the ledger / bank-account screens); writes require
// TRANSFER_MANAGE. ADMIN and SUPERADMIN bypass both via hasPermission.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get(
  "/",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_VIEW),
  validate({ query: listTransfersQuerySchema }),
  listHandler
);
router.get(
  "/fixed-deposits",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_VIEW),
  validate({ query: listFixedDepositsQuerySchema }),
  listFixedDepositsHandler
);
router.post(
  "/",
  requirePermission(PERMISSIONS.TRANSFER_MANAGE),
  validate({ body: createTransferSchema }),
  createHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.TRANSFER_MANAGE),
  validate({ params: transferIdParamSchema }),
  deleteHandler
);

export default router;
