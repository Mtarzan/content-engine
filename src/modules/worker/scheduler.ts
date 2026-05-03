import cron from "node-cron";
import { logger } from "../../config/logger.js";
import { runContentWorker } from "./content.worker.js";

let running = false;

export function startContentWorkerScheduler(): void {
  cron.schedule("*/30 * * * *", async () => {
    if (running) {
      logger.warn("Content worker skipped because a previous run is still active");
      return;
    }

    running = true;
    try {
      await runContentWorker();
    } catch (error) {
      logger.error({ error }, "Scheduled content worker failed");
    } finally {
      running = false;
    }
  });

  logger.info("Content worker scheduled for every 30 minutes");
}
