import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Execution, oid } from "../models/Execution.js";
import { aiEnabled, explain } from "../services/ai.js";
import { HttpError } from "../utils/HttpError.js";

const router = Router();
router.use(requireAuth);

router.get("/status", (_req, res) => void res.json({ enabled: aiEnabled() }));

const bodySchema = z.object({ executionId: z.string().regex(/^[a-f\d]{24}$/i) });

router.post("/explain", async (req, res) => {
  if (!aiEnabled()) throw new HttpError(503, "AI assistant is not configured", "AI_DISABLED");
  const { executionId } = bodySchema.parse(req.body);
  const ex = await Execution.findOne({ _id: oid(executionId), userId: oid(req.userId) }).lean();
  if (!ex) throw new HttpError(404, "Not found", "NOT_FOUND");
  res.json(await explain(ex as never));
});

export default router;
