import { Router, Response } from "express";
import { asyncHandler, ok } from "../../utils/http";
import { authenticate } from "../../middleware/auth";
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
