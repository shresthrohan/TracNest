import { Monitor } from "../models/Monitor.js";
import { MonitorCheck } from "../models/MonitorCheck.js";
import { executeRequest, type RequestSpec } from "../services/executor/execute.js";
import { isAnomaly } from "../services/anomaly.js";

/** Tunables; tests set retryDelayMs to 0 and a short timeout. */
export const checkConfig: { retryDelayMs: number; timeoutMs?: number } = { retryDelayMs: 2000 };

type MonitorDoc = InstanceType<typeof Monitor>;

/** One check with one retry on failure; records a MonitorCheck and updates the monitor. */
export async function checkMonitor(m: MonitorDoc) {
  const run = () => executeRequest(m.spec as RequestSpec, { timeoutMs: checkConfig.timeoutMs });
  const good = (r: Awaited<ReturnType<typeof run>>) => !r.error && r.statusCode === m.expectedStatus;
  let r = await run();
  if (!good(r)) {
    await new Promise((res) => setTimeout(res, checkConfig.retryDelayMs));
    r = await run();
  }
  const ok = good(r);
  let anomaly = false;
  if (ok) {
    const past = await MonitorCheck.find({ monitorId: m._id, ok: true }).sort({ checkedAt: -1 }).limit(100).select("responseTime").lean();
    anomaly = isAnomaly(past.map((p) => p.responseTime), r.timeMs);
  }
  const check = await MonitorCheck.create({
    monitorId: m._id,
    userId: m.userId,
    ok,
    statusCode: r.statusCode,
    responseTime: r.timeMs,
    error: r.error,
    anomaly,
  });
  await Monitor.updateOne(
    { _id: m._id },
    { lastCheckedAt: check.checkedAt, lastStatusCode: r.statusCode ?? null, lastResponseTime: r.timeMs, currentStatus: ok ? "up" : "down" },
  );
  return check;
}

/** Claims due monitors one at a time (atomic nextRunAt bump) and checks them. Returns how many ran. */
export async function runDueMonitors(now = new Date()): Promise<number> {
  let n = 0;
  for (;;) {
    const m = await Monitor.findOneAndUpdate(
      { active: true, nextRunAt: { $lte: now } },
      [{ $set: { nextRunAt: { $add: [now, { $multiply: ["$intervalSec", 1000] }] } } }],
      { returnDocument: "after", updatePipeline: true },
    );
    if (!m) return n;
    n++;
    try {
      await checkMonitor(m);
    } catch (err) {
      console.error("monitor check failed", m.id, err);
    }
  }
}

/** Starts the 10 s tick; returns a stop function. Never called from tests. */
export function startScheduler(): () => void {
  let busy = false;
  const t = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueMonitors();
    } catch (err) {
      console.error("scheduler tick failed", err);
    } finally {
      busy = false;
    }
  }, 10_000);
  return () => clearInterval(t);
}
