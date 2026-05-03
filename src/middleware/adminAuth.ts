import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.header("x-admin-api-key");

  if (!providedKey || !safeCompare(providedKey, env.ADMIN_API_KEY)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
