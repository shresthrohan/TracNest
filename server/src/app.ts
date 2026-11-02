import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/error.js";
import { env } from "./config/env.js";
import { HttpError } from "./utils/HttpError.js";
import authRoutes from "./routes/auth.js";
import executeRoutes from "./routes/execute.js";
import historyRoutes from "./routes/history.js";
import dashboardRoutes from "./routes/dashboard.js";
import collectionRoutes from "./routes/collections.js";
import requestRoutes from "./routes/requests.js";
import suiteRoutes from "./routes/suites.js";
import diffRoutes from "./routes/diff.js";
import monitorRoutes from "./routes/monitors.js";
import aiRoutes from "./routes/ai.js";
import { globalLimiter, executeLimiter, type Limits } from "./middleware/limits.js";

export function createApp(limits: Limits = {}) {
  const app = express();
  if (env.NODE_ENV === "production") app.set("trust proxy", 1); // Render sits behind a proxy
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", globalLimiter(limits.globalMax));
  app.get("/api/health", (_req, res) => void res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/execute", executeLimiter(limits.executeMax), executeRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/collections", collectionRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/suites", suiteRoutes);
  app.use("/api/diff", diffRoutes);
  app.use("/api/monitors", monitorRoutes);
  app.use("/api/ai", aiRoutes);
  app.use((_req, _res, next) => next(new HttpError(404, "Not found", "NOT_FOUND")));
  app.use(errorHandler);
  return app;
}
