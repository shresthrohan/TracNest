import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { requestSpecSchema } from "../validators/request.js";
import { executeRequest, type RequestSpec } from "../services/executor/execute.js";
import { redactHeaders, redactUrl, redactSpec, apiKeyHeaderName } from "../services/executor/redact.js";
import { Execution } from "../models/Execution.js";
import { HttpError } from "../utils/HttpError.js";

export async function runAndRecord(userId: string, spec: RequestSpec, extra: { requestId?: string; source?: "playground" | "suite" | "rerun" } = {}) {
  const r = await executeRequest(spec);
  return Execution.create({
    userId,
    requestId: extra.requestId,
    source: extra.source ?? "playground",
    request: redactSpec(spec),
    ok: r.ok,
    statusCode: r.statusCode,
    responseTime: r.timeMs,
    responseSize: r.size,
    responseBody: r.body,
    responseBodyTruncated: r.bodyTruncated,
    responseHeaders: redactHeaders(r.headers, apiKeyHeaderName(spec)),
    finalUrl: redactUrl(r.finalUrl, spec),
    redirects: r.redirects.map((u) => redactUrl(u, spec)),
    error: r.error,
  });
}

const bodySchema = z.object({ spec: requestSpecSchema, requestId: z.string().optional() });

const router = Router();
router.use(requireAuth);

router.post("/", async (req, res) => {
  const { spec, requestId } = bodySchema.parse(req.body);
  if (requestId && !Types.ObjectId.isValid(requestId)) throw new HttpError(404, "Not found", "NOT_FOUND");
  // TODO(task-8): verify requestId against SavedRequest owned by req.userId (404 otherwise); until then it is not trusted or stored.
  const ex = await runAndRecord(req.userId, spec as RequestSpec, { source: "playground" });
  res.status(201).json(ex);
});

export default router;
