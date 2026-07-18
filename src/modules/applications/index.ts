import { Router, Response } from "express";
import { z } from "zod";
import { applicationsService } from "./applications.service";
import { asyncHandler, ok, created } from "../../utils/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { logActivity } from "../../utils/logActivity";
import { AuthRequest } from "../../types";

/**
 * Two routers exported here:
 *  - applicationsRouter → student-facing ("/applications")
 *  - applicantsRouter   → admin-facing ("/applicants" and job drill-down)
 */

/* ---------------- STUDENT: /applications ---------------- */
const applicationsRouter = Router();

applicationsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const applications = await applicationsService.listMine(req.user!);
    return ok(res, { applications });
  })
);

applicationsRouter.post(
  "/",
  authenticate,
  requireRole("student"),
  validate(z.object({ jobId: z.string().min(1), resumeId: z.string().optional() })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const application = await applicationsService.apply(req.user!, req.body.jobId, req.body.resumeId);
    return created(res, { application }, "Application submitted");
  })
);

applicationsRouter.delete(
  "/:id",
  authenticate,
  requireRole("student"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await applicationsService.withdraw(req.user!, req.params.id);
    return ok(res, { ok: true }, "Application withdrawn");
  })
);

/* ---------------- ADMIN: /applicants ---------------- */
const applicantsRouter = Router();

// Applicants for a job (drill-down)
applicantsRouter.get(
  "/job/:jobId",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await applicationsService.byJob(req.user!, req.params.jobId);
    return ok(res, data);
  })
);

// Bulk stage update for one job from parsed CSV rows [{ rollId, stage }].
applicantsRouter.post(
  "/import-status",
  authenticate,
  requireRole("admin"),
  validate(
    z.object({
      jobId: z.string().min(1),
      rows: z
        .array(z.object({ rollId: z.string().trim().min(1), stage: z.string().trim().min(1) }))
        .min(1)
        .max(1000),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await applicationsService.importStatus(req.user!, req.body.jobId, req.body.rows);
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: "Admin",
      action: `Bulk stage import: ${result.updated} updated`,
      target: req.body.jobId,
      kind: "stage",
    });
    return ok(res, result, `Updated ${result.updated} applicant${result.updated === 1 ? "" : "s"}`);
  })
);

// Applicants across all of a company's jobs (per-company drill-down)
applicantsRouter.get(
  "/company/:companyId",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await applicationsService.byCompany(req.user!, req.params.companyId);
    return ok(res, data);
  })
);

// Update one applicant's stage
applicantsRouter.patch(
  "/:id/stage",
  authenticate,
  requireRole("admin"),
  validate(z.object({ stage: z.string() })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const app = await applicationsService.updateStage(req.user!, req.params.id, req.body.stage);
    return ok(res, { application: app }, "Stage updated");
  })
);

// Revoke one applicant (frontend gates with 2FA)
applicantsRouter.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await applicationsService.revoke(req.user!, req.params.id);
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: "Admin",
      action: "Revoked application",
      target: req.params.id,
      kind: "stage",
    });
    return ok(res, { ok: true }, "Application revoked");
  })
);

// Bulk advance
applicantsRouter.patch(
  "/bulk-advance",
  authenticate,
  requireRole("admin"),
  validate(z.object({ ids: z.array(z.string()).min(1) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await applicationsService.bulkAdvance(req.user!, req.body.ids);
    return ok(res, result, `Advanced ${result.updated} applicants`);
  })
);

// Bulk revoke
applicantsRouter.post(
  "/bulk-revoke",
  authenticate,
  requireRole("admin"),
  validate(z.object({ ids: z.array(z.string()).min(1) })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await applicationsService.bulkRevoke(req.user!, req.body.ids);
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: "Admin",
      action: `Revoked ${result.removed} applications`,
      target: "bulk",
      kind: "stage",
    });
    return ok(res, result, `Revoked ${result.removed} applications`);
  })
);

export { applicationsRouter, applicantsRouter };
