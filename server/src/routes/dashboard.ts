import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Execution, oid } from "../models/Execution.js";

const router = Router();
router.use(requireAuth);

const q = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) });

router.get("/", async (req, res) => {
  const { days } = q.parse(req.query);
  const from = new Date(Date.now() - days * 86400_000);
  const match = { userId: oid(req.userId), executedAt: { $gte: from } };
  const unit = days <= 2 ? "hour" : "day";
  const [r] = await Execution.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [{ $group: { _id: null, total: { $sum: 1 }, success: { $sum: { $cond: ["$ok", 1, 0] } }, avgMs: { $avg: "$responseTime" } } }],
        recent: [{ $sort: { executedAt: -1 } }, { $limit: 10 }, { $project: { responseBody: 0 } }],
        failing: [
          { $match: { ok: false } },
          { $sort: { executedAt: -1 } },
          {
            $group: {
              _id: { method: "$request.method", url: "$request.url" },
              failures: { $sum: 1 },
              lastStatus: { $first: "$statusCode" },
              lastAt: { $first: "$executedAt" },
            },
          },
          { $sort: { failures: -1, lastAt: -1 } },
          { $limit: 5 },
          { $project: { _id: 0, method: "$_id.method", url: "$_id.url", failures: 1, lastStatus: 1, lastAt: 1 } },
        ],
        series: [
          {
            $group: {
              _id: { $dateTrunc: { date: "$executedAt", unit } },
              avgMs: { $avg: "$responseTime" },
              count: { $sum: 1 },
              failed: { $sum: { $cond: ["$ok", 0, 1] } },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, bucket: { $dateToString: { date: "$_id", format: "%Y-%m-%dT%H:%M:%S.%LZ" } }, avgMs: { $round: ["$avgMs", 0] }, count: 1, failed: 1 } },
        ],
      },
    },
  ]);
  const t = r.totals[0] ?? { total: 0, success: 0, avgMs: 0 };
  res.json({
    total: t.total,
    success: t.success,
    failed: t.total - t.success,
    avgMs: Math.round(t.avgMs ?? 0),
    successRate: t.total ? Math.round((t.success / t.total) * 100) : 0,
    // recent comes from aggregate (plain docs): map _id -> id to match other endpoints
    recent: r.recent.map(({ _id, __v, ...rest }: { _id: unknown; __v?: number }) => ({ id: String(_id), ...rest })),
    failing: r.failing,
    series: r.series,
  });
});

export default router;
