import { Router, Response } from "express";
import { z } from "zod";
import { asyncHandler, ok, created } from "../../utils/http";
import { authenticate, requireRole, requireAlumniOrAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { logActivity } from "../../utils/logActivity";
import { AuthRequest } from "../../types";
import { ConnectRequest, CONNECT_MODES } from "../../models/ConnectRequest";
import { User } from "../../models/User";
import { Notification } from "../../models/misc";
import { NotFound, BadRequest } from "../../utils/AppError";
import { isAlumni } from "../../utils/alumni";

/**
 * Connect module — students request help from alumni (mentorship, referrals).
 * One collection powers both views: student's outgoing requests and the
 * alumnus's inbox. The platform never runs the call — the alumnus pastes a
 * meeting link on accept.
 */
const connectRouter = Router();

// Enrich requests with the counterpart's name/company for display.
async function withPeople(requests: any[]) {
  const ids = [
    ...new Set(requests.flatMap((r) => [String(r.studentId), String(r.alumniId)])),
  ];
  const users = await User.find({ _id: { $in: ids } })
    .select("name currentCompany branch collegeRollId avatar")
    .lean();
  const map = new Map(users.map((u) => [String(u._id), u]));
  return requests.map((r) => ({
    ...r,
    student: map.get(String(r.studentId)) || null,
    alumni: map.get(String(r.alumniId)) || null,
  }));
}

/* ---------- STUDENT: create a request + see my own ---------- */
connectRouter.post(
  "/",
  authenticate,
  requireRole("student"),
  validate(
    z.object({
      alumniId: z.string().min(1),
      mode: z.enum(CONNECT_MODES).default("video"),
      topic: z.string().trim().min(1).max(120),
      note: z.string().trim().max(1000).optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // The target must be an alumnus at the same college.
    const alum = await User.findOne({ _id: req.body.alumniId, collegeId: req.user!.collegeId }).lean();
    if (!alum) throw NotFound("Alumnus not found");

    const student = await User.findById(req.user!.id).select("name").lean();
    const request = await ConnectRequest.create({
      collegeId: req.user!.collegeId,
      studentId: req.user!.id,
      alumniId: req.body.alumniId,
      mode: req.body.mode,
      topic: req.body.topic,
      note: req.body.note,
    });

    await Notification.create({
      collegeId: req.user!.collegeId,
      userId: req.body.alumniId,
      title: "New connect request",
      body: `${student?.name || "A student"} requested a ${req.body.mode} chat: ${req.body.topic}`,
      kind: "connect",
    });

    return created(res, { request }, "Request sent");
  })
);

connectRouter.get(
  "/mine",
  authenticate,
  requireRole("student"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const requests = await ConnectRequest.find({ studentId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, { requests: await withPeople(requests) });
  })
);

/* ---------- ALUMNUS: inbox + respond ---------- */
connectRouter.get(
  "/inbox",
  authenticate,
  requireAlumniOrAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const requests = await ConnectRequest.find({ alumniId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, { requests: await withPeople(requests) });
  })
);

connectRouter.patch(
  "/:id",
  authenticate,
  requireAlumniOrAdmin,
  validate(
    z.object({
      status: z.enum(["accepted", "declined", "completed"]),
      meetingLink: z.string().url().startsWith("https://", "Meeting link must be https").optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const request = await ConnectRequest.findOne({ _id: req.params.id, alumniId: req.user!.id });
    if (!request) throw NotFound("Request not found");
    // Accepting a call needs a meeting link to hand the student.
    if (req.body.status === "accepted" && !req.body.meetingLink && request.mode !== "chat") {
      throw BadRequest("A meeting link is required to accept a call");
    }

    request.status = req.body.status;
    if (req.body.meetingLink) request.meetingLink = req.body.meetingLink;
    await request.save();

    const alum = await User.findById(req.user!.id).select("name").lean();
    const verb =
      req.body.status === "accepted" ? "accepted" : req.body.status === "declined" ? "declined" : "marked complete";
    await Notification.create({
      collegeId: req.user!.collegeId,
      userId: request.studentId,
      title: `Connect request ${verb}`,
      body: `${alum?.name || "The alumnus"} ${verb} your request: ${request.topic}`,
      kind: "connect",
    });
    await logActivity({
      collegeId: req.user!.collegeId,
      actorId: req.user!.id,
      actorName: alum?.name || "Alumni",
      action: `Connect request ${verb}`,
      target: request.topic,
      kind: "connect",
    });

    return ok(res, { request }, `Request ${verb}`);
  })
);

/* ---------- Alumni directory (students find alumni for referrals) ---------- */
// isAlumni is computed from graduationYear, so we can't query role="alumni";
// fetch opted-in graduates (college-scoped) and filter in code. Optional
// ?company= narrows to alumni working there (case-insensitive).
connectRouter.get(
  "/directory",
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const company = typeof req.query.company === "string" ? req.query.company.trim() : "";
    const query: Record<string, unknown> = {
      collegeId: req.user!.collegeId,
      role: "student",
      openToMentoring: true,
      graduationYear: { $ne: null },
    };
    if (company) {
      query.currentCompany = new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    const users = await User.find(query)
      .select("name branch graduationYear currentCompany mentorBio avatar socialLinks")
      .lean();

    // Only real alumni (past the graduation cutoff).
    const alumni = users
      .filter((u) => isAlumni(u.graduationYear))
      .map((u) => ({
        id: u._id,
        name: u.name,
        branch: u.branch,
        graduationYear: u.graduationYear,
        currentCompany: u.currentCompany,
        mentorBio: u.mentorBio,
        avatar: u.avatar,
        socialLinks: u.socialLinks,
      }));

    return ok(res, { alumni });
  })
);

export { connectRouter };
