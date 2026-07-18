import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { Unauthorized, Forbidden } from "../utils/AppError";
import { isAlumni } from "../utils/alumni";
import { AuthRequest, Role } from "../types";

/**
 * authenticate — verifies the Bearer token and attaches req.user.
 *
 * Why token-only (no DB hit): the JWT already carries id, role, and
 * collegeId. Skipping a DB lookup on every request keeps auth fast.
 * (If we ever need to invalidate tokens server-side, we'd add a lookup
 * or a token blocklist — noted for later.)
 */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw Unauthorized("Missing or malformed Authorization header");
  }
  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw Unauthorized("Invalid or expired token");
  }
}

/**
 * requireRole — guards a route to specific role(s). Use after authenticate.
 * Example: router.post("/jobs", authenticate, requireRole("admin"), ...)
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw Unauthorized();
    if (!roles.includes(req.user.role)) {
      throw Forbidden("You don't have permission to perform this action");
    }
    next();
  };
}

/**
 * requireAlumniOrAdmin — guards actions open to admins and alumni (e.g.
 * posting to the feed). Alumni status is computed from the token's
 * graduationYear, so no stored role or DB lookup is needed.
 */
export function requireAlumniOrAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) throw Unauthorized();
  if (req.user.role === "admin") return next();
  if (isAlumni(req.user.graduationYear)) return next();
  throw Forbidden("Only alumni or admins can perform this action");
}
