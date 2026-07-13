import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { listAuditsQuerySchema } from "./audits.schema.js";
import { listHandler } from "./audits.controller.js";

const router = Router();

// Audit log is a platform-wide compliance surface     SUPERADMIN only.
router.use(authenticate, authorize("SUPERADMIN"));

router.get("/", validate({ query: listAuditsQuerySchema }), listHandler);

export default router;
