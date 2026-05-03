import OpenAI from "openai";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export const imagesRouter = Router();

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SHOPIFY_STORE = env.SHOPIFY_STORE_URL.replace(/\/$/, "");
const SHOPIFY_TOKEN = env.SHOPIFY_ADMIN_TOKEN;
const SHOPIFY_VERSION = "2025-10";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// ── Supabase helpers ────────────────────────────────────────────────────────
async function sbQuery(filter = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_images${filter ? "?" + filter : ""}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status}`);
  return res.json();
}

async function sbInsert(rows: Record<string, unknown>[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_images`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${res.status}`);
  return res.json();
}

async function sbUpdate(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_images?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbStorageUpload(filename: string, imageBuffer: Buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${filename}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "true"
    },
    body: imageBuffer as unknown as BodyInit
  });
  const data = (await res.json()) as { error?: string };
  if (data.error) throw new Error(`Storage upload failed: ${data.error}`);
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${filename}`;
}

// ── Shopify helpers ──────────────────────────────────────────────────────────
async function fetchShopifyProduct(productId: string) {
  const url = `${SHOPIFY_STORE}/admin/api/${SHOPIFY_VERSION}/products/${productId}.json`;
  const res = await fetch(url, { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } });
  if (!res.ok) throw new Error(`Shopify product fetch failed: ${res.status}`);
  const data = (await res.json()) as { product?: Record<string, unknown> };
  if (!data.product) throw new Error("Product not found");
  return data.product;
}

async function uploadToShopify(productId: string | number, imageUrl: string, imageType: string) {
  const url = `${SHOPIFY_STORE}/admin/api/${SHOPIFY_VERSION}/products/${productId}/images.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      image: { src: imageUrl, alt: `${imageType} photo`, position: imageType === "lifestyle" ? 1 : undefined }
    })
  });
  const data = (await res.json()) as { image?: { id: number } };
  if (!data.image) throw new Error(`Shopify upload failed: ${JSON.stringify(data)}`);
  return data.image;
}

// ── Prompt builder ───────────────────────────────────────────────────────────
type PromptSpec = { type: string; size: "1024x1536" | "1024x1024"; prompt: string };

function buildPrompts(product: Record<string, unknown>): PromptSpec[] {
  const title = String(product.title || "");
  const type  = String(product.product_type || "").toLowerCase();
  const tags  = String(product.tags || "").toLowerCase();

  const isBag   = type.includes("bag") || type.includes("tote") || tags.includes("tote");
  const isLayer = type.includes("hoodie") || type.includes("sweatshirt") || type.includes("jacket");

  const wearVerb   = isBag ? "carrying" : "wearing";
  const wearDetail = isBag
    ? "slung over one shoulder, bag resting naturally at the hip"
    : isLayer
    ? "relaxed, hood down, sleeves slightly pushed up"
    : "tucked loosely into high-waist pants or worn with jeans";

  const variants = product.variants as Array<{ option1?: string }> | undefined;
  const colorHint = variants?.[0]?.option1 ? ` in ${variants[0].option1}` : "";
  const desc = `${title}${colorHint}`;

  const accuracy = "Preserve the exact product shape, color, logo placement, fabric texture, and structure.";
  const ugc      = "Authentic phone-camera quality. Natural light. Slightly imperfect framing. Real TikTok/Instagram UGC aesthetic.";

  return [
    { type: "lifestyle", size: "1024x1536", prompt: `Realistic lifestyle photo of a stylish young adult ${wearVerb} a ${desc} ${wearDetail}. Casual city street or coffee shop, golden hour natural light. ${ugc} ${accuracy} Vertical portrait.` },
    { type: "mirror",    size: "1024x1536", prompt: `Realistic phone mirror selfie of a person ${wearVerb} a ${desc}. Bedroom or bathroom, soft natural light from a side window, phone visible in reflection. Candid, unstaged. ${ugc} ${accuracy}` },
    { type: "closeup",   size: "1024x1024", prompt: `Close-up detail shot of a ${desc} showing fabric texture, stitching quality, and material finish. Shallow depth of field, natural light, phone macro aesthetic. ${accuracy} Square crop.` },
    { type: "context",   size: "1024x1024", prompt: `Lifestyle flat-lay of a ${desc} on a cafe table alongside a coffee cup, phone, and keys. Minimal arrangement, natural light from above. ${ugc} ${accuracy} Square.` },
    { type: "clean",     size: "1024x1024", prompt: `Clean product photo of a ${desc} on a soft off-white linen background. Simple overhead natural light, no shadows, web-ready. ${accuracy} Square.` },
  ];
}

// ── Routes ───────────────────────────────────────────────────────────────────
const statusQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "uploaded"]).optional()
});

imagesRouter.get("/", async (req, res, next) => {
  try {
    const { status } = statusQuerySchema.parse(req.query);
    const filter = status ? `status=eq.${status}&order=created_at.desc` : "order=created_at.desc";
    const rows = await sbQuery(filter);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

imagesRouter.post("/generate", async (req, res, next) => {
  try {
    const { productId } = z.object({ productId: z.string().min(1) }).parse(req.body);

    const product = await fetchShopifyProduct(productId);
    const handle  = String(product.handle || productId);

    // Skip if already has pending/approved images
    const existing = await sbQuery(`product_id=eq.${productId}&status=neq.rejected`);
    if (Array.isArray(existing) && existing.length >= 4) {
      res.json({ data: existing, message: "Already has images — returning existing" });
      return;
    }

    const prompts = buildPrompts(product);
    const rows: Record<string, unknown>[] = [];

    for (const p of prompts) {
      try {
        logger.info({ productId, type: p.type }, "Generating image");
        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: p.prompt,
          n: 1,
          size: p.size,
          quality: "high",
          output_format: "jpeg"
        } as Parameters<typeof openai.images.generate>[0]);

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned");

        const imgBuffer = Buffer.from(b64, "base64");
        const filename  = `${handle}-${p.type}-${Date.now()}.jpg`;
        const publicUrl = await sbStorageUpload(filename, imgBuffer);

        rows.push({
          product_id:       Number(productId),
          product_handle:   handle,
          image_type:       p.type,
          prompt:           p.prompt,
          generated_url:    publicUrl,
          status:           "pending",
          shopify_uploaded: false
        });

        logger.info({ productId, type: p.type }, "Image generated and stored");
      } catch (err) {
        logger.error({ productId, type: p.type, err }, "Image generation failed");
      }
    }

    const saved = rows.length > 0 ? await sbInsert(rows) : [];
    res.json({ data: saved, generated: rows.length, total: prompts.length });
  } catch (error) {
    next(error);
  }
});

imagesRouter.patch("/:id/approve", async (req, res, next) => {
  try {
    const rows = await sbQuery(`id=eq.${req.params.id}`);
    const record = Array.isArray(rows) ? rows[0] : null;
    if (!record) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    if (record.status === "uploaded") {
      res.status(409).json({ error: "Already uploaded to Shopify" });
      return;
    }

    const shopifyImage = await uploadToShopify(record.product_id, record.generated_url, record.image_type);
    const updated = await sbUpdate(record.id, {
      status: "uploaded",
      shopify_uploaded: true,
      shopify_image_id: String(shopifyImage.id)
    });

    logger.info({ productId: record.product_id, imageType: record.image_type, shopifyId: shopifyImage.id }, "Image approved and uploaded");
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

imagesRouter.patch("/:id/reject", async (req, res, next) => {
  try {
    const updated = await sbUpdate(req.params.id, { status: "rejected" });
    if (!updated) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});
