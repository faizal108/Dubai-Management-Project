import { Router } from "express";
import { register, login } from "../controllers/authController.js";
import authorize from "../middleware/authorize.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);

router.post("/register", authorize(["admin"]), register);
router.post("/login", login);

export default router;
