import { Request, Response } from "express";
import { authService } from "./auth.service";
import { asyncHandler, ok, created } from "../../utils/http";
import { AuthRequest } from "../../types";

/**
 * Controllers are thin: parse the (already-validated) request, call the
 * service, send the response. No business logic here.
 */
export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.signup(req.body);
    return created(res, result, "Account created");
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    return ok(res, result, "Logged in");
  }),

  me: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await authService.me(req.user!.id);
    return ok(res, result);
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    return ok(res, result, "If that email exists, a code has been sent");
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body.email, req.body.otp, req.body.password);
    return ok(res, result, "Password reset");
  }),
};
