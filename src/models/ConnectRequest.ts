import { Schema, model, Document, Types } from "mongoose";

/**
 * ConnectRequest — a student asking an alumnus for help (interview prep,
 * referral, guidance). The alumnus accepts and pastes a meeting link; the
 * platform never runs the call itself.
 *
 * Both sides read this one collection: the student sees their outgoing
 * requests (by studentId), the alumnus sees their inbox (by alumniId).
 */
export const CONNECT_MODES = ["audio", "video", "chat"] as const;
export type ConnectMode = (typeof CONNECT_MODES)[number];

export const CONNECT_STATUSES = ["pending", "accepted", "declined", "completed"] as const;
export type ConnectStatus = (typeof CONNECT_STATUSES)[number];

export interface IConnectRequest extends Document {
  collegeId: Types.ObjectId;
  studentId: Types.ObjectId;
  alumniId: Types.ObjectId; // the alumnus User being asked
  mode: ConnectMode;
  topic: string;
  note?: string;
  status: ConnectStatus;
  meetingLink?: string; // set by the alumnus on accept
  createdAt: Date;
  updatedAt: Date;
}

const connectRequestSchema = new Schema<IConnectRequest>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    alumniId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mode: { type: String, enum: CONNECT_MODES, default: "video" },
    topic: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    status: { type: String, enum: CONNECT_STATUSES, default: "pending", index: true },
    meetingLink: { type: String, trim: true },
  },
  { timestamps: true }
);

// Inbox (alumnus) and outgoing (student) queries, newest first.
connectRequestSchema.index({ alumniId: 1, status: 1, createdAt: -1 });
connectRequestSchema.index({ studentId: 1, createdAt: -1 });

export const ConnectRequest = model<IConnectRequest>("ConnectRequest", connectRequestSchema);
