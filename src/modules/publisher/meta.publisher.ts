import type { ContentPost } from "@prisma/client";
import { env } from "../../config/env.js";

type MetaPublishResponse = {
  id?: string;
  post_id?: string;
};

function assertMetaConfig() {
  if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    throw new Error("Facebook publishing is not configured");
  }
}

export async function publishFacebookPost(post: ContentPost): Promise<MetaPublishResponse> {
  assertMetaConfig();

  const base = `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.FACEBOOK_PAGE_ID}`;
  const params = new URLSearchParams();
  params.set("access_token", env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "");
  params.set("message", post.caption);

  if (post.image_url) {
    params.set("url", post.image_url);
    const response = await fetch(`${base}/photos`, {
      method: "POST",
      body: params
    });

    if (!response.ok) {
      throw new Error(`Facebook photo publish failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as MetaPublishResponse;
  }

  const response = await fetch(`${base}/feed`, {
    method: "POST",
    body: params
  });

  if (!response.ok) {
    throw new Error(`Facebook feed publish failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as MetaPublishResponse;
}
