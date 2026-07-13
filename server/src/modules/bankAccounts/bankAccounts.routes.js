import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountIdParamSchema,
  listBankAccountsQuerySchema,
} from "./bankAccounts.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
} from "./bankAccounts.controller.js";

const router = Router();

// All bank-account routes require an authenticated tenant user. Reads are
// gated on BANK_ACCOUNT_VIEW so an EMPLOYEE without accounting duties
// doesn't see balances; writes require BANK_ACCOUNT_MANAGE. ADMIN and
// SUPERADMIN bypass both via hasPermission.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get(
  "/",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_VIEW),
  validate({ query: listBankAccountsQuerySchema }),
  listHandler
);
router.post(
  "/",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_MANAGE),
  validate({ body: createBankAccountSchema }),
  createHandler
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_VIEW),
  validate({ params: bankAccountIdParamSchema }),
  getHandler
);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_MANAGE),
  validate({
    params: bankAccountIdParamSchema,
    body: updateBankAccountSchema,
  }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.BANK_ACCOUNT_MANAGE),
  validate({ params: bankAccountIdParamSchema }),
  deleteHandler
);

export default router;
