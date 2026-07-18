import { Schema, model, Document, Types } from "mongoose";
import { Stage, STAGES } from "../types";

/**
 * Application — a student's application to a job. This single collection
 * powers BOTH views:
 *   • student side ("my applications")
 *   • admin side ("applicants for this job")
 * by querying on studentId or jobId respectively.
 *
 * currentStage moves through the hiring pipeline. stageHistory records
 * each transition (who moved it, when) — this doubles as an audit trail
 * and lets us show a timeline later.
 */
export interface IStageChange {
  stage: Stage;
  at: Date;
  by?: Types.ObjectId;
}

export interface IApplication extends Document {
  collegeId: Types.ObjectId;
  jobId: Types.ObjectId;
  companyId: Types.ObjectId;
  studentId: Types.ObjectId;
  currentStage: Stage;
  stageHistory: IStageChange[];
  selectedResumeId?: string; // which of the student's resumes was submitted
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentStage: { type: String, enum: STAGES, default: "applied", index: true },
    stageHistory: {
      type: [
        {
          stage: { type: String, enum: STAGES },
          at: { type: Date, default: Date.now },
          by: { type: Schema.Types.ObjectId, ref: "User" },
        },
      ],
      default: [],
    },
    selectedResumeId: { type: String },
  },
  { timestamps: true }
);

/**
 * A student can apply to a given job only once — enforce at the DB level
 * so a double-submit (network retry, double-click) can't create dupes.
 * This is more reliable than checking in code.
 */
applicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });
// Admin drill-down: applicants for a job, filtered by stage.
applicationSchema.index({ jobId: 1, currentStage: 1 });
// Student view: my applications, newest first.
applicationSchema.index({ studentId: 1, createdAt: -1 });

export const Application = model<IApplication>("Application", applicationSchema);
