import { Schema, model, Document } from "mongoose";

/**
 * College — the tenant root.
 *
 * Every other document (users, jobs, applications...) carries a collegeId
 * pointing here. This is the backbone of multi-tenancy: one Placely
 * deployment serves many colleges, and data is always scoped by college.
 *
 * `slug` enables subdomain routing later (e.g. glbajaj.placely.com).
 */
export interface ICollege extends Document {
  name: string;
  slug: string;
  city?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const collegeSchema = new Schema<ICollege>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, trim: true },
    logo: { type: String },
  },
  { timestamps: true }
);

export const College = model<ICollege>("College", collegeSchema);
