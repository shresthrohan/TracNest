import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Collection } from "../models/Collection.js";
import { SavedRequest } from "../models/SavedRequest.js";
import { TestSuite } from "../models/TestSuite.js";
import { oid } from "../models/Execution.js";
import { HttpError } from "../utils/HttpError.js";

const router = Router();
router.use(requireAuth);

const body = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).default("") });

export async function ownedCollection(userId: string, id: string) {
  const c = await Collection.findOne({ _id: id, userId: oid(userId) });
  if (!c) throw new HttpError(404, "Not found", "NOT_FOUND");
  return c;
}

router.get("/", async (req, res) => {
  const userId = oid(req.userId);
  const [cols, counts] = await Promise.all([
    Collection.find({ userId }).sort({ createdAt: 1 }),
    SavedRequest.aggregate<{ _id: unknown; n: number }>([{ $match: { userId } }, { $group: { _id: "$collectionId", n: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(cols.map((c) => ({ ...c.toJSON(), requestCount: byId.get(String(c._id)) ?? 0 })));
});

router.post("/", async (req, res) => {
  const d = body.parse(req.body);
  res.status(201).json({ ...(await Collection.create({ ...d, userId: req.userId })).toJSON(), requestCount: 0 });
});

router.patch("/:id", async (req, res) => {
  const d = body.partial().parse(req.body);
  const c = await ownedCollection(req.userId, req.params.id);
  c.set(d);
  res.json(await c.save());
});

router.delete("/:id", async (req, res) => {
  const c = await ownedCollection(req.userId, req.params.id);
  const ids = await SavedRequest.find({ collectionId: c._id, userId: c.userId }).distinct("_id");
  await TestSuite.deleteMany({ requestId: { $in: ids }, userId: c.userId });
  await SavedRequest.deleteMany({ collectionId: c._id, userId: c.userId });
  await c.deleteOne();
  res.json({ ok: true });
});

router.get("/:id/requests", async (req, res) => {
  const c = await ownedCollection(req.userId, req.params.id);
  res.json(await SavedRequest.find({ collectionId: c._id, userId: c.userId }).sort({ order: 1, createdAt: 1 }));
});

router.post("/:id/reorder", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(1000) }).parse(req.body);
  const c = await ownedCollection(req.userId, req.params.id);
  const existing = await SavedRequest.find({ collectionId: c._id, userId: c.userId }, { _id: 1 });
  const have = new Set(existing.map((r) => String(r._id)));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((i) => have.has(i)))
    throw new HttpError(400, "ids must list every request in the collection exactly once", "VALIDATION");
  await SavedRequest.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: oid(id), userId: c.userId }, update: { $set: { order } } } })));
  res.json({ ok: true });
});

export default router;
