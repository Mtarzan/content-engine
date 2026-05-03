import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { prisma } from "../db/prisma.js";

export const trackingRouter = Router();

trackingRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

trackingRouter.get("/r/:id", async (req, res, next) => {
  try {
    const post = await prisma.contentPost.update({
      where: { id: req.params.id },
      data: {
        clicks: { increment: 1 },
        events: {
          create: {
            event_type: "click",
            metadata: {
              userAgent: req.header("user-agent") ?? null,
              referrer: req.header("referer") ?? null
            }
          }
        }
      },
      include: {
        product: {
          select: {
            product_url: true
          }
        }
      }
    });

    const fallback = new URL(env.SHOPIFY_STORE_URL);
    const destination = new URL(post.product.product_url ?? fallback.toString(), fallback);
    if (destination.hostname !== fallback.hostname) {
      destination.hostname = fallback.hostname;
      destination.protocol = fallback.protocol;
      destination.port = fallback.port;
    }
    destination.searchParams.set("ce_post_id", post.id);
    destination.searchParams.set("utm_source", post.platform);
    destination.searchParams.set("utm_medium", "social");
    destination.searchParams.set("utm_campaign", "content_engine");

    res.redirect(destination.toString());
  } catch (error) {
    next(error);
  }
});

trackingRouter.post("/track/:id/impression", async (req, res, next) => {
  try {
    await prisma.contentPost.update({
      where: { id: req.params.id },
      data: {
        impressions: { increment: 1 },
        events: {
          create: {
            event_type: "impression",
            metadata: {
              referrer: req.header("referer") ?? null
            }
          }
        }
      }
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
