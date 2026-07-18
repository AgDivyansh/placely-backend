import { Router, Response } from "express";
import { z } from "zod";
import { asyncHandler, ok, created } from "../../utils/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AuthRequest } from "../../types";
import { Company } from "../../models/Company";
import { Alumni } from "../../models/Alumni";
import { Job } from "../../models/Job";
import { NotFound } from "../../utils/AppError";

/* ---------------- Companies ---------------- */
const companiesRouter = Router();

companiesRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companies = await Company.find({ collegeId: req.user!.collegeId }).lean();
    return ok(res, { companies });
  })
);

companiesRouter.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate(
    z.object({
      name: z.string().trim().min(1),
      industry: z.string().trim().min(1),
      initial: z.string().trim().max(3).optional(),
      color: z.string().trim().optional(),
      avgPackage: z.number().min(0).optional(),
      difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const company = await Company.create({
      ...req.body,
      // Derive a one-letter badge from the name when not supplied.
      initial: req.body.initial || req.body.name.charAt(0).toUpperCase(),
      collegeId: req.user!.collegeId,
    });
    return created(res, { company }, "Company created");
  })
);

companiesRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const company = await Company.findOne({
      _id: req.params.id,
      collegeId: req.user!.collegeId,
    }).lean();
    if (!company) throw NotFound("Company not found");
    // Include the company's active jobs.
    const jobs = await Job.find({ companyId: company._id, isActive: true }).lean();
    return ok(res, { company, jobs });
  })
);

/* ---------------- Alumni ---------------- */
const alumniRouter = Router();

alumniRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const alumni = await Alumni.find({ collegeId: req.user!.collegeId }).lean();
    return ok(res, { alumni });
  })
);

alumniRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const alum = await Alumni.findOne({
      _id: req.params.id,
      collegeId: req.user!.collegeId,
    }).lean();
    if (!alum) throw NotFound("Alumni not found");
    return ok(res, { alumni: alum });
  })
);

export { companiesRouter, alumniRouter };
