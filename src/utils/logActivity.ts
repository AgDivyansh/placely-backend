import { Types } from "mongoose";
import { Activity } from "../models/misc";

/**
 * logActivity — writes an audit-log entry. Fire-and-forget: we don't want
 * a logging hiccup to fail the actual operation, so errors are swallowed
 * (but logged to the console). Called after important admin actions.
 */
export async function logActivity(params: {
  collegeId: Types.ObjectId | string;
  actorId: Types.ObjectId | string;
  actorName: string;
  action: string;
  target?: string;
  kind?: string;
}): Promise<void> {
  try {
    await Activity.create({
      collegeId: params.collegeId,
      actorId: params.actorId,
      actorName: params.actorName,
      action: params.action,
      target: params.target || "",
      kind: params.kind || "general",
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
