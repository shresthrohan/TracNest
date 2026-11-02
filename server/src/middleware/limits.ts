import type { Request } from "express";
import jwt from "jsonwebtoken";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import { HttpError } from "../utils/HttpError.js";

export type Limits = { globalMax?: number; executeMax?: number };

// user id when the cookie verifies, else client IP
function key(req: Request): string {
  try {
    const p = jwt.verify(req.cookies?.tn_token, env.JWT_SECRET) as { sub: string };
    return "u:" + p.sub;
  } catch {
    return "ip:" + ipKeyGenerator(req.ip ?? "");
  }
}

const relaxed = env.NODE_ENV === "test" ? 1_000_000 : undefined;

// ponytail: in-memory stores, per-process; use a shared store if scaled out
const make = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: key,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_q, _r, next) => next(new HttpError(429, "Too many requests", "RATE_LIMITED")),
  });

export const globalLimiter = (max?: number) => make(15 * 60 * 1000, max ?? relaxed ?? 300);
export const executeLimiter = (max?: number) => make(60 * 1000, max ?? relaxed ?? 60);
