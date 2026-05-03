import { logger } from "../../config/logger.js";
import { prisma } from "../db/prisma.js";
import { generateContent } from "../ai/ai.service.js";
import { syncShopifyProducts } from "../shopify/shopify.service.js";

export async function runContentWorker(batchSize = 25): Promise<void> {
  logger.info("Content worker run started");
  const syncedCount = await syncShopifyProducts();

  const products = await prisma.product.findMany({
    where: { processed: false },
    orderBy: { created_at: "asc" },
    take: batchSize
  });

  for (const product of products) {
    try {
      const generated = await generateContent(product);

      await prisma.$transaction(async (tx) => {
        await tx.contentPost.createMany({
          data: generated.posts.map((post) => ({
            product_id: product.id,
            platform: post.platform,
            caption: `${post.hook}\n\n${post.caption}\n\n${post.cta}`,
            image_url: product.image_url,
            asset_type: product.image_url ? "image" : "text",
            status: "pending"
          }))
        });

        await tx.product.update({
          where: { id: product.id },
          data: { processed: true }
        });
      });

      logger.info({ productId: product.id, posts: generated.posts.length }, "Product processed");
    } catch (error) {
      logger.error({ productId: product.id, error }, "Product processing failed");
    }
  }

  logger.info({ syncedCount, processedCount: products.length }, "Content worker run finished");
}
