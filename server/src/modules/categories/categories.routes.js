import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  listCategoriesQuerySchema,
} from "./categories.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./categories.controller.js";

const router = Router();

// Reads are open to any authenticated tenant user — categories populate the
// dropdowns on the donation / expense / other-income forms. Writes require the
// unified CATEGORY_MANAGE permission. ADMIN/SUPERADMIN bypass.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get("/", validate({ query: listCategoriesQuerySchema }), listHandler);
router.post(
  "/",
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validate({ body: createCategorySchema }),
  createHandler
);
router.get("/:id", validate({ params: categoryIdParamSchema }), getHandler);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validate({ params: categoryIdParamSchema, body: updateCategorySchema }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validate({ params: categoryIdParamSchema }),
  deleteHandler
);
router.post(
  "/:id/restore",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: categoryIdParamSchema }),
  restoreHandler
);

export default router;
