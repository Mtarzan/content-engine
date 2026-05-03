import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../db/prisma.js";
import type { ShopifyProductsResponse } from "./shopify.types.js";

const PRODUCTS_PATH = "/admin/api/2024-01/products.json";

function shopifyUrl(): URL {
  const base = env.SHOPIFY_STORE_URL.endsWith("/")
    ? env.SHOPIFY_STORE_URL.slice(0, -1)
    : env.SHOPIFY_STORE_URL;
  return new URL(PRODUCTS_PATH, base);
}

function stripHtml(value: string | null): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchShopifyProducts(): Promise<ShopifyProductsResponse["products"]> {
  const url = shopifyUrl();
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify products fetch failed: ${response.status} ${response.statusText} ${body}`);
  }

  const data = (await response.json()) as ShopifyProductsResponse;
  if (!Array.isArray(data.products)) {
    throw new Error("Shopify response did not include a products array");
  }

  return data.products;
}

export async function syncShopifyProducts(): Promise<number> {
  const products = await fetchShopifyProducts();

  for (const product of products) {
    const firstVariant = product.variants[0];
    const firstImage = product.images[0];

    await prisma.product.upsert({
      where: { id: String(product.id) },
      create: {
        id: String(product.id),
        title: product.title,
        description: stripHtml(product.body_html),
        price: new Prisma.Decimal(firstVariant?.price ?? "0"),
        image_url: firstImage?.src ?? null
      },
      update: {
        title: product.title,
        description: stripHtml(product.body_html),
        price: new Prisma.Decimal(firstVariant?.price ?? "0"),
        image_url: firstImage?.src ?? null
      }
    });
  }

  logger.info({ count: products.length }, "Shopify products synced");
  return products.length;
}
