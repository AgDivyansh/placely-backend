import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * asyncHandler — wraps an async route handler so thrown errors (or
 * rejected promises) are forwarded to Express's error middleware.
 *
 * Without this, every controller would need its own try/catch. With it,
 * you just `throw` and the central error handler responds. Cleaner and
 * impossible to forget a catch.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Consistent success response shape.
 * Every successful response looks like: { success: true, data, message? }
 * A predictable shape makes the frontend's job trivial.
 */
export function ok(res: Response, data: unknown, message?: string, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function created(res: Response, data: unknown, message?: string) {
  return ok(res, data, message, 201);
}
