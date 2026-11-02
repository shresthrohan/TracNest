import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import request from "supertest";
import type { AddressInfo } from "node:net";
import { agentFor, app } from "./helpers.js";

let srv: http.Server;
let base: string;
beforeAll(async () => {
  srv = http.createServer((req, res) => {
    res.statusCode = req.url?.startsWith("/err") ? 500 : 200;
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => void srv.close());

const spec = (path: string, method = "GET", extra: object = {}) => ({ method, url: base + path, ...extra });

describe("execute + history", () => {
  it("requires auth", async () => {
    expect((await request(app).post("/api/execute").send({ spec: spec("/") })).status).toBe(401);
  });
  it("stores redacted execution", async () => {
    const a = await agentFor("a@x.com");
    const r = await a.post("/api/execute").send({
      spec: spec("/x", "GET", { headers: [{ key: "Authorization", value: "Bearer s3cret", enabled: true }], auth: { type: "bearer", token: "s3cret" } }),
    });
    expect(r.status).toBe(201);
    expect(r.body.statusCode).toBe(200);
    const h = await a.get(`/api/history/${r.body.id}`);
    expect(h.body.request.headers[0].value).toBe("[REDACTED]");
    expect(h.body.request.auth.token).toBe("[REDACTED]");
    expect(JSON.stringify(h.body)).not.toContain("s3cret");
    expect(h.body.responseBody).toContain("ok");
  });
  it("validates spec", async () => {
    const a = await agentFor("a@x.com");
    expect((await a.post("/api/execute").send({ spec: { method: "TRACE", url: "x" } })).body.error.code).toBe("VALIDATION");
  });
  it("bad target recorded as error execution", async () => {
    const a = await agentFor("a@x.com");
    const r = await a.post("/api/execute").send({ spec: { method: "GET", url: "file:///etc/passwd" } });
    expect(r.status).toBe(201);
    expect(r.body.error.code).toBe("INVALID_URL");
    expect(r.body.ok).toBe(false);
  });
  it("filters by method/status/q, escapes q, paginates, omits body", async () => {
    const a = await agentFor("a@x.com");
    for (const [p, m] of [["/axb", "GET"], ["/a.b", "POST"], ["/err1", "GET"]]) await a.post("/api/execute").send({ spec: spec(p, m) });
    expect((await a.get("/api/history")).body.total).toBe(3);
    expect((await a.get("/api/history?method=POST")).body.total).toBe(1);
    expect((await a.get("/api/history?status=5xx")).body.total).toBe(1);
    expect((await a.get("/api/history?status=2xx")).body.total).toBe(2);
    const q = await a.get("/api/history?q=a.b");
    expect(q.body.total).toBe(1);
    expect(q.body.items[0].request.url).toContain("/a.b");
    expect(q.body.items[0].responseBody).toBeUndefined();
    const p = await a.get("/api/history?limit=2&page=2");
    expect(p.body).toMatchObject({ total: 3, page: 2, pages: 2 });
    expect(p.body.items).toHaveLength(1);
  });
  it("other user gets 404 on get/delete/rerun", async () => {
    const a = await agentFor("a@x.com");
    const b = await agentFor("b@x.com");
    const id = (await a.post("/api/execute").send({ spec: spec("/") })).body.id;
    for (const r of [await b.get(`/api/history/${id}`), await b.delete(`/api/history/${id}`), await b.post(`/api/history/${id}/rerun`)]) {
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe("NOT_FOUND");
    }
    expect((await b.get("/api/history")).body.total).toBe(0);
    expect((await b.get("/api/history/not-an-id")).status).toBe(404);
  });
  it("rerun and delete", async () => {
    const a = await agentFor("a@x.com");
    const id = (await a.post("/api/execute").send({ spec: spec("/") })).body.id;
    const rr = await a.post(`/api/history/${id}/rerun`);
    expect(rr.status).toBe(201);
    expect(rr.body.source).toBe("rerun");
    expect((await a.get("/api/history")).body.total).toBe(2);
    expect((await a.delete(`/api/history/${id}`)).status).toBe(200);
    expect((await a.get(`/api/history/${id}`)).status).toBe(404);
  });
});

describe("diff route", () => {
  const post = (a: any, path: string) => a.post("/api/execute").send({ spec: spec(path) });
  it("diffs two owned executions; foreign/invalid -> 404", async () => {
    const a = await agentFor("a@x.com");
    const e1 = (await post(a, "/x")).body;
    const e2 = (await post(a, "/err")).body;
    const d = await a.get(`/api/diff?a=${e1.id}&b=${e2.id}`);
    expect(d.status).toBe(200);
    expect(d.body).toMatchObject({ bodyKind: "json", changes: [], status: { before: 200, after: 500 } });
    expect(d.body.a).toMatchObject({ id: e1.id, statusCode: 200 });
    expect(d.body.b.id).toBe(e2.id);
    const b = await agentFor("b@x.com");
    expect((await b.get(`/api/diff?a=${e1.id}&b=${e2.id}`)).status).toBe(404);
    expect((await a.get(`/api/diff?a=${e1.id}&b=nope`)).status).toBe(404);
    expect((await a.get(`/api/diff?a=${e1.id}`)).status).toBe(400);
  });
});
