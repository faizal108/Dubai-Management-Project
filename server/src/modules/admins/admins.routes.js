import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createAdminSchema,
  updateAdminSchema,
  adminIdParamSchema,
  listAdminsQuerySchema,
} from "./admins.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./admins.controller.js";

const router = Router();

// SUPERADMIN-only: managing Foundation admins is a privileged operation.
router.use(authenticate, authorize("SUPERADMIN"));

router.get("/", validate({ query: listAdminsQuerySchema }), listHandler);
router.post("/", validate({ body: createAdminSchema }), createHandler);
router.get("/:id", validate({ params: adminIdParamSchema }), getHandler);
router.patch(
  "/:id",
  validate({ params: adminIdParamSchema, body: updateAdminSchema }),
  updateHandler
);
router.delete(
  "/:id",
  validate({ params: adminIdParamSchema }),
  deleteHandler
);
router.post(
  "/:id/restore",
  validate({ params: adminIdParamSchema }),
  restoreHandler
);

export default router;
