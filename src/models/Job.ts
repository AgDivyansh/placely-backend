import { Schema, model, Document, Types } from "mongoose";
import { Branch } from "../types";

/**
 * Job — a role posted by a company.
 *
 * Eligibility criteria are embedded (not a separate collection) because
 * they're always read together with the job and never queried on their
 * own. Embedding avoids an extra populate/join on every job fetch.
 *
 * `rounds` is the interview process shown on the job detail page.
 */
export interface IEligibility {
  minCgpa: number;
  minTenth: number;
  minTwelfth: number;
  branches: Branch[];
  maxBacklogs: number;
}

export interface IJob extends Document {
  collegeId: Types.ObjectId;
  companyId: Types.ObjectId;
  role: string;
  package: number; // LPA
  location: string;
  type: string; // Full-time, Internship, etc.
  description: string;
  rounds: string[];
  eligibility: IEligibility;
  deadline: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    role: { type: String, required: true, trim: true },
    package: { type: Number, required: true },
    location: { type: String, default: "Remote" },
    type: { type: String, default: "Full-time" },
    description: { type: String, default: "" },
    rounds: { type: [String], default: [] },
    eligibility: {
      minCgpa: { type: Number, default: 0 },
      minTenth: { type: Number, default: 0 },
      minTwelfth: { type: Number, default: 0 },
      branches: { type: [String], default: [] },
      maxBacklogs: { type: Number, default: 99 },
    },
    deadline: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Most common query: active jobs for a college, newest first.
jobSchema.index({ collegeId: 1, isActive: 1, createdAt: -1 });
jobSchema.index({ collegeId: 1, companyId: 1 });

export const Job = model<IJob>("Job", jobSchema);
