import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { BadRequest } from "../utils/AppError";

/**
 * validate — runs a Zod schema against req.body and replaces it with the
 * parsed (typed, coerced) result. Guarantees controllers receive clean,
 * validated data — the "never trust the client" rule enforced in one place.
 *
 * On failure, returns a 400 with a readable list of what's wrong.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw BadRequest(message);
    }
    req.body = result.data;
    next();
  };
}
