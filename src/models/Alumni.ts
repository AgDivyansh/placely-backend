import { Schema, model, Document, Types } from "mongoose";

/**
 * Alumni — verified seniors available for mentorship. Kept separate from
 * User because alumni aren't portal login accounts here; they're mentor
 * profiles students can browse and message.
 */
export interface IAlumni extends Document {
  collegeId: Types.ObjectId;
  name: string;
  gradYear: number;
  company: string;
  role: string;
  domains: string[];
  avatar?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const alumniSchema = new Schema<IAlumni>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    name: { type: String, required: true },
    gradYear: { type: Number, required: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    domains: { type: [String], default: [] },
    avatar: { type: String },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

alumniSchema.index({ collegeId: 1, company: 1 });

export const Alumni = model<IAlumni>("Alumni", alumniSchema);
