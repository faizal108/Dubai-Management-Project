import { Router } from "express";
import { register, login } from "../controllers/authController.js";
import authorize from "../middleware/authorize.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

// ─── Public ────────────────────────────────────────────────────────────────
router.post("/login", login);

// ─── Protected ─────────────────────────────────────────────────────────────
router.post(
  "/register",
  authenticate,
  authorize(["admin"]),     
  register                  
);

export default router;
