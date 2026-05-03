import { Router, raw } from "express";
import rateLimit from "express-rate-limit";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../db/prisma.js";

export const shopifyWebhookRouter = Router();

shopifyWebhookRouter.use(
  "/webhooks/shopify",
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

type ShopifyOrderPayload = {
  id?: number;
  total_price?: string;
  landing_site?: string | null;
  referring_site?: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
};

function verifyShopifyHmac(body: Buffer, hmacHeader: string | undefined): boolean {
  if (!env.SHOPIFY_WEBHOOK_SECRET) return true;
  if (!hmacHeader) return false;

  const digest = createHmac("sha256", env.SHOPIFY_WEBHOOK_SECRET).update(body).digest("base64");
  const left = Buffer.from(digest);
  const right = Buffer.from(hmacHeader);
  return left.length === right.length && timingSafeEqual(left, right);
}

function findPostId(order: ShopifyOrderPayload): string | null {
  const candidates = [order.landing_site, order.referring_site].filter(Boolean) as string[];
  for (const attr of order.note_attributes ?? []) {
    if (attr.name === "ce_post_id") return attr.value;
    candidates.push(attr.value);
  }

  for (const value of candidates) {
    try {
      const url = new URL(value, env.SHOPIFY_STORE_URL);
      const postId = url.searchParams.get("ce_post_id");
      if (postId) return postId;
    } catch {
      continue;
    }
  }

  return null;
}

shopifyWebhookRouter.post("/webhooks/shopify/orders-paid", raw({ type: "application/json" }), async (req, res, next) => {
  try {
const body = req.body as Buffer;
    if (!Buffer.isBuffer(body)) {
      res.status(400).json({ error: "Invalid webhook body" });
      return;
    }
    if (!verifyShopifyHmac(body, req.header("x-shopify-hmac-sha256"))) {
      res.status(401).json({ error: "Invalid Shopify webhook signature" });
      return;
    }

    const order = JSON.parse(body.toString("utf8")) as ShopifyOrderPayload;
    const postId = findPostId(order);

    if (!postId) {
      logger.info({ orderId: order.id }, "Shopify order webhook had no content-engine attribution");
      res.status(202).json({ data: { attributed: false } });
      return;
    }

    const revenue = Number(order.total_price ?? 0);
    await prisma.contentPost.update({
      where: { id: postId },
      data: {
        conversions: { increment: 1 },
        revenue: { increment: revenue },
        events: {
          create: {
            event_type: "conversion",
            metadata: {
              provider: "shopify",
              orderId: order.id,
              revenue
            }
          }
        }
      }
    });

    res.json({ data: { attributed: true, postId } });
  } catch (error) {
    next(error);
  }
});
