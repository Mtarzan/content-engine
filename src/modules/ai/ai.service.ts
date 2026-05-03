import OpenAI from "openai";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { GeneratedContent, ProductForGeneration } from "./ai.types.js";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
  defaultHeaders: {
    ...(env.OPENAI_REFERER ? { "HTTP-Referer": env.OPENAI_REFERER } : {}),
    "X-Title": env.OPENAI_TITLE
  }
});

const generatedContentSchema = z.object({
  posts: z
    .array(
      z.object({
        platform: z.enum(["instagram", "facebook", "tiktok"]),
        hook: z.string().min(1),
        caption: z.string().min(1),
        cta: z.string().min(1)
      })
    )
    .length(3)
});

export async function generateContent(product: ProductForGeneration): Promise<GeneratedContent> {
  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You create concise ecommerce social media content. Return exactly three posts, one each for instagram, facebook, and tiktok."
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price.toString(),
            image_url: product.image_url
          },
          requirements: {
            tone: "direct, benefit-led, conversion-focused",
            avoid: ["unverifiable claims", "medical claims", "fake discounts"],
            caption_max_characters: 280
          }
        })
      }
    ],
    response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_social_posts",
          strict: true,
          schema: {
          type: "object",
          additionalProperties: false,
          required: ["posts"],
          properties: {
            posts: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["platform", "hook", "caption", "cta"],
                properties: {
                  platform: { type: "string", enum: ["instagram", "facebook", "tiktok"] },
                  hook: { type: "string" },
                  caption: { type: "string" },
                  cta: { type: "string" }
                }
              }
            }
          }
          }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned an empty content response");
  }

  const parsedJson = JSON.parse(content);
  return generatedContentSchema.parse(parsedJson);
}
