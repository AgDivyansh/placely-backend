import { Router, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { asyncHandler, ok, created } from "../../utils/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { logActivity } from "../../utils/logActivity";
import { AuthRequest } from "../../types";
import { Announcement, Activity } from "../../models/misc";
import { Application } from "../../models/Application";
import { User } from "../../models/User";
import { Job } from "../../models/Job";
import { NotFound } from "../../utils/AppError";

/* ---------------- Announcements (shared read, admin write) ---------------- */
const announcementsRouter = Router();

announcementsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Pinned first, then newest.
    const announcements = await Announcement.find({ collegeId: req.user!.collegeId })
      .sort({ pinned: -1, createdAt: -1 })
      .lean();
    return ok(res, { announcements });
  })
);

announcementsRouter.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      category: z.enum(["general", "drive", "deadline", "event"]).default("general"),
      pinned: z.boolean().default(false),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.user!.id).lean();
    const announcement = await Announcement.create({
      ...req.body,
      collegeId: req.user!.collegeId,
      authorId: req.user!.id,
      authorName: user?.name || "Placement Cell",
    });
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: user?.name || "Admin",
      action: "Posted announcement",
      target: req.body.title,
      kind: "announcement",
    });
    return created(res, { announcement }, "Announcement posted");
  })
);

announcementsRouter.patch(
  "/:id/pin",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const a = await Announcement.findOne({ _id: req.params.id, collegeId: req.user!.collegeId });
    if (!a) throw NotFound("Announcement not found");
    a.pinned = !a.pinned;
    await a.save();
    return ok(res, { announcement: a });
  })
);

announcementsRouter.delete(
  "/:id",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const a = await Announcement.findOneAndDelete({
      _id: req.params.id,
      collegeId: req.user!.collegeId,
    });
    if (!a) throw NotFound("Announcement not found");
    return ok(res, { ok: true }, "Deleted");
  })
);

/* ---------------- Activity feed (admin) ---------------- */
const activityRouter = Router();

activityRouter.get(
  "/",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const activity = await Activity.find({ collegeId: req.user!.collegeId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok(res, { activity });
  })
);

/* ---------------- Analytics (admin dashboard) ---------------- */
const analyticsRouter = Router();

analyticsRouter.get(
  "/overview",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const collegeId = req.user!.collegeId;
    // aggregate() bypasses Mongoose casting, so $match needs a real ObjectId
    // (a string never matches). Cast explicitly instead of fetching a doc.
    const collegeObjectId = new Types.ObjectId(collegeId);

    // Run independent aggregations in parallel for speed.
    const [activeJobs, totalApplicants, offers, stageAgg] = await Promise.all([
      Job.countDocuments({ collegeId, isActive: true }),
      Application.countDocuments({ collegeId }),
      Application.countDocuments({ collegeId, currentStage: "offer" }),
      Application.aggregate([
        { $match: { collegeId: collegeObjectId } },
        { $group: { _id: "$currentStage", count: { $sum: 1 } } },
      ]),
    ]);

    const selectionRate = totalApplicants > 0 ? Math.round((offers / totalApplicants) * 100) : 0;

    return ok(res, {
      kpis: { activeJobs, totalApplicants, offers, selectionRate },
      byStage: stageAgg,
    });
  })
);

/* ---------------- Student Directory (admin) ---------------- */
const studentsRouter = Router();

studentsRouter.get(
  "/",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const collegeId = req.user!.collegeId;
    const students = await User.find({ collegeId, role: "student" })
      .select("name email phone branch cgpa collegeRollId")
      .lean();

    // Attach application counts + placed status per student in one pass.
    const apps = await Application.find({ collegeId }).select("studentId currentStage").lean();
    const byStudent = new Map<string, { count: number; placed: boolean }>();
    apps.forEach((a) => {
      const key = String(a.studentId);
      const cur = byStudent.get(key) || { count: 0, placed: false };
      cur.count++;
      if (a.currentStage === "offer") cur.placed = true;
      byStudent.set(key, cur);
    });

    const enriched = students.map((s) => ({
      ...s,
      applicationCount: byStudent.get(String(s._id))?.count || 0,
      placed: byStudent.get(String(s._id))?.placed || false,
    }));

    return ok(res, { students: enriched });
  })
);

// One student's full detail + their applications (for the drawer).
studentsRouter.get(
  "/:id",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const student = await User.findOne({
      _id: req.params.id,
      collegeId: req.user!.collegeId,
      role: "student",
    }).lean();
    if (!student) throw NotFound("Student not found");

    const apps = await Application.find({ studentId: student._id })
      .populate("jobId", "role")
      .populate("companyId", "name color")
      .lean();

    return ok(res, { student, applications: apps });
  })
);

// Bulk-create students from parsed CSV rows. Created one-by-one (not
// insertMany) so the password-hashing pre-save hook runs per row. Per-row
// failures (e.g. duplicate email) are collected, not fatal.
studentsRouter.post(
  "/import",
  authenticate,
  requireRole("admin"),
  validate(
    z.object({
      rows: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            email: z.string().email(),
            collegeRollId: z.string().trim().optional(),
            branch: z.enum(["CSE", "ECE", "EEE", "ME", "CE", "IT", "AIDS", "AIML"]).optional(),
            cgpa: z.coerce.number().min(0).max(10).optional(),
            graduationYear: z.coerce.number().int().min(2000).max(2100).optional(),
          })
        )
        .min(1)
        .max(1000),
      // Default login password for imported accounts; students reset later.
      defaultPassword: z.string().min(8).default("placely2026"),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rows, defaultPassword } = req.body;
    const collegeId = req.user!.collegeId;
    let created = 0;
    const failed: { email: string; reason: string }[] = [];

    for (const row of rows) {
      try {
        await User.create({
          collegeId,
          role: "student",
          name: row.name,
          email: row.email,
          collegeRollId: row.collegeRollId,
          branch: row.branch,
          cgpa: row.cgpa,
          graduationYear: row.graduationYear,
          password: defaultPassword,
        });
        created++;
      } catch (err: any) {
        const reason = err?.code === 11000 ? "Already exists" : err?.message || "Invalid row";
        failed.push({ email: row.email, reason });
      }
    }

    return ok(res, { created, failed }, `Imported ${created} student${created === 1 ? "" : "s"}`);
  })
);

export { announcementsRouter, activityRouter, analyticsRouter, studentsRouter };
