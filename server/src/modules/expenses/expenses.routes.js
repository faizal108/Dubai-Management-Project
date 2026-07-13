import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseIdParamSchema,
  listExpensesQuerySchema,
} from "./expenses.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./expenses.controller.js";

const router = Router();

// EMPLOYEE is admitted at the route level; per-mutation permission gates
// downstream enforce the granular capabilities. Reads are filtered by
// createdById in the service unless the user holds expense:viewAll.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get("/", validate({ query: listExpensesQuerySchema }), listHandler);
router.post(
  "/",
  requirePermission(PERMISSIONS.EXPENSE_CREATE),
  validate({ body: createExpenseSchema }),
  createHandler
);
router.get("/:id", validate({ params: expenseIdParamSchema }), getHandler);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.EXPENSE_UPDATE),
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.EXPENSE_DELETE),
  validate({ params: expenseIdParamSchema }),
  deleteHandler
);
// Restore stays admin-only     recovery operation matching activities/donations.
router.post(
  "/:id/restore",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: expenseIdParamSchema }),
  restoreHandler
);

export default router;
