import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  expenseCategoryIdParamSchema,
  listExpenseCategoriesQuerySchema,
} from "./expenseCategories.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./expenseCategories.controller.js";

const router = Router();

// Reads are open to any authenticated tenant user     categories populate the
// dropdown on the expense form, which EMPLOYEE users need. Writes require the
// umbrella EXPENSE_CATEGORY_MANAGE permission.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get(
  "/",
  validate({ query: listExpenseCategoriesQuerySchema }),
  listHandler
);
router.post(
  "/",
  requirePermission(PERMISSIONS.EXPENSE_CATEGORY_MANAGE),
  validate({ body: createExpenseCategorySchema }),
  createHandler
);
router.get(
  "/:id",
  validate({ params: expenseCategoryIdParamSchema }),
  getHandler
);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.EXPENSE_CATEGORY_MANAGE),
  validate({
    params: expenseCategoryIdParamSchema,
    body: updateExpenseCategorySchema,
  }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.EXPENSE_CATEGORY_MANAGE),
  validate({ params: expenseCategoryIdParamSchema }),
  deleteHandler
);
// Restore stays admin-only     recovery operation matching activities/donations.
router.post(
  "/:id/restore",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: expenseCategoryIdParamSchema }),
  restoreHandler
);

export default router;
