import { logger } from "./config/logger.js";
import { prisma } from "./modules/db/prisma.js";
import { runContentWorker } from "./modules/worker/content.worker.js";

try {
  await runContentWorker();
} catch (error) {
  logger.error({ error }, "Manual content worker run failed");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
