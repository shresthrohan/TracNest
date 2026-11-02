import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/HttpError.js";

declare module "express-serve-static-core" {
  interface Request {
    userId: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const token = req.cookies?.tn_token;
    if (!token) throw new Error();
    const p = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.userId = p.sub;
    next();
  } catch {
    next(new HttpError(401, "Not authenticated", "UNAUTHENTICATED"));
  }
};
