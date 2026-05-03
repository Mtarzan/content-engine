import type { ContentPost } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { prisma } from "../db/prisma.js";

export type PublishResult = {
  id: string;
  platform: string;
  status: "posted";
};

export async function publishPost(post: ContentPost): Promise<PublishResult> {
  logger.info(
    {
      postId: post.id,
      platform: post.platform,
      imageUrl: post.image_url,
      caption: post.caption
    },
    "Mock publishing social post"
  );

  const updated = await prisma.contentPost.update({
    where: { id: post.id },
    data: { status: "posted" }
  });

  return {
    id: updated.id,
    platform: updated.platform,
    status: "posted"
  };
}
