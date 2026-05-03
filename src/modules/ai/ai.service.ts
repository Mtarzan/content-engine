import OpenAI from "openai";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { GeneratedContent, ProductForGeneration } from "./ai.types.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

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
  const response = await openai.responses.create({
    model: env.OPENAI_MODEL,
    input: [
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
    text: {
      format: {
        type: "json_schema",
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

  const parsedJson = JSON.parse(response.output_text);
  return generatedContentSchema.parse(parsedJson);
}
