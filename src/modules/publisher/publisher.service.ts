import type { ContentPost } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../db/prisma.js";
import { publishFacebookPost } from "./meta.publisher.js";

export type PublishResult = {
  id: string;
  platform: string;
  status: "posted";
};

export async function publishPost(post: ContentPost): Promise<PublishResult> {
  let provider = "mock";
  let providerResponse: unknown = null;

  if (env.PUBLISHER_MODE === "meta" && post.platform === "facebook") {
    provider = "meta";
    providerResponse = await publishFacebookPost(post);
  } else {
    logger.info(
      {
        postId: post.id,
        platform: post.platform,
        imageUrl: post.image_url,
        caption: post.caption
      },
      "Mock publishing social post"
    );
  }

  const updated = await prisma.contentPost.update({
    where: { id: post.id },
    data: {
      status: "posted",
      published_at: new Date(),
      events: {
        create: {
          event_type: "published",
          metadata: {
            provider,
            platform: post.platform,
            providerResponse: providerResponse === null ? null : JSON.parse(JSON.stringify(providerResponse))
          }
        }
      }
    }
  });

  return {
    id: updated.id,
    platform: updated.platform,
    status: "posted"
  };
}
