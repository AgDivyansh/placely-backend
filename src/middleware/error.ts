import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

/**
 * notFound — for any route that didn't match. Feeds into the error handler.
 */
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * errorHandler — the single place every error funnels through.
 *
 * It normalizes several common error types into clean HTTP responses:
 *  - AppError → its own status + message
 *  - Mongoose duplicate key (E11000) → 409 with a friendly message
 *  - Mongoose validation/cast errors → 400
 *  - anything else → 500 (and we log the stack, since it's unexpected)
 *
 * The response shape mirrors the success shape: { success:false, message }.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Our own operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Mongo duplicate key
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `That ${field} is already in use`,
    });
  }

  // Mongoose validation error
  if (err?.name === "ValidationError") {
    const message = Object.values(err.errors || {})
      .map((e: any) => e.message)
      .join("; ");
    return res.status(400).json({ success: false, message: message || "Validation failed" });
  }

  // Bad ObjectId etc.
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  }

  // Unexpected — log loudly, don't leak internals to the client.
  console.error("💥 Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: env.isProd ? "Something went wrong" : err.message || "Internal server error",
  });
}
