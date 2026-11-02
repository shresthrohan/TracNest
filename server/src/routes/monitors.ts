import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requestSpecSchema } from "../validators/request.js";
import { Monitor } from "../models/Monitor.js";
import { MonitorCheck } from "../models/MonitorCheck.js";
import { oid } from "../models/Execution.js";
import { checkMonitor } from "../jobs/scheduler.js";
import { HttpError } from "../utils/HttpError.js";

const MAX_MONITORS = 25;
const fields = {
  name: z.string().trim().min(1).max(100),
  spec: requestSpecSchema,
  intervalSec: z.number().int().min(60).max(86400),
  expectedStatus: z.number().int().min(100).max(599),
  active: z.boolean(),
};
const createSchema = z.object({ ...fields, expectedStatus: fields.expectedStatus.default(200), active: fields.active.default(true) });
const patchSchema = z.object(fields).partial();

async function owned(userId: string, id: string) {
  const m = await Monitor.findOne({ _id: id, userId: oid(userId) });
  if (!m) throw new HttpError(404, "Not found", "NOT_FOUND");
  return m;
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const userId = oid(req.userId);
  const [monitors, agg] = await Promise.all([
    Monitor.find({ userId }).sort({ createdAt: 1 }),
    MonitorCheck.aggregate([
      { $match: { userId, checkedAt: { $gte: new Date(Date.now() - 24 * 3600_000) } } },
      { $group: { _id: "$monitorId", total: { $sum: 1 }, up: { $sum: { $cond: ["$ok", 1, 0] } }, avg: { $avg: "$responseTime" } } },
    ]),
  ]);
  const by = new Map(agg.map((a) => [String(a._id), a]));
  res.json(
    monitors.map((m) => {
      const a = by.get(m.id);
      return { ...m.toJSON(), uptime24h: a ? round((a.up / a.total) * 100) : null, avgMs24h: a ? Math.round(a.avg) : null };
    }),
  );
});

const round = (n: number) => Math.round(n * 100) / 100;

router.post("/", async (req, res) => {
  const b = createSchema.parse(req.body);
  if ((await Monitor.countDocuments({ userId: oid(req.userId) })) >= MAX_MONITORS)
    throw new HttpError(400, `Monitor limit reached (${MAX_MONITORS})`, "VALIDATION");
  res.status(201).json(await Monitor.create({ ...b, userId: oid(req.userId), nextRunAt: new Date() }));
});

router.get("/:id", async (req, res) => void res.json(await owned(req.userId, req.params.id)));

router.patch("/:id", async (req, res) => {
  const m = await owned(req.userId, req.params.id);
  const b = patchSchema.parse(req.body);
  if (b.active && !m.active) m.nextRunAt = new Date();
  Object.assign(m, b);
  res.json(await m.save());
});

router.delete("/:id", async (req, res) => {
  const m = await owned(req.userId, req.params.id);
  await Promise.all([m.deleteOne(), MonitorCheck.deleteMany({ monitorId: m._id })]);
  res.json({ ok: true });
});

router.post("/:id/check", async (req, res) => {
  res.status(201).json(await checkMonitor(await owned(req.userId, req.params.id)));
});

router.get("/:id/stats", async (req, res) => {
  const m = await owned(req.userId, req.params.id);
  const hours = z.coerce.number().int().min(1).max(720).default(24).parse(req.query.hours);
  const match = { monitorId: m._id, checkedAt: { $gte: new Date(Date.now() - hours * 3600_000) } };
  const [[a], recent] = await Promise.all([
    MonitorCheck.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: 1 }, failed: { $sum: { $cond: ["$ok", 0, 1] } }, avg: { $avg: "$responseTime" } } },
    ]),
    MonitorCheck.find(match).sort({ checkedAt: -1 }).limit(500).lean(), // ponytail: series capped at 500 newest points
  ]);
  const series = recent.reverse().map((c) => ({ checkedAt: c.checkedAt, responseTime: c.responseTime, ok: c.ok, anomaly: c.anomaly }));
  res.json({
    uptime: a ? round(((a.total - a.failed) / a.total) * 100) : null,
    avgMs: a ? Math.round(a.avg) : null,
    failed: a?.failed ?? 0,
    total: a?.total ?? 0,
    series,
    anomalies: series.filter((s) => s.anomaly),
  });
});

export default router;
