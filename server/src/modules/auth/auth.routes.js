import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import {
  loginSchema,
  customerSignupSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "./auth.schema.js";
import {
  loginHandler,
  signupCustomerHandler,
  meHandler,
  updateProfileHandler,
  changePasswordHandler,
} from "./auth.controller.js";

const router = Router();

// Tighter limit on auth endpoints to slow brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Password change is also brute-forceable (currentPassword verification),
// so it gets the same rate-limit bucket as login/signup.
router.post("/login", authLimiter, validate({ body: loginSchema }), loginHandler);
router.post(
  "/signup",
  authLimiter,
  validate({ body: customerSignupSchema }),
  signupCustomerHandler
);
router.get("/me", authenticate, meHandler);
router.patch(
  "/profile",
  authenticate,
  validate({ body: updateProfileSchema }),
  updateProfileHandler
);
router.post(
  "/change-password",
  authLimiter,
  authenticate,
  validate({ body: changePasswordSchema }),
  changePasswordHandler
);

export default router;
