import { Router, Response } from "express";
import { z } from "zod";
import { jobsService } from "./jobs.service";
import { asyncHandler, ok, created } from "../../utils/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { logActivity } from "../../utils/logActivity";
import { AuthRequest } from "../../types";
import { Company } from "../../models/Company";

/* ---------------- validation ---------------- */
const eligibilitySchema = z.object({
  minCgpa: z.number().min(0).max(10).default(0),
  minTenth: z.number().min(0).max(100).default(0),
  minTwelfth: z.number().min(0).max(100).default(0),
  branches: z.array(z.string()).default([]),
  maxBacklogs: z.number().min(0).default(99),
});

const createJobSchema = z.object({
  companyId: z.string().min(1),
  role: z.string().min(1),
  package: z.number().min(0),
  location: z.string().default("Remote"),
  type: z.string().default("Full-time"),
  description: z.string().default(""),
  rounds: z.array(z.string()).default([]),
  eligibility: eligibilitySchema,
  deadline: z.string().or(z.date()),
});

/* ---------------- routes ---------------- */
const router = Router();

// List jobs (students: eligibility-aware; admins: with counts)
router.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const jobs = await jobsService.list(req.user!);
    return ok(res, { jobs });
  })
);

// Job detail
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await jobsService.detail(req.user!, req.params.id);
    return ok(res, { job });
  })
);

// Create job (admin)
router.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate(createJobSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await jobsService.create(req.user!, req.body);
    const company = await Company.findById(job.companyId).lean();
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: "Admin",
      action: "Created job posting",
      target: `${job.role} at ${company?.name || ""}`,
      kind: "job",
    });
    return created(res, { job }, "Job published");
  })
);

// Update job (admin)
router.patch(
  "/:id",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await jobsService.update(req.user!, req.params.id, req.body);
    return ok(res, { job }, "Job updated");
  })
);

// Delete job (admin) — the frontend gates this behind 2-step verification
router.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await jobsService.remove(req.user!, req.params.id);
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: "Admin",
      action: "Deleted job posting",
      target: req.params.id,
      kind: "job",
    });
    return ok(res, { ok: true }, "Job removed");
  })
);

export default router;
