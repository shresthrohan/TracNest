import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Execution, oid } from "../models/Execution.js";
import { diffBodies } from "../services/diff.js";
import { HttpError } from "../utils/HttpError.js";

const router = Router();
router.use(requireAuth);

const q = z.object({ a: z.string().min(1), b: z.string().min(1) });
const summary = (e: InstanceType<typeof Execution>) => ({
  id: String(e._id),
  method: e.request?.method,
  url: e.request?.url,
  statusCode: e.statusCode,
  ok: e.ok,
  responseTime: e.responseTime,
  responseSize: e.responseSize,
  executedAt: e.executedAt,
});

router.get("/", async (req, res) => {
  const { a, b } = q.parse(req.query);
  const [ea, eb] = await Promise.all([a, b].map((id) => Execution.findOne({ _id: id, userId: oid(req.userId) })));
  if (!ea || !eb) throw new HttpError(404, "Not found", "NOT_FOUND");
  const { bodyKind, changes } = diffBodies(ea.responseBody, eb.responseBody);
  res.json({
    a: summary(ea),
    b: summary(eb),
    changes,
    bodyKind,
    ...(ea.statusCode !== eb.statusCode && { status: { before: ea.statusCode, after: eb.statusCode } }),
  });
});

export default router;
