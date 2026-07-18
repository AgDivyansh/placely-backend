import { Job } from "../../models/Job";
import { Company } from "../../models/Company";
import { User } from "../../models/User";
import { Application } from "../../models/Application";
import { NotFound } from "../../utils/AppError";
import { checkEligibility } from "../../utils/eligibility";
import { AuthPayload } from "../../types";

/**
 * Jobs service.
 *
 * Performance notes:
 *  - list() uses .lean() (returns plain JS objects, not full Mongoose
 *    docs) since we only read — much faster and lighter.
 *  - We batch-fetch the student's applications once and build a Set, so
 *    marking "already applied" is O(1) per job instead of a query each.
 *  - Company data is fetched in one query and mapped, avoiding N populate
 *    calls.
 */
export const jobsService = {
  async list(user: AuthPayload) {
    const collegeId = user.collegeId;

    // One query each — then join in memory (cheaper than per-job populate).
    const [jobs, companies] = await Promise.all([
      Job.find({ collegeId, isActive: true }).sort({ createdAt: -1 }).lean(),
      Company.find({ collegeId }).lean(),
    ]);

    const companyMap = new Map(companies.map((c) => [String(c._id), c]));

    // For students, attach eligibility + applied status.
    if (user.role === "student") {
      const student = await User.findById(user.id).lean();
      const myApps = await Application.find({ studentId: user.id }).select("jobId currentStage").lean();
      const appliedMap = new Map(myApps.map((a) => [String(a.jobId), a.currentStage]));

      return jobs.map((job) => {
        const company = companyMap.get(String(job.companyId));
        const eligibility = student
          ? checkEligibility(student as any, job as any)
          : null;
        return {
          ...job,
          company,
          eligibility,
          appliedStage: appliedMap.get(String(job._id)) || null,
        };
      });
    }

    // Admin view: attach company + applicant counts.
    const counts = await Application.aggregate([
      { $match: { collegeId: (jobs[0] as any)?.collegeId } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return jobs.map((job) => ({
      ...job,
      company: companyMap.get(String(job.companyId)),
      applicantCount: countMap.get(String(job._id)) || 0,
    }));
  },

  async detail(user: AuthPayload, jobId: string) {
    const job = await Job.findOne({ _id: jobId, collegeId: user.collegeId }).lean();
    if (!job) throw NotFound("Job not found");

    const company = await Company.findById(job.companyId).lean();

    let eligibility = null;
    let appliedStage: string | null = null;
    if (user.role === "student") {
      const student = await User.findById(user.id).lean();
      if (student) eligibility = checkEligibility(student as any, job as any);
      const app = await Application.findOne({ jobId, studentId: user.id }).lean();
      appliedStage = app?.currentStage || null;
    }

    return { ...job, company, eligibility, appliedStage };
  },

  async create(user: AuthPayload, data: any) {
    const job = await Job.create({ ...data, collegeId: user.collegeId });
    return job.toObject();
  },

  async update(user: AuthPayload, jobId: string, patch: any) {
    const job = await Job.findOneAndUpdate(
      { _id: jobId, collegeId: user.collegeId },
      patch,
      { new: true }
    ).lean();
    if (!job) throw NotFound("Job not found");
    return job;
  },

  async remove(user: AuthPayload, jobId: string) {
    const job = await Job.findOneAndDelete({ _id: jobId, collegeId: user.collegeId });
    if (!job) throw NotFound("Job not found");
    // Clean up applications for the deleted job (keep data consistent).
    await Application.deleteMany({ jobId });
    return { ok: true };
  },
};
