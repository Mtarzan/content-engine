import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { publishPost } from "../publisher/publisher.service.js";

export const postsRouter = Router();

const statusQuerySchema = z.object({
  status: z.enum(["pending", "posted"]).optional()
});

const updatePostSchema = z.object({
  platform: z.string().min(1).max(40).optional(),
  caption: z.string().min(1).max(4000).optional(),
  image_url: z.string().url().nullable().optional(),
  asset_type: z.enum(["text", "image", "video"]).optional(),
  status: z.enum(["pending", "posted"]).optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
  impressions: z.coerce.number().int().min(0).optional(),
  clicks: z.coerce.number().int().min(0).optional(),
  conversions: z.coerce.number().int().min(0).optional(),
  spend: z.coerce.number().min(0).optional(),
  revenue: z.coerce.number().min(0).optional()
});

postsRouter.get("/", async (req, res, next) => {
  try {
    const query = statusQuerySchema.parse(req.query);
    const posts = await prisma.contentPost.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { created_at: "desc" },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            image_url: true,
            product_url: true
          }
        }
      }
    });

    res.json({ data: posts });
  } catch (error) {
    next(error);
  }
});

postsRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = updatePostSchema.parse(req.body);
    const updated = await prisma.contentPost.update({
      where: { id: req.params.id },
      data: {
        ...data,
        scheduled_for:
          data.scheduled_for === undefined
            ? undefined
            : data.scheduled_for
              ? new Date(data.scheduled_for)
              : null
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            image_url: true,
            product_url: true
          }
        }
      }
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

postsRouter.post("/:id/publish", async (req, res, next) => {
  try {
    const post = await prisma.contentPost.findUnique({
      where: { id: req.params.id }
    });

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    if (post.status === "posted") {
      res.status(409).json({ error: "Post is already posted" });
      return;
    }

    const result = await publishPost(post);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
