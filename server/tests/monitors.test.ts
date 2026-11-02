import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { agentFor } from "./helpers.js";
import { Monitor } from "../src/models/Monitor.js";
import { MonitorCheck } from "../src/models/MonitorCheck.js";
import { runDueMonitors, checkConfig } from "../src/jobs/scheduler.js";

let srv: http.Server;
let base: string;
beforeAll(async () => {
  srv = http.createServer((req, res) => {
    if (req.url === "/hang") return; // never answers
    if (req.url === "/500") {
      res.statusCode = 500;
      return void res.end("x");
    }
    res.end("ok");
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => {
  srv.closeAllConnections();
  srv.close();
});
beforeEach(() => {
  checkConfig.retryDelayMs = 0;
  checkConfig.timeoutMs = 300;
});

const body = (path: string, extra = {}) => ({
  name: "m",
  spec: { method: "GET", url: base + path },
  intervalSec: 60,
  ...extra,
});

describe("monitors", () => {
  it("validates interval >= 60", async () => {
    const a = await agentFor("m1@x.io");
    const r = await a.post("/api/monitors").send(body("/ok", { intervalSec: 30 }));
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION");
  });

  it("creates, lists with 24h summary, patches, deletes", async () => {
    const a = await agentFor("m2@x.io");
    const c = await a.post("/api/monitors").send(body("/ok"));
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ expectedStatus: 200, active: true, currentStatus: "pending" });
    expect(c.body.id).toBeTruthy();
    await a.post(`/api/monitors/${c.body.id}/check`).expect(201);
    const l = await a.get("/api/monitors");
    expect(l.body[0]).toMatchObject({ id: c.body.id, currentStatus: "up", uptime24h: 100 });
    expect(typeof l.body[0].avgMs24h).toBe("number");
    const p = await a.patch(`/api/monitors/${c.body.id}`).send({ name: "renamed", active: false });
    expect(p.body).toMatchObject({ name: "renamed", active: false });
    await a.delete(`/api/monitors/${c.body.id}`).expect(200);
    await a.get(`/api/monitors/${c.body.id}`).expect(404);
    expect(await MonitorCheck.countDocuments()).toBe(0);
  });

  it("runDueMonitors runs due, skips not-due, sets nextRunAt", async () => {
    const a = await agentFor("m3@x.io");
    const due = (await a.post("/api/monitors").send(body("/ok"))).body;
    const later = (await a.post("/api/monitors").send(body("/ok"))).body;
    const now = new Date();
    await Monitor.updateOne({ _id: due.id }, { nextRunAt: new Date(now.getTime() - 1000) });
    await Monitor.updateOne({ _id: later.id }, { nextRunAt: new Date(now.getTime() + 3600_000) });
    expect(await runDueMonitors(now)).toBe(1);
    const d = await Monitor.findById(due.id);
    expect(d!.nextRunAt.getTime()).toBe(now.getTime() + 60_000);
    expect(d!.currentStatus).toBe("up");
    expect(await MonitorCheck.countDocuments({ monitorId: later.id })).toBe(0);
    expect(await runDueMonitors(now)).toBe(0);
  });

  it("wrong status is a failed check -> down", async () => {
    const a = await agentFor("m4@x.io");
    const m = (await a.post("/api/monitors").send(body("/500"))).body;
    const r = await a.post(`/api/monitors/${m.id}/check`);
    expect(r.body).toMatchObject({ ok: false, statusCode: 500 });
    expect((await a.get(`/api/monitors/${m.id}`)).body.currentStatus).toBe("down");
  });

  it("timing-out target records failure and the loop keeps going", async () => {
    const a = await agentFor("m5@x.io");
    const bad = (await a.post("/api/monitors").send(body("/hang"))).body;
    const good = (await a.post("/api/monitors").send(body("/ok"))).body;
    await Monitor.updateMany({}, { nextRunAt: new Date(Date.now() - 1000) });
    expect(await runDueMonitors()).toBe(2);
    const c = await MonitorCheck.findOne({ monitorId: bad.id });
    expect(c).toMatchObject({ ok: false });
    expect(c!.error!.code).toBe("TIMEOUT");
    expect((await Monitor.findById(bad.id))!.currentStatus).toBe("down");
    expect((await Monitor.findById(good.id))!.currentStatus).toBe("up");
  });

  it("stats uptime math", async () => {
    const a = await agentFor("m6@x.io");
    const m = (await a.post("/api/monitors").send(body("/ok"))).body;
    const t = Date.now();
    const mk = (ok: boolean, ms: number, ago: number, anomaly = false) => ({
      monitorId: m.id, userId: (m.userId), ok, responseTime: ms, anomaly, checkedAt: new Date(t - ago),
    });
    await MonitorCheck.insertMany([
      mk(true, 100, 1000), mk(true, 200, 2000), mk(false, 300, 3000), mk(true, 400, 4000, true),
      mk(true, 999, 30 * 3600_000), // outside 24h
    ]);
    const s = (await a.get(`/api/monitors/${m.id}/stats?hours=24`)).body;
    expect(s).toMatchObject({ total: 4, failed: 1, uptime: 75, avgMs: 250 });
    expect(s.series).toHaveLength(4);
    expect(s.anomalies).toHaveLength(1);
  });

  it("other users get 404", async () => {
    const a = await agentFor("m7a@x.io");
    const b = await agentFor("m7b@x.io");
    const m = (await a.post("/api/monitors").send(body("/ok"))).body;
    for (const r of [
      await b.get(`/api/monitors/${m.id}`),
      await b.patch(`/api/monitors/${m.id}`).send({ name: "x" }),
      await b.delete(`/api/monitors/${m.id}`),
      await b.post(`/api/monitors/${m.id}/check`),
      await b.get(`/api/monitors/${m.id}/stats`),
    ])
      expect(r.status).toBe(404);
    expect((await b.get("/api/monitors")).body).toEqual([]);
  });
});
