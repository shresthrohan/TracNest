import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { HttpError } from "../utils/HttpError.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: { message: err.message, code: err.code } });
  if (err instanceof ZodError)
    return void res.status(400).json({ error: { message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), code: "VALIDATION" } });
  if (err instanceof mongoose.Error.CastError) return void res.status(404).json({ error: { message: "Not found", code: "NOT_FOUND" } });
  if (err?.type === "entity.too.large") return void res.status(413).json({ error: { message: "Payload too large", code: "TOO_LARGE" } });
  if (err?.type === "entity.parse.failed") return void res.status(400).json({ error: { message: "Invalid JSON", code: "VALIDATION" } });
  console.error(err);
  res.status(500).json({ error: { message: "Internal server error", code: "INTERNAL" } });
};
