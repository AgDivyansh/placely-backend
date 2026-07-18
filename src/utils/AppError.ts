/**
 * AppError — a custom error carrying an HTTP status code.
 *
 * Why: throwing plain Errors loses the intended HTTP status. With AppError,
 * a service can `throw new AppError("Job not found", 404)` and the central
 * error handler knows exactly what to send. `isOperational` marks expected
 * errors (bad input, not found) vs unexpected bugs — we log the latter loudly.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience factories for the common cases — keeps call sites terse.
export const BadRequest = (msg = "Bad request") => new AppError(msg, 400);
export const Unauthorized = (msg = "Unauthorized") => new AppError(msg, 401);
export const Forbidden = (msg = "Forbidden") => new AppError(msg, 403);
export const NotFound = (msg = "Not found") => new AppError(msg, 404);
export const Conflict = (msg = "Conflict") => new AppError(msg, 409);
