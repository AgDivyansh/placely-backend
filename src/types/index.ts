import { Request } from "express";

/**
 * Shared types used across modules.
 *
 * Keeping these in one place means the frontend and backend can share
 * the same vocabulary (roles, stages, categories) and reduces drift.
 */

export type Role = "student" | "admin";

// Hiring pipeline stages — ORDER MATTERS (used to compute "advance").
export const STAGES = ["applied", "shortlist", "oa", "tech", "hr", "offer"] as const;
export type Stage = (typeof STAGES)[number];

export const BRANCHES = ["CSE", "ECE", "EEE", "ME", "CE", "IT", "AIDS", "AIML"] as const;
export type Branch = (typeof BRANCHES)[number];

export const ANNOUNCEMENT_CATEGORIES = ["general", "drive", "deadline", "event"] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const DOC_STATUSES = ["missing", "uploaded", "verified", "rejected"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/**
 * The authenticated request shape. After the `authenticate` middleware
 * runs, req.user is populated. We extend Express's Request so controllers
 * get full type safety on req.user.
 */
export interface AuthPayload {
  id: string;
  role: Role;
  collegeId: string;
  // Carried so alumni status can be computed from any token without a DB
  // lookup. The raw year (not a boolean) keeps a 7-day token correct across
  // the graduation cutoff. Optional: tokens issued before this field existed
  // simply resolve isAlumni=false until the next login.
  graduationYear?: number;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}
