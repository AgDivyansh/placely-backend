import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AuthPayload } from "../types";

/**
 * JWT helpers.
 *
 * We sign a minimal payload (id, role, collegeId) — just enough to
 * authorize requests without a DB lookup on every call. collegeId is
 * included so multi-tenant scoping is available straight from the token.
 *
 * Security notes:
 *  - The secret comes from env (never hardcoded).
 *  - Tokens expire (default 7d) so a leaked token isn't valid forever.
 */
export function signToken(payload: AuthPayload): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): AuthPayload {
  // Throws if invalid/expired — caller (auth middleware) handles it.
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}
