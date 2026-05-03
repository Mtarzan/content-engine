import type { Product } from "@prisma/client";

export type ProductForGeneration = Pick<Product, "id" | "title" | "description" | "price" | "image_url">;

export type GeneratedPost = {
  platform: "instagram" | "facebook" | "tiktok";
  hook: string;
  caption: string;
  cta: string;
};

export type GeneratedContent = {
  posts: GeneratedPost[];
};
