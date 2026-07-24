import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createOtherIncomeSchema,
  updateOtherIncomeSchema,
  otherIncomeIdParamSchema,
  listOtherIncomeQuerySchema,
} from "./otherIncome.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./otherIncome.controller.js";

const router = Router();

router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get("/", validate({ query: listOtherIncomeQuerySchema }), listHandler);
router.post(
  "/",
  requirePermission(PERMISSIONS.OTHER_INCOME_CREATE),
  validate({ body: createOtherIncomeSchema }),
  createHandler
);
router.get("/:id", validate({ params: otherIncomeIdParamSchema }), getHandler);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.OTHER_INCOME_UPDATE),
  validate({ params: otherIncomeIdParamSchema, body: updateOtherIncomeSchema }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.OTHER_INCOME_DELETE),
  validate({ params: otherIncomeIdParamSchema }),
  deleteHandler
);
router.post(
  "/:id/restore",
  requirePermission(PERMISSIONS.OTHER_INCOME_DELETE),
  validate({ params: otherIncomeIdParamSchema }),
  restoreHandler
);

export default router;
