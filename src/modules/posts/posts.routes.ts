import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { publishPost } from "../publisher/publisher.service.js";

export const postsRouter = Router();

const statusQuerySchema = z.object({
  status: z.enum(["pending", "posted"]).optional()
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
            price: true
          }
        }
      }
    });

    res.json({ data: posts });
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
