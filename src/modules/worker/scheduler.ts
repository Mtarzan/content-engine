import { logger } from "../../config/logger.js";
import { prisma } from "../db/prisma.js";
import { runContentWorker } from "./content.worker.js";

let running = false;
let timer: NodeJS.Timeout | null = null;
let lastRunAt: Date | null = null;

async function getSchedulerSetting() {
  return prisma.schedulerSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {}
  });
}

async function tickScheduler() {
  const setting = await getSchedulerSetting();
  if (!setting.enabled) return;

  const dueAt = lastRunAt
    ? new Date(lastRunAt.getTime() + setting.interval_minutes * 60_000)
    : new Date(0);

  if (Date.now() < dueAt.getTime()) return;

  if (running) {
    logger.warn("Content worker skipped because a previous run is still active");
    return;
  }

  running = true;
  try {
    await runContentWorker(setting.batch_size);
    lastRunAt = new Date();
  } catch (error) {
    logger.error({ error }, "Scheduled content worker failed");
  } finally {
    running = false;
  }
}

export function startContentWorkerScheduler(): void {
  timer = setInterval(() => {
    void tickScheduler();
  }, 60_000);
  void tickScheduler();

  logger.info("Content worker scheduler started");
}

export async function getSchedulerStatus() {
  const setting = await getSchedulerSetting();
  return {
    ...setting,
    running,
    last_run_at: lastRunAt,
    next_run_at:
      setting.enabled && lastRunAt
        ? new Date(lastRunAt.getTime() + setting.interval_minutes * 60_000)
        : null
  };
}

export function stopContentWorkerScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
