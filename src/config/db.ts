import mongoose from "mongoose";
import { env } from "./env";

/**
 * MongoDB connection.
 *
 * Performance choices baked in:
 *  - Connection pooling (maxPoolSize): reuses sockets instead of opening
 *    a new one per query. Huge win under concurrent load.
 *  - serverSelectionTimeout: fail fast (5s) if the DB is unreachable so
 *    requests don't hang.
 *  - autoIndex only in dev: building indexes automatically is convenient
 *    in dev but expensive in production, where we build them intentionally.
 *  - strictQuery: guards against accidentally querying undefined fields.
 */
export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.mongoUri, {
      maxPoolSize: 20, // up to 20 pooled connections
      minPoolSize: 2, // keep a couple warm
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: !env.isProd, // build indexes automatically only in dev
    });

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    // Can't run without a database — exit so the platform restarts us.
    process.exit(1);
  }

  // Surface connection drops in logs (helps debugging in production).
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("✅ MongoDB reconnected");
  });
}

/**
 * Graceful shutdown — close the DB connection cleanly when the process
 * is terminated (e.g. on deploy). Prevents dangling connections.
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
}
