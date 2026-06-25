import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
} from "./employees.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
} from "./employees.controller.js";

const router = Router();

// Employees are managed by foundation admins (and platform SUPERADMINs).
router.use(authenticate, authorize("ADMIN", "SUPERADMIN"));

router.get("/", validate({ query: listEmployeesQuerySchema }), listHandler);
router.post("/", validate({ body: createEmployeeSchema }), createHandler);
router.get("/:id", validate({ params: employeeIdParamSchema }), getHandler);
router.patch(
  "/:id",
  validate({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  updateHandler
);
router.delete(
  "/:id",
  validate({ params: employeeIdParamSchema }),
  deleteHandler
);
router.post(
  "/:id/restore",
  validate({ params: employeeIdParamSchema }),
  restoreHandler
);

export default router;
