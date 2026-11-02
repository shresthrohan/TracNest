import { describe, it, expect } from "vitest";
import { agentFor } from "./helpers.js";
import { Execution } from "../src/models/Execution.js";

const row = (userId: string, ok: boolean, url = "http://t/x", extra = {}) => ({
  userId, source: "playground", request: { method: "GET", url }, ok, statusCode: ok ? 200 : 500, responseTime: 100, responseSize: 1, ...extra,
});

describe("dashboard", () => {
  it("aggregates only own executions", async () => {
    const a = await agentFor("a@x.com");
    const b = await agentFor("b@x.com");
    const idA = (await a.get("/api/auth/me")).body.id;
    const idB = (await b.get("/api/auth/me")).body.id;
    await Execution.create([
      row(idA, true), row(idA, true), row(idA, true), row(idA, false, "http://t/bad"), row(idA, false, "http://t/bad"),
      row(idB, true), row(idA, true, "http://t/old", { executedAt: new Date(Date.now() - 30 * 86400_000) }),
    ]);
    const r = await a.get("/api/dashboard?days=7");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 5, success: 3, failed: 2, successRate: 60, avgMs: 100 });
    expect(r.body.recent).toHaveLength(5);
    expect(r.body.failing).toEqual([expect.objectContaining({ method: "GET", url: "http://t/bad", failures: 2, lastStatus: 500 })]);
    expect(r.body.series.reduce((n: number, s: { count: number }) => n + s.count, 0)).toBe(5);
  });
  it("empty state", async () => {
    const a = await agentFor("a@x.com");
    expect((await a.get("/api/dashboard")).body).toMatchObject({ total: 0, successRate: 0, recent: [], failing: [], series: [] });
  });
});
