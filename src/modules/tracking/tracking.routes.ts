import { Router } from "express";
import { prisma } from "../db/prisma.js";

export const trackingRouter = Router();

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

    res.redirect(post.product.product_url ?? "/");
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
