import { Schema, model, Document, Types } from "mongoose";

/**
 * Company — a recruiter that posts jobs. Scoped by college (each college
 * curates its own recruiter list). `initial` and `color` drive the UI
 * avatar so the frontend needs no extra asset lookups.
 */
export interface ICompany extends Document {
  collegeId: Types.ObjectId;
  name: string;
  initial: string;
  color: string;
  industry: string;
  rating: number;
  avgPackage: number; // LPA
  difficulty: "Easy" | "Medium" | "Hard";
  packageTrend?: number[]; // recent avg packages for the trend chart
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true, index: true },
    name: { type: String, required: true, trim: true },
    initial: { type: String, required: true },
    color: { type: String, default: "#B8502D" },
    industry: { type: String, required: true },
    rating: { type: Number, min: 0, max: 5, default: 4 },
    avgPackage: { type: Number, default: 0 },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    packageTrend: { type: [Number], default: [] },
  },
  { timestamps: true }
);

companySchema.index({ collegeId: 1, name: 1 });
companySchema.index({ collegeId: 1, industry: 1 });

export const Company = model<ICompany>("Company", companySchema);
