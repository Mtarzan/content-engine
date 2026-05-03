import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createApp } from "./app.js";
import { startContentWorkerScheduler } from "./modules/worker/scheduler.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Content Engine API listening");
});

if (env.WORKER_ENABLED) {
  startContentWorkerScheduler();
}

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
