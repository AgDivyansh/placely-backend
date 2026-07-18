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
import { isAlumni } from "../../utils/alumni";
import { publicSlug } from "../../utils/slug";

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

// Validate full canonical URLs, not bare handles — this blocks javascript:/
// data: injection when the link is rendered as an anchor on the public page.
const socialLinksSchema = z
  .object({
    github: z.string().regex(/^https:\/\/github\.com\/[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, "Invalid GitHub profile URL"),
    linkedin: z.string().regex(/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{1,98}[a-zA-Z0-9])?\/?$/, "Invalid LinkedIn profile URL"),
    leetcode: z.string().regex(/^https:\/\/leetcode\.com\/u\/[A-Za-z0-9_]{1,25}\/?$/, "Invalid LeetCode profile URL"),
    codeforces: z.string().regex(/^https:\/\/codeforces\.com\/profile\/[A-Za-z0-9_-]{3,24}$/, "Invalid Codeforces profile URL"),
    codechef: z.string().regex(/^https:\/\/www\.codechef\.com\/users\/[a-zA-Z0-9_]{4,20}$/, "Invalid CodeChef profile URL"),
    hackerrank: z.string().regex(/^https:\/\/www\.hackerrank\.com\/profile\/[a-zA-Z0-9_]{3,30}$/, "Invalid HackerRank profile URL"),
    website: z.string().url().startsWith("https://", "Website must be https").max(200),
  })
  .partial();

const projectsSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(1000).default(""),
      url: z.string().url().startsWith("https://", "URL must be https").max(300).optional(),
      tech: z.array(z.string().trim().max(30)).max(20).optional(),
    })
  )
  .max(30);

const resumesSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(80),
      filename: z.string().trim().max(200).optional(),
      fileUrl: z.string().trim().max(300).optional(),
      isDefault: z.boolean().optional(),
    })
  )
  .max(4);

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
      socialLinks: socialLinksSchema.optional(),
      projects: projectsSchema.optional(),
      resumes: resumesSchema.optional(),
      isPublic: z.boolean().optional(),
      currentCompany: z.string().trim().max(80).optional(),
      mentorBio: z.string().trim().max(600).optional(),
      openToMentoring: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const update: Record<string, unknown> = { ...req.body };

    // Generate a stable slug once, the first time a profile is made public.
    // Kept off the client so it can't be spoofed or enumerated.
    if (req.body.isPublic === true) {
      const current = await User.findById(req.user!.id).select("slug name").lean();
      if (current && !current.slug) update.slug = publicSlug(current.name);
    }

    const user = await User.findByIdAndUpdate(req.user!.id, update, { new: true }).lean();
    return ok(res, { profile: user }, "Profile updated");
  })
);

/* ---------------- Public profile (unauthenticated) ---------------- */
const publicProfileRouter = Router();

// Whitelist ONLY non-PII fields. Never reuse the authenticated profile shape —
// it carries email/phone/cgpa. Whitelisting (not blacklisting) means a new
// sensitive field added later can't leak by omission.
function toPublicProfile(u: any) {
  return {
    id: u._id,
    name: u.name,
    avatar: u.avatar,
    branch: u.branch,
    graduationYear: u.graduationYear,
    isAlumni: isAlumni(u.graduationYear),
    skills: u.skills,
    resumeUrl: u.resumeUrl,
    socialLinks: u.socialLinks,
    projects: u.projects,
  };
}

// GET /public-profile/:slug?collegeId=... — no auth. Requires collegeId so a
// slug is scoped to one college (curbs cross-college enumeration). Returns an
// identical 404 for missing slug, wrong college, or a private profile so the
// endpoint reveals nothing about which profiles exist.
publicProfileRouter.get(
  "/:slug",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { collegeId } = req.query;
    if (typeof collegeId !== "string") throw NotFound("Profile not found");
    const user = await User.findOne({
      collegeId,
      slug: req.params.slug,
      isPublic: true,
    }).lean();
    if (!user) throw NotFound("Profile not found");
    return ok(res, { profile: toPublicProfile(user) });
  })
);

export {
  bookmarksRouter,
  documentsRouter,
  notificationsRouter,
  profileRouter,
  publicProfileRouter,
};
