import { User, IUser } from "../../models/User";
import { College } from "../../models/College";
import { signToken } from "../../utils/jwt";
import { isAlumni } from "../../utils/alumni";
import { BadRequest, Unauthorized, NotFound, Conflict } from "../../utils/AppError";
import { z } from "zod";
import { signupSchema, loginSchema } from "./auth.validation";

type SignupInput = z.infer<typeof signupSchema>;
type LoginInput = z.infer<typeof loginSchema>;

/**
 * Shape the user object we return to the client — never include the
 * password hash, and flatten to the fields the frontend expects.
 */
function toPublicUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    collegeEmail: user.collegeEmail,
    phone: user.phone,
    collegeRollId: user.collegeRollId,
    graduationYear: user.graduationYear,
    // Computed, not stored — the frontend renders the college email as a
    // read-only "expired" badge once this is true.
    isAlumni: isAlumni(user.graduationYear),
    role: user.role,
    branch: user.branch,
    cgpa: user.cgpa,
    tenthPercent: user.tenthPercent,
    twelfthPercent: user.twelfthPercent,
    backlogs: user.backlogs,
    skills: user.skills,
    resumeUrl: user.resumeUrl,
    avatar: user.avatar,
    // Feature 2 profile data — omitting these dropped a student's resumes,
    // links, and public-profile state on every relogin.
    resumes: user.resumes,
    socialLinks: user.socialLinks,
    projects: user.projects,
    slug: user.slug,
    isPublic: user.isPublic,
    collegeId: user.collegeId,
  };
}

export const authService = {
  async signup(input: SignupInput) {
    // Resolve the college (demo: by slug, default to the first college).
    let college = input.collegeSlug
      ? await College.findOne({ slug: input.collegeSlug.toLowerCase() })
      : await College.findOne().sort({ createdAt: 1 });

    if (!college) throw NotFound("College not found. Contact your placement cell.");

    // Prevent duplicate email within the college (also enforced by index,
    // but checking here gives a friendlier message).
    const existing = await User.findOne({ collegeId: college._id, email: input.email.toLowerCase() });
    if (existing) throw Conflict("An account with this email already exists");

    const user = await User.create({
      collegeId: college._id,
      role: "student",
      name: input.name,
      email: input.email,
      collegeEmail: input.collegeEmail,
      phone: input.phone,
      collegeRollId: input.collegeRollId,
      graduationYear: input.graduationYear,
      branch: input.branch,
      password: input.password, // hashed by the pre-save hook
    });

    const token = signToken({
      id: user.id,
      role: user.role,
      collegeId: String(user.collegeId),
      graduationYear: user.graduationYear,
    });
    return { user: toPublicUser(user), role: user.role, token };
  },

  async login(input: LoginInput) {
    // Build the lookup query based on which identifier the student used.
    const field =
      input.identifierType === "phone"
        ? "phone"
        : input.identifierType === "collegeId"
        ? "collegeRollId"
        : "email";

    // Email login matches EITHER the personal or the college address, so a
    // student can sign in with whichever they remember. Phone / collegeId
    // stay single-field lookups.
    const query: Record<string, unknown> =
      field === "email"
        ? {
            $or: [
              { email: input.identifier.toLowerCase() },
              { collegeEmail: input.identifier.toLowerCase() },
            ],
            role: input.requestedRole,
          }
        : { [field]: input.identifier, role: input.requestedRole };

    // Must explicitly select password since it's select:false by default.
    const user = await User.findOne(query).select("+password");
    if (!user) throw Unauthorized("Invalid credentials");

    const match = await user.comparePassword(input.password);
    if (!match) throw Unauthorized("Invalid credentials");

    const token = signToken({
      id: user.id,
      role: user.role,
      collegeId: String(user.collegeId),
      graduationYear: user.graduationYear,
    });
    return { user: toPublicUser(user), role: user.role, token };
  },

  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw NotFound("User not found");
    return { user: toPublicUser(user), role: user.role };
  },

  /**
   * Forgot/reset password — DEMO implementation.
   * In production: generate a real OTP, store it hashed with a short TTL,
   * and email it via SendGrid/MSG91. Here we accept any 6-digit OTP so the
   * flow is demoable without email infrastructure.
   */
  async forgotPassword(email: string) {
    // Always return success even if the email doesn't exist — this avoids
    // leaking which emails are registered (an account-enumeration defense).
    return { sent: true };
  },

  async resetPassword(email: string, _otp: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) throw NotFound("No account with that email");
    // Demo: any 6-digit OTP is accepted (validated for length upstream).
    user.password = password; // re-hashed by pre-save hook
    await user.save();
    return { reset: true };
  },
};
