import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/error.js";
import { HttpError } from "./utils/HttpError.js";
import authRoutes from "./routes/auth.js";
import executeRoutes from "./routes/execute.js";
import historyRoutes from "./routes/history.js";
import dashboardRoutes from "./routes/dashboard.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.get("/api/health", (_req, res) => void res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/execute", executeRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use((_req, _res, next) => next(new HttpError(404, "Not found", "NOT_FOUND")));
  app.use(errorHandler);
  return app;
}
