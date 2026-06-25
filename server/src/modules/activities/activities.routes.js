import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  createActivitySchema,
  updateActivitySchema,
  activityIdParamSchema,
  listActivitiesQuerySchema,
} from "./activities.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./activities.controller.js";

const router = Router();

// Activities are managed by foundation staff. EMPLOYEE may read at the route
// level; per-mutation permission gates downstream enforce write caps.
router.use(authenticate, authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"));

router.get("/", validate({ query: listActivitiesQuerySchema }), listHandler);
router.post(
  "/",
  requirePermission(PERMISSIONS.ACTIVITY_CREATE),
  validate({ body: createActivitySchema }),
  createHandler
);
router.get("/:id", validate({ params: activityIdParamSchema }), getHandler);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.ACTIVITY_UPDATE),
  validate({ params: activityIdParamSchema, body: updateActivitySchema }),
  updateHandler
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.ACTIVITY_DELETE),
  validate({ params: activityIdParamSchema }),
  deleteHandler
);
// Restore stays admin-only — recovery operation.
router.post(
  "/:id/restore",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ params: activityIdParamSchema }),
  restoreHandler
);

export default router;
