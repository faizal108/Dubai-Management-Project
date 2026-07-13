import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createFoundationSchema,
  updateFoundationSchema,
  updateMyFoundationSchema,
  foundationIdParamSchema,
  listFoundationsQuerySchema,
} from "./foundations.schema.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  restoreHandler,
  getMyHandler,
  updateMyHandler,
} from "./foundations.controller.js";

const router = Router();

// All foundation endpoints require authentication. Per-route role gating below.
router.use(authenticate);

// Self-serve endpoints     let any user bound to a foundation read its
// settings (cash limit, WhatsApp toggle, etc.) so donation entry can render
// foundation-driven UI (cash chips, receipt config). Mutations stay
// ADMIN/SUPERADMIN. Declared before the SUPERADMIN guard so the rest of the
// surface stays locked.
router.get("/me", authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"), getMyHandler);
router.patch(
  "/me",
  authorize("ADMIN", "SUPERADMIN"),
  validate({ body: updateMyFoundationSchema }),
  updateMyHandler
);

// Foundation administration is otherwise a SUPERADMIN-only surface.
router.use(authorize("SUPERADMIN"));

router.get("/", validate({ query: listFoundationsQuerySchema }), listHandler);
router.post("/", validate({ body: createFoundationSchema }), createHandler);
router.get(
  "/:id",
  validate({ params: foundationIdParamSchema }),
  getHandler
);
router.patch(
  "/:id",
  validate({ params: foundationIdParamSchema, body: updateFoundationSchema }),
  updateHandler
);
router.delete(
  "/:id",
  validate({ params: foundationIdParamSchema }),
  deleteHandler
);
router.post(
  "/:id/restore",
  validate({ params: foundationIdParamSchema }),
  restoreHandler
);

export default router;
