import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: [
    "req.headers.authorization",
    "SHOPIFY_ADMIN_TOKEN",
    "SHOPIFY_WEBHOOK_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "FACEBOOK_PAGE_ACCESS_TOKEN",
    "req.headers.x-admin-api-key",
    "req.headers.x-shopify-hmac-sha256"
  ],
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname"
          }
        }
});
