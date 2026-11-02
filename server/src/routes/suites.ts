import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { TestSuite } from "../models/TestSuite.js";
import { Execution, oid } from "../models/Execution.js";
import { evaluate, type Assertion, type AssertionResult } from "../services/assertions.js";
import { diffBodies } from "../services/diff.js";
import { runAndRecord } from "./execute.js";
import { ownedRequest } from "./requests.js";
import { requestSpecSchema } from "../validators/request.js";
import { HttpError } from "../utils/HttpError.js";
import type { RequestSpec } from "../services/executor/execute.js";

const router = Router();
router.use(requireAuth);

const assertionSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["status", "maxTime", "exists", "equals", "type", "contains"]),
  path: z.string().max(500).optional(),
  expected: z.unknown().optional(),
});
const fields = z.object({ name: z.string().trim().min(1).max(100), assertions: z.array(assertionSchema).max(100) });

async function owned(userId: string, id: string) {
  const s = await TestSuite.findOne({ _id: id, userId: oid(userId) });
  if (!s) throw new HttpError(404, "Not found", "NOT_FOUND");
  return s;
}

router.get("/", async (req, res) => {
  const { requestId } = z.object({ requestId: z.string().optional() }).parse(req.query);
  res.json(await TestSuite.find({ userId: oid(req.userId), ...(requestId && { requestId }) }).sort({ createdAt: 1 }));
});

router.post("/", async (req, res) => {
  const d = fields.extend({ requestId: z.string() }).parse(req.body);
  const r = await ownedRequest(req.userId, d.requestId);
  res.status(201).json(await TestSuite.create({ ...d, requestId: r._id, userId: r.userId }));
});

router.get("/:id", async (req, res) => {
  res.json(await owned(req.userId, req.params.id));
});

router.patch("/:id", async (req, res) => {
  const d = fields.partial().parse(req.body);
  const s = await owned(req.userId, req.params.id);
  s.set(d);
  res.json(await s.save());
});

router.delete("/:id", async (req, res) => {
  await (await owned(req.userId, req.params.id)).deleteOne();
  res.json({ ok: true });
});

type LastRun = { executionId: string; results: AssertionResult[] };

router.post("/:id/run", async (req, res) => {
  const { only } = z.object({ only: z.literal("failed").optional() }).parse(req.query);
  const suite = await owned(req.userId, req.params.id);
  const saved = await ownedRequest(req.userId, String(suite.requestId));
  const prev = suite.lastRun as LastRun | undefined;
  const prevExec = prev ? await Execution.findOne({ _id: prev.executionId, userId: suite.userId }) : null;

  const started = Date.now();
  const ex = await runAndRecord(req.userId, requestSpecSchema.parse(saved.spec) as RequestSpec, { requestId: String(saved._id), source: "suite" });

  const all = suite.assertions as Assertion[];
  const failedBefore = new Set(prev?.results.filter((r) => !r.passed).map((r) => r.id));
  const toRun = only && prev ? all.filter((a) => failedBefore.has(a.id)) : all;
  const fresh = new Map(evaluate(toRun, { ...ex.toObject(), statusCode: ex.statusCode ?? undefined }).map((r) => [r.id, r]));
  // only=failed keeps previous results for the assertions it skipped
  const prevById = new Map(prev?.results.map((r) => [r.id, r]));
  const results = all.map((a) => fresh.get(a.id) ?? prevById.get(a.id)).filter((r): r is AssertionResult => !!r);

  const lastRun: Record<string, unknown> = {
    executionId: String(ex._id),
    results,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    durationMs: Date.now() - started,
    ranAt: new Date(),
  };
  if (prev && prevExec) {
    const passedBefore = new Set(prev.results.filter((r) => r.passed).map((r) => r.id));
    lastRun.regression = {
      changes: diffBodies(prevExec.responseBody, ex.responseBody).changes,
      newlyFailing: results.filter((r) => !r.passed && passedBefore.has(r.id)).map((r) => r.id),
    };
  }
  suite.lastRun = lastRun;
  res.json(await suite.save());
});

export default router;
