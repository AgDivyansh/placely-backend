import { Schema, model, Document, Types } from "mongoose";
import { AnnouncementCategory, ANNOUNCEMENT_CATEGORIES, DocStatus, DOC_STATUSES } from "../types";

/* ───────────────────────── Bookmark ───────────────────────── */
/**
 * Bookmark — a student saving a job. Thin join table.
 * Unique per (student, job) so saving twice is a no-op at the DB level.
 */
export interface IBookmark extends Document {
  collegeId: Types.ObjectId;
  studentId: Types.ObjectId;
  jobId: Types.ObjectId;
  createdAt: Date;
}
const bookmarkSchema = new Schema<IBookmark>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
bookmarkSchema.index({ studentId: 1, jobId: 1 }, { unique: true });
export const Bookmark = model<IBookmark>("Bookmark", bookmarkSchema);

/* ───────────────────────── Document (vault) ───────────────────────── */
export interface IDocument extends Document {
  collegeId: Types.ObjectId;
  studentId: Types.ObjectId;
  type: string; // resume, tenth, twelfth, transcript, id_card, noc, aadhaar, pan
  name: string;
  filename?: string;
  fileUrl?: string;
  size?: string;
  status: DocStatus;
  required: boolean;
  uploadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const documentSchema = new Schema<IDocument>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    filename: { type: String },
    fileUrl: { type: String },
    size: { type: String },
    status: { type: String, enum: DOC_STATUSES, default: "missing" },
    required: { type: Boolean, default: false },
    uploadedAt: { type: Date },
  },
  { timestamps: true }
);
documentSchema.index({ studentId: 1, type: 1 }, { unique: true });
export const DocumentModel = model<IDocument>("Document", documentSchema);

/* ───────────────────────── Notification ───────────────────────── */
export interface INotification extends Document {
  collegeId: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  body?: string;
  kind: string;
  read: boolean;
  createdAt: Date;
}
const notificationSchema = new Schema<INotification>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String },
    kind: { type: String, default: "info" },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// Fetch a user's notifications newest-first; count unread quickly.
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
export const Notification = model<INotification>("Notification", notificationSchema);

/* ───────────────────────── Announcement ───────────────────────── */
export interface IAnnouncement extends Document {
  collegeId: Types.ObjectId;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  authorId: Types.ObjectId;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}
const announcementSchema = new Schema<IAnnouncement>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: "general" },
    pinned: { type: Boolean, default: false },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, default: "Placement Cell" },
  },
  { timestamps: true }
);
// Board query: pinned first, then newest — sort in code, but index the scope.
announcementSchema.index({ collegeId: 1, pinned: -1, createdAt: -1 });
export const Announcement = model<IAnnouncement>("Announcement", announcementSchema);

/* ───────────────────────── Activity (audit log) ───────────────────────── */
export interface IActivity extends Document {
  collegeId: Types.ObjectId;
  actorId: Types.ObjectId;
  actorName: string;
  action: string;
  target: string;
  kind: string;
  createdAt: Date;
}
const activitySchema = new Schema<IActivity>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String, default: "" },
    kind: { type: String, default: "general" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
activitySchema.index({ collegeId: 1, createdAt: -1 });
export const Activity = model<IActivity>("Activity", activitySchema);
