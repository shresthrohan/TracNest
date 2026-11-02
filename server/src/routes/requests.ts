import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { SavedRequest } from "../models/SavedRequest.js";
import { TestSuite } from "../models/TestSuite.js";
import { oid } from "../models/Execution.js";
import { requestSpecSchema } from "../validators/request.js";
import { ownedCollection } from "./collections.js";
import { HttpError } from "../utils/HttpError.js";

const router = Router();
router.use(requireAuth);

export async function ownedRequest(userId: string, id: string) {
  const r = await SavedRequest.findOne({ _id: id, userId: oid(userId) });
  if (!r) throw new HttpError(404, "Not found", "NOT_FOUND");
  return r;
}

const name = z.string().trim().min(1).max(100);

router.post("/", async (req, res) => {
  const d = z.object({ collectionId: z.string(), name, spec: requestSpecSchema }).parse(req.body);
  const c = await ownedCollection(req.userId, d.collectionId);
  const last = await SavedRequest.findOne({ collectionId: c._id, userId: c.userId }).sort({ order: -1 });
  res.status(201).json(await SavedRequest.create({ ...d, collectionId: c._id, userId: c.userId, order: last ? last.order + 1 : 0 }));
});

router.get("/:id", async (req, res) => {
  res.json(await ownedRequest(req.userId, req.params.id));
});

router.patch("/:id", async (req, res) => {
  const d = z.object({ name, spec: requestSpecSchema }).partial().parse(req.body);
  const r = await ownedRequest(req.userId, req.params.id);
  r.set(d);
  res.json(await r.save());
});

router.delete("/:id", async (req, res) => {
  const r = await ownedRequest(req.userId, req.params.id);
  await TestSuite.deleteMany({ requestId: r._id, userId: r.userId });
  await r.deleteOne();
  res.json({ ok: true });
});

router.post("/:id/duplicate", async (req, res) => {
  const r = await ownedRequest(req.userId, req.params.id);
  await SavedRequest.updateMany({ collectionId: r.collectionId, userId: r.userId, order: { $gt: r.order } }, { $inc: { order: 1 } });
  res.status(201).json(await SavedRequest.create({ userId: r.userId, collectionId: r.collectionId, name: `${r.name} (copy)`, spec: r.spec, order: r.order + 1 }));
});

export default router;
