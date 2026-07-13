import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createFinancialYearSchema,
  updateFinancialYearSchema,
  financialYearIdParamSchema,
  listFinancialYearsQuerySchema,
} from "./financialYears.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  closeHandler,
  reopenHandler,
} from "./financialYears.controller.js";

const router = Router();

// Reads are open to any authenticated tenant user     dashboards, transaction
// forms, and reports all need to know which FY they're operating in. Writes
// (create/edit/close/reopen/delete) gate on FINANCIAL_YEAR_MANAGE, which
// ADMIN/SUPERADMIN bypass automatically.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get(
  "/",
  validate({ query: listFinancialYearsQuerySchema }),
  listHandler
);
router.post(
  "/",
  requirePermission(PERMISSIONS.FINANCIAL_YEAR_MANAGE),
  validate({ body: createFinancialYearSchema }),
  createHandler
);
router.get(
  "/:id",
  validate({ params: financialYearIdParamSchema }),
  getHandler
);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.FINANCIAL_YEAR_MANAGE),
  validate({
    params: financialYearIdParamSchema,
    body: updateFinancialYearSchema,
  }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.FINANCIAL_YEAR_MANAGE),
  validate({ params: financialYearIdParamSchema }),
  deleteHandler
);

// Close is a terminal-ish transition (reopen exists but is meant to be rare);
// reopen is intentionally restricted to ADMIN/SUPERADMIN so an EMPLOYEE with
// FINANCIAL_YEAR_MANAGE cannot undo a statutory closure on their own.
router.post(
  "/:id/close",
  requirePermission(PERMISSIONS.FINANCIAL_YEAR_MANAGE),
  validate({ params: financialYearIdParamSchema }),
  closeHandler
);
router.post(
  "/:id/reopen",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: financialYearIdParamSchema }),
  reopenHandler
);

export default router;
