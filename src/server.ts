import { createApp } from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { env } from "./config/env";

/**
 * Server bootstrap.
 * Order: connect DB first (fail fast if it's down), then start listening.
 */
async function start() {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`🚀 Placely API running on port ${env.port} [${env.nodeEnv}]`);
  });

  /**
   * Graceful shutdown — on SIGTERM/SIGINT (deploys, Ctrl+C), stop taking
   * new requests, finish in-flight ones, close the DB, then exit. Prevents
   * dropped requests and dangling DB connections during redeploys.
   */
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if it hangs too long.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
