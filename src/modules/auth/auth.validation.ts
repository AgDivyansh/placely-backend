import { z } from "zod";

/**
 * Zod schemas define the exact shape each auth endpoint accepts. The
 * validate() middleware enforces them before the controller runs.
 */

export const signupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  // Permanent personal email — the primary, non-expiring login identifier.
  email: z.string().email("Invalid email"),
  // College-issued email — optional; becomes a read-only badge after graduation.
  collegeEmail: z.string().email("Invalid college email").optional(),
  phone: z.string().min(8, "Invalid phone").optional(),
  collegeRollId: z.string().min(1).optional(),
  // Drives computed alumni status (see utils/alumni). Optional at signup.
  graduationYear: z.number().int().min(2000).max(2100).optional(),
  branch: z.enum(["CSE", "ECE", "EEE", "ME", "CE", "IT", "AIDS", "AIML"]).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // For the demo, students self-select a college slug. In production a
  // student would sign up via their college's subdomain/invite.
  collegeSlug: z.string().min(1).optional(),
});

/**
 * Login accepts a single `identifier` (email, phone, or college ID) plus
 * its type, so students can sign in with any of the three. Admins send
 * email as the identifier.
 */
export const loginSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  identifierType: z.enum(["email", "phone", "collegeId"]).default("email"),
  password: z.string().min(1, "Password is required"),
  requestedRole: z.enum(["student", "admin"]).default("student"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
