import { Router, Response } from "express";
import { z } from "zod";
import { asyncHandler, ok, created } from "../../utils/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AuthRequest } from "../../types";
import { Bookmark, DocumentModel, Notification } from "../../models/misc";
import { Job } from "../../models/Job";
import { User } from "../../models/User";
import { NotFound } from "../../utils/AppError";

/* ---------------- Bookmarks ---------------- */
const bookmarksRouter = Router();

bookmarksRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const bookmarks = await Bookmark.find({ studentId: req.user!.id }).lean();
    const jobIds = bookmarks.map((b) => b.jobId);
    const jobs = await Job.find({ _id: { $in: jobIds } }).lean();
    return ok(res, { bookmarks, jobs });
  })
);

// Add a bookmark (idempotent — unique index prevents duplicates)
bookmarksRouter.put(
  "/:jobId",
  authenticate,
  requireRole("student"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await Bookmark.updateOne(
      { studentId: req.user!.id, jobId: req.params.jobId },
      { $setOnInsert: { collegeId: req.user!.collegeId } },
      { upsert: true }
    );
    return ok(res, { ok: true }, "Saved");
  })
);

bookmarksRouter.delete(
  "/:jobId",
  authenticate,
  requireRole("student"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await Bookmark.deleteOne({ studentId: req.user!.id, jobId: req.params.jobId });
    return ok(res, { ok: true }, "Removed");
  })
);

/* ---------------- Documents ---------------- */
const documentsRouter = Router();

documentsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const documents = await DocumentModel.find({ studentId: req.user!.id }).lean();
    return ok(res, { documents });
  })
);

// Upload metadata (actual file storage — S3/Supabase — added later).
documentsRouter.post(
  "/",
  authenticate,
  requireRole("student"),
  validate(
    z.object({
      type: z.string(),
      name: z.string(),
      filename: z.string(),
      size: z.string().optional(),
      fileUrl: z.string().optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const doc = await DocumentModel.findOneAndUpdate(
      { studentId: req.user!.id, type: req.body.type },
      {
        studentId: req.user!.id,
        collegeId: req.user!.collegeId,
        ...req.body,
        status: "uploaded",
        uploadedAt: new Date(),
      },
      { upsert: true, new: true }
    ).lean();
    return created(res, { document: doc }, "Uploaded");
  })
);

documentsRouter.delete(
  "/:id",
  authenticate,
  requireRole("student"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await DocumentModel.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user!.id },
      { status: "missing", filename: null, fileUrl: null, size: null, uploadedAt: null }
    );
    return ok(res, { ok: true }, "Deleted");
  })
);

/* ---------------- Notifications ---------------- */
const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return ok(res, { notifications });
  })
);

notificationsRouter.patch(
  "/read-all",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await Notification.updateMany({ userId: req.user!.id, read: false }, { read: true });
    return ok(res, { ok: true });
  })
);

notificationsRouter.patch(
  "/:id/read",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await Notification.updateOne({ _id: req.params.id, userId: req.user!.id }, { read: true });
    return ok(res, { ok: true });
  })
);

/* ---------------- Profile ---------------- */
const profileRouter = Router();

profileRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.user!.id).lean();
    if (!user) throw NotFound("User not found");
    return ok(res, { profile: user });
  })
);

// Update profile. Academic fields affect eligibility, so they're allowed
// but should be OTP-gated on the frontend.
profileRouter.patch(
  "/",
  authenticate,
  validate(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      branch: z.string().optional(),
      cgpa: z.number().min(0).max(10).optional(),
      tenthPercent: z.number().min(0).max(100).optional(),
      twelfthPercent: z.number().min(0).max(100).optional(),
      backlogs: z.number().min(0).optional(),
      skills: z.array(z.string()).optional(),
      resumeUrl: z.string().optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true }).lean();
    return ok(res, { profile: user }, "Profile updated");
  })
);

export { bookmarksRouter, documentsRouter, notificationsRouter, profileRouter };
