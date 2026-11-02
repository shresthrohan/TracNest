import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Execution, oid } from "../models/Execution.js";
import { runAndRecord } from "./execute.js";
import { SavedRequest } from "../models/SavedRequest.js";
import { HttpError } from "../utils/HttpError.js";
import type { RequestSpec } from "../services/executor/execute.js";
import { hasRedacted } from "../services/executor/redact.js";
import { requestSpecSchema } from "../validators/request.js";

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  status: z.enum(["2xx", "3xx", "4xx", "5xx", "error"]).optional(),
  q: z.string().max(200).optional(),
  requestId: z.string().regex(/^[0-9a-f]{24}$/i).optional(),
});

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req, res) => {
  const { page, limit, method, status, q, requestId } = listQuery.parse(req.query);
  const filter: Record<string, unknown> = { userId: oid(req.userId) };
  if (requestId) filter.requestId = oid(requestId);
  if (method) filter["request.method"] = method;
  if (q) filter["request.url"] = { $regex: escapeRe(q), $options: "i" };
  if (status === "error") filter.error = { $exists: true };
  else if (status) {
    const d = Number(status[0]) * 100;
    filter.statusCode = { $gte: d, $lt: d + 100 };
  }
  const [items, total] = await Promise.all([
    Execution.find(filter, { responseBody: 0 }).sort({ executedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Execution.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

async function owned(userId: string, id: string) {
  const ex = await Execution.findOne({ _id: id, userId: oid(userId) });
  if (!ex) throw new HttpError(404, "Not found", "NOT_FOUND");
  return ex;
}

router.get("/:id", async (req, res) => {
  res.json(await owned(req.userId, req.params.id));
});

router.delete("/:id", async (req, res) => {
  const ex = await owned(req.userId, req.params.id);
  await ex.deleteOne();
  res.json({ ok: true });
});

router.post("/:id/rerun", async (req, res) => {
  const ex = await owned(req.userId, req.params.id);
  // A saved request holds the real credentials; the stored execution spec is redacted.
  const saved = ex.requestId ? await SavedRequest.findOne({ _id: ex.requestId, userId: oid(req.userId) }) : null;
  if (!saved && hasRedacted(ex.request))
    throw new HttpError(409, "This request had secrets that were not stored. Open it in the Playground and re-enter them.", "NEEDS_SECRETS");
  const spec = requestSpecSchema.parse(saved ? saved.spec : ex.request) as RequestSpec;
  const rerun = await runAndRecord(req.userId, spec, { requestId: ex.requestId?.toString(), source: "rerun" });
  res.status(201).json(rerun);
});

export default router;
