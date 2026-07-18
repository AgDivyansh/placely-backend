import { Application } from "../../models/Application";
import { Job } from "../../models/Job";
import { User } from "../../models/User";
import { Company } from "../../models/Company";
import { BadRequest, NotFound, Conflict, Forbidden } from "../../utils/AppError";
import { checkEligibility } from "../../utils/eligibility";
import { AuthPayload, Stage, STAGES } from "../../types";

export const applicationsService = {
  /* ---------- STUDENT ---------- */

  // A student's own applications, with job + company details joined.
  async listMine(user: AuthPayload) {
    const apps = await Application.find({ studentId: user.id }).sort({ createdAt: -1 }).lean();
    const jobIds = apps.map((a) => a.jobId);
    const [jobs, companies] = await Promise.all([
      Job.find({ _id: { $in: jobIds } }).lean(),
      Company.find({ collegeId: user.collegeId }).lean(),
    ]);
    const jobMap = new Map(jobs.map((j) => [String(j._id), j]));
    const companyMap = new Map(companies.map((c) => [String(c._id), c]));

    return apps.map((a) => ({
      ...a,
      job: jobMap.get(String(a.jobId)),
      company: companyMap.get(String(a.companyId)),
    }));
  },

  // Apply to a job — server-side eligibility gate + duplicate protection.
  async apply(user: AuthPayload, jobId: string) {
    const job = await Job.findOne({ _id: jobId, collegeId: user.collegeId });
    if (!job) throw NotFound("Job not found");
    if (!job.isActive) throw BadRequest("This job is no longer accepting applications");
    if (new Date(job.deadline) < new Date()) throw BadRequest("The application deadline has passed");

    // AUTHORITATIVE eligibility check — never trust the client.
    const student = await User.findById(user.id);
    if (!student) throw NotFound("Student not found");
    const elig = checkEligibility(student, job);
    if (!elig.eligible) {
      throw Forbidden(`You are not eligible: ${elig.reasons.join(", ")} requirement not met`);
    }

    try {
      const application = await Application.create({
        collegeId: user.collegeId,
        jobId: job._id,
        companyId: job.companyId,
        studentId: user.id,
        currentStage: "applied",
        stageHistory: [{ stage: "applied", at: new Date() }],
      });
      return application.toObject();
    } catch (err: any) {
      // Unique index (jobId+studentId) rejects duplicates → friendly message.
      if (err?.code === 11000) throw Conflict("You've already applied to this job");
      throw err;
    }
  },

  async withdraw(user: AuthPayload, applicationId: string) {
    const app = await Application.findOneAndDelete({ _id: applicationId, studentId: user.id });
    if (!app) throw NotFound("Application not found");
    return { ok: true };
  },

  /* ---------- ADMIN ---------- */

  // Applicants for a specific job (admin drill-down), with student details.
  async byJob(user: AuthPayload, jobId: string) {
    const job = await Job.findOne({ _id: jobId, collegeId: user.collegeId }).lean();
    if (!job) throw NotFound("Job not found");

    const apps = await Application.find({ jobId }).sort({ createdAt: -1 }).lean();
    const studentIds = apps.map((a) => a.studentId);
    const students = await User.find({ _id: { $in: studentIds } })
      .select("name email phone branch cgpa collegeRollId")
      .lean();
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const applicants = apps.map((a) => {
      const s = studentMap.get(String(a.studentId));
      return {
        id: a._id,
        applicationId: a._id,
        studentId: a.studentId,
        name: s?.name || "—",
        email: s?.email,
        roll: s?.collegeRollId || "—",
        branch: s?.branch || "—",
        cgpa: s?.cgpa ?? 0,
        currentStage: a.currentStage,
        appliedAt: a.createdAt,
      };
    });

    // Stage funnel counts for the header strip.
    const stageCounts: Record<string, number> = {};
    STAGES.forEach((st) => (stageCounts[st] = 0));
    apps.forEach((a) => (stageCounts[a.currentStage] = (stageCounts[a.currentStage] || 0) + 1));

    return { job, applicants, stageCounts };
  },

  async updateStage(user: AuthPayload, applicationId: string, stage: Stage) {
    if (!STAGES.includes(stage)) throw BadRequest("Invalid stage");
    const app = await Application.findOneAndUpdate(
      { _id: applicationId, collegeId: user.collegeId },
      { currentStage: stage, $push: { stageHistory: { stage, at: new Date(), by: user.id } } },
      { new: true }
    ).lean();
    if (!app) throw NotFound("Application not found");
    return app;
  },

  async revoke(user: AuthPayload, applicationId: string) {
    const app = await Application.findOneAndDelete({
      _id: applicationId,
      collegeId: user.collegeId,
    });
    if (!app) throw NotFound("Application not found");
    return { ok: true };
  },

  // Bulk advance to the next stage in the pipeline.
  async bulkAdvance(user: AuthPayload, ids: string[]) {
    const apps = await Application.find({ _id: { $in: ids }, collegeId: user.collegeId });
    let updated = 0;
    await Promise.all(
      apps.map(async (a) => {
        const idx = STAGES.indexOf(a.currentStage);
        if (idx < STAGES.length - 1) {
          a.currentStage = STAGES[idx + 1];
          a.stageHistory.push({ stage: a.currentStage, at: new Date(), by: user.id as any });
          await a.save();
          updated++;
        }
      })
    );
    return { updated };
  },

  async bulkRevoke(user: AuthPayload, ids: string[]) {
    const result = await Application.deleteMany({
      _id: { $in: ids },
      collegeId: user.collegeId,
    });
    return { removed: result.deletedCount || 0 };
  },
};
