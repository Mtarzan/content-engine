import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { runContentWorker } from "../worker/content.worker.js";
import { getSchedulerStatus } from "../worker/scheduler.js";
import { env } from "../../config/env.js";

export const adminRouter = Router();

const schedulerUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  interval_minutes: z.coerce.number().int().min(5).max(1440).optional(),
  batch_size: z.coerce.number().int().min(1).max(100).optional()
});

adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const [products, processedProducts, posts, pending, posted, aggregates, byPlatform, recentEvents] =
      await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { processed: true } }),
        prisma.contentPost.count(),
        prisma.contentPost.count({ where: { status: "pending" } }),
        prisma.contentPost.count({ where: { status: "posted" } }),
        prisma.contentPost.aggregate({
          _sum: {
            impressions: true,
            clicks: true,
            conversions: true,
            spend: true,
            revenue: true
          }
        }),
        prisma.contentPost.groupBy({
          by: ["platform"],
          _count: { _all: true },
          _sum: {
            impressions: true,
            clicks: true,
            conversions: true,
            revenue: true
          }
        }),
        prisma.postEvent.findMany({
          orderBy: { created_at: "desc" },
          take: 20,
          include: {
            post: {
              select: {
                id: true,
                platform: true,
                product: { select: { title: true } }
              }
            }
          }
        })
      ]);

    const impressions = aggregates._sum.impressions ?? 0;
    const clicks = aggregates._sum.clicks ?? 0;
    const conversions = aggregates._sum.conversions ?? 0;

    res.json({
      data: {
        products,
        processedProducts,
        posts,
        pending,
        posted,
        metrics: {
          impressions,
          clicks,
          conversions,
          spend: aggregates._sum.spend ?? 0,
          revenue: aggregates._sum.revenue ?? 0,
          ctr: impressions > 0 ? clicks / impressions : 0,
          conversionRate: clicks > 0 ? conversions / clicks : 0
        },
        byPlatform,
        recentEvents
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/scheduler", async (_req, res, next) => {
  try {
    res.json({ data: await getSchedulerStatus() });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/scheduler", async (req, res, next) => {
  try {
    const data = schedulerUpdateSchema.parse(req.body);
    const updated = await prisma.schedulerSetting.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/worker/run", async (req, res, next) => {
  try {
    const batchSize = z.object({ batch_size: z.coerce.number().int().min(1).max(100).optional() }).parse(req.body)
      .batch_size;
    await runContentWorker(batchSize);
    res.json({ data: { status: "completed" } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/products/:id/reset", async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { processed: false }
    });
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/integrations", async (_req, res) => {
  res.json({
    data: {
      publisherMode: env.PUBLISHER_MODE,
      facebook: {
        configured: Boolean(env.FACEBOOK_PAGE_ID && env.FACEBOOK_PAGE_ACCESS_TOKEN),
        pageId: env.FACEBOOK_PAGE_ID ? "configured" : "missing"
      },
      shopifyWebhooks: {
        signatureVerification: env.SHOPIFY_WEBHOOK_SECRET ? "enabled" : "disabled",
        ordersPaidEndpoint: `${env.OPENAI_REFERER ?? ""}/webhooks/shopify/orders-paid`
      }
    }
  });
});
