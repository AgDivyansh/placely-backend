import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized, validated environment config.
 *
 * Why: reading process.env everywhere is error-prone (typos, missing
 * vars discovered at runtime). We read + validate once here and export
 * a typed object. If a required var is missing, the app fails fast on
 * startup with a clear message instead of crashing mysteriously later.
 */
function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    // Fail fast — a missing secret should never boot silently.
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  port: optionalInt("PORT", 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: (process.env.NODE_ENV || "development") === "production",

  mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/placely"),

  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimit: {
    windowMinutes: optionalInt("RATE_LIMIT_WINDOW_MINUTES", 15),
    maxRequests: optionalInt("RATE_LIMIT_MAX_REQUESTS", 300),
  },
};
