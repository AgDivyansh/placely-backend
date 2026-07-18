import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import {
  signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
} from "./auth.validation";

const router = Router();

router.post("/signup", validate(signupSchema), authController.signup);
router.post("/login", validate(loginSchema), authController.login);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);

// Protected — returns the current user from the token.
router.get("/me", authenticate, authController.me);

export default router;
