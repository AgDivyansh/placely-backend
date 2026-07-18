import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { notFound, errorHandler } from "./middleware/error";
import { apiRouter } from "./modules";

/**
 * Builds the Express app. Middleware order matters — it runs top to bottom.
 */
export function createApp() {
  const app = express();

  // Behind a proxy (Render/Railway/Vercel) so req.ip / rate-limit work right.
  app.set("trust proxy", 1);

  // --- Security & performance middleware ---
  app.use(helmet()); // sets safe HTTP headers
  app.use(
    cors({
      origin: env.corsOrigins, // only allow our frontend origins
      credentials: true,
    })
  );
  app.use(compression()); // gzip responses — smaller, faster payloads
  app.use(express.json({ limit: "1mb" })); // parse JSON bodies (capped)
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProd) app.use(morgan("dev")); // request logging in dev

  // --- Rate limiting (blunt DDoS / abuse protection) ---
  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMinutes * 60 * 1000,
    max: env.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please slow down." },
  });
  app.use("/api", limiter);

  // --- Health check (used by hosting platforms + uptime monitors) ---
  app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok", time: new Date().toISOString() });
  });

  // --- API routes ---
  app.use("/api", apiRouter);

  // --- 404 + error handling (must be LAST) ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
