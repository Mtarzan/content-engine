import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { ZodError } from "zod";
import { allowedOrigins, env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requireAdminApiKey } from "./middleware/adminAuth.js";
import { prisma } from "./modules/db/prisma.js";
import { postsRouter } from "./modules/posts/posts.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        if (env.NODE_ENV !== "production" && allowedOrigins.length === 0) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin denied"));
      }
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(pinoHttp({ logger }));

  app.get("/health", async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "ok" });
    } catch (error) {
      next(error);
    }
  });

  app.use("/posts", requireAdminApiKey, postsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    logger.error({ error }, "Unhandled request error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
