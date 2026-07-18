import { Router } from "express";
import authRoutes from "./auth/auth.routes";
import jobsRoutes from "./jobs";
import { applicationsRouter, applicantsRouter } from "./applications";
import { companiesRouter, alumniRouter } from "./catalog";
import { bookmarksRouter, documentsRouter, notificationsRouter, profileRouter } from "./student";
import {
  announcementsRouter, activityRouter, analyticsRouter, studentsRouter,
} from "./admin";

/**
 * The single API router. Mounted at /api in app.ts.
 * Paths here line up with the frontend's endpoints.js.
 */
export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/jobs", jobsRoutes);
apiRouter.use("/applications", applicationsRouter);
apiRouter.use("/applicants", applicantsRouter);
apiRouter.use("/companies", companiesRouter);
apiRouter.use("/alumni", alumniRouter);
apiRouter.use("/bookmarks", bookmarksRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/announcements", announcementsRouter);
apiRouter.use("/activity", activityRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/students", studentsRouter);
