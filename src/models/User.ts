import { Schema, model, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";
import { Role, Branch } from "../types";

/**
 * User — both students and admins live here, distinguished by `role`.
 *
 * Student-specific academic fields (cgpa, tenthPercent, etc.) are optional
 * so an admin document isn't forced to carry them. The eligibility engine
 * reads these fields.
 *
 * Multi-identifier login: a student can sign in with email, collegeRollId,
 * or phone. All three are indexed and unique-per-college so lookups are fast.
 *
 * Security: the password is hashed with bcrypt before save and is never
 * returned by default (select: false). The comparePassword method wraps
 * the constant-time bcrypt compare.
 */
export interface IUser extends Document {
  collegeId: Types.ObjectId;
  role: Role;
  name: string;
  email: string; // permanent personal email — primary login identifier
  collegeEmail?: string; // college-issued email — verified badge, expires at graduation
  phone?: string;
  collegeRollId?: string; // the student's college ID number
  graduationYear?: number; // drives computed alumni status
  password: string;

  // Student academic profile (used by eligibility engine)
  branch?: Branch;
  cgpa?: number;
  tenthPercent?: number;
  twelfthPercent?: number;
  backlogs?: number;
  skills?: string[];
  resumeUrl?: string;
  avatar?: string;

  // A small set of named resumes; the student picks one per application.
  resumes?: { id: string; name: string; filename?: string; fileUrl?: string; isDefault?: boolean }[];

  // User-entered profile URLs, never fetched server-side.
  socialLinks?: {
    github?: string;
    linkedin?: string;
    leetcode?: string;
    codeforces?: string;
    codechef?: string;
    hackerrank?: string;
    website?: string;
  };
  projects?: { title: string; description: string; url?: string; tech?: string[] }[];

  // Public shareable profile. Opt-in: a profile is private until isPublic is
  // set true, at which point a college-scoped slug is generated once.
  slug?: string;
  isPublic?: boolean;

  // Alumni mentor fields. `currentCompany` powers the referral directory
  // (students search a company → find college alumni there). `openToMentoring`
  // opts an alumnus into that directory.
  currentCompany?: string;
  mentorBio?: string;
  openToMentoring?: boolean;

  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    role: { type: String, enum: ["student", "admin"], required: true, default: "student" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    // Permanent personal email is `email` above. `collegeEmail` is the
    // college-issued address — a verified badge that "expires" (becomes
    // read-only) once the user graduates. Optional so admins/legacy docs
    // don't need it.
    collegeEmail: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    collegeRollId: { type: String, trim: true },
    // Drives on-the-fly alumni status (see utils/alumni.isAlumni). No cron:
    // status is computed from this immutable year, never stored as a flag.
    graduationYear: { type: Number },
    // select:false → password is never returned unless explicitly requested
    password: { type: String, required: true, select: false },

    branch: { type: String, enum: ["CSE", "ECE", "EEE", "ME", "CE", "IT", "AIDS", "AIML"] },
    cgpa: { type: Number, min: 0, max: 10 },
    tenthPercent: { type: Number, min: 0, max: 100 },
    twelfthPercent: { type: Number, min: 0, max: 100 },
    backlogs: { type: Number, min: 0, default: 0 },
    skills: { type: [String], default: [] },
    resumeUrl: { type: String },
    avatar: { type: String },

    resumes: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true, trim: true },
          filename: { type: String, trim: true },
          fileUrl: { type: String, trim: true },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    socialLinks: {
      github: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      leetcode: { type: String, trim: true },
      codeforces: { type: String, trim: true },
      codechef: { type: String, trim: true },
      hackerrank: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    projects: {
      type: [
        {
          title: { type: String, required: true, trim: true },
          description: { type: String, default: "", trim: true },
          url: { type: String, trim: true },
          tech: { type: [String], default: [] },
        },
      ],
      default: [],
    },

    // Public shareable profile — opt-in, off by default (privacy-safe).
    slug: { type: String, trim: true },
    isPublic: { type: Boolean, default: false },

    // Alumni mentor / referral directory.
    currentCompany: { type: String, trim: true },
    mentorBio: { type: String, trim: true },
    openToMentoring: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * Compound unique indexes — scoped per college (multi-tenant).
 * Two different colleges can each have a student with roll "21CS1234",
 * but within one college it must be unique. `sparse` lets optional
 * identifiers (phone, rollId) be absent without violating uniqueness.
 */
userSchema.index({ collegeId: 1, email: 1 }, { unique: true });
// Optional identifiers use PARTIAL (not sparse) indexes. A compound sparse
// index still indexes docs where the optional field is null (because
// collegeId is always present), so a second user omitting the field collides
// on `null`. Partial filters index only docs where the field is a real
// string — so many users can leave it blank, but present values stay unique.
userSchema.index(
  { collegeId: 1, collegeEmail: 1 },
  { unique: true, partialFilterExpression: { collegeEmail: { $type: "string" } } }
);
userSchema.index(
  { collegeId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } }
);
userSchema.index(
  { collegeId: 1, collegeRollId: 1 },
  { unique: true, partialFilterExpression: { collegeRollId: { $type: "string" } } }
);
// Public profile slug — unique per college, partial so private profiles
// (no slug) don't collide on null. Also the lookup index for the public route.
userSchema.index(
  { collegeId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } }
);
// Fast directory queries: list/filter students by branch within a college
userSchema.index({ collegeId: 1, role: 1, branch: 1 });

/**
 * Hash the password before saving — only when it changed, so profile
 * updates don't re-hash an already-hashed value. 10 salt rounds is a
 * good speed/security balance for a portal like this.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>("User", userSchema);
