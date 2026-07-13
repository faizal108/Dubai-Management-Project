import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import { listTransactionsQuerySchema } from "./transactions.schema.js";
import { listHandler } from "./transactions.controller.js";

const router = Router();

// Ledger is read-only over HTTP     every row is written by the donation /
// expense services as part of their $transaction. Viewing the ledger uses
// the same BANK_ACCOUNT_VIEW permission as the account list so the two
// screens stay authorized in lockstep.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get(
  "/",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_VIEW),
  validate({ query: listTransactionsQuerySchema }),
  listHandler
);

export default router;
