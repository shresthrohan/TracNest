import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { agentFor } from "./helpers.js";

let srv: http.Server;
let base: string;
beforeAll(async () => {
  srv = http.createServer((req, res) => {
    res.end(JSON.stringify({ auth: req.headers.authorization ?? null }));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => void srv.close());

const spec = (url = "http://example.com/") => ({ method: "GET", url });

async function setup(email = "a@x.com") {
  const a = await agentFor(email);
  const c = (await a.post("/api/collections").send({ name: "Col", description: "d" })).body;
  return { a, c };
}
const addReq = (a: any, collectionId: string, name: string, s: object = spec()) =>
  a.post("/api/requests").send({ collectionId, name, spec: s });

describe("collections + requests", () => {
  it("CRUD collections with requestCount", async () => {
    const { a, c } = await setup();
    expect(c.id).toBeTruthy();
    expect(c._id).toBeUndefined();
    await addReq(a, c.id, "r1");
    const list = await a.get("/api/collections");
    expect(list.body[0]).toMatchObject({ id: c.id, name: "Col", requestCount: 1 });
    const p = await a.patch(`/api/collections/${c.id}`).send({ name: "New" });
    expect(p.body.name).toBe("New");
    expect((await a.post("/api/collections").send({ name: "" })).body.error.code).toBe("VALIDATION");
    expect((await a.get(`/api/collections/${c.id}/requests`)).body).toHaveLength(1);
  });
  it("request CRUD", async () => {
    const { a, c } = await setup();
    const r = (await addReq(a, c.id, "r1")).body;
    expect(r).toMatchObject({ collectionId: c.id, name: "r1", order: 0 });
    expect((await a.get(`/api/requests/${r.id}`)).body.spec.url).toBe("http://example.com/");
    const p = await a.patch(`/api/requests/${r.id}`).send({ name: "r2", spec: spec("http://example.com/z") });
    expect(p.body).toMatchObject({ name: "r2" });
    expect(p.body.spec.url).toBe("http://example.com/z");
    expect((await a.delete(`/api/requests/${r.id}`)).body.ok).toBe(true);
    expect((await a.get(`/api/requests/${r.id}`)).status).toBe(404);
  });
  it("duplicate goes right after source", async () => {
    const { a, c } = await setup();
    const r1 = (await addReq(a, c.id, "r1")).body;
    const r2 = (await addReq(a, c.id, "r2")).body;
    const d = (await a.post(`/api/requests/${r1.id}/duplicate`)).body;
    expect(d.name).toBe("r1 (copy)");
    expect(d.order).toBe(r1.order + 1);
    const list = (await a.get(`/api/collections/${c.id}/requests`)).body;
    expect(list.map((x: any) => x.name)).toEqual(["r1", "r1 (copy)", "r2"]);
    expect(list.find((x: any) => x.id === r2.id).order).toBeGreaterThan(d.order);
  });
  it("reorder persists", async () => {
    const { a, c } = await setup();
    const ids = [] as string[];
    for (const n of ["a", "b", "c"]) ids.push((await addReq(a, c.id, n)).body.id);
    const rev = [...ids].reverse();
    expect((await a.post(`/api/collections/${c.id}/reorder`).send({ ids: rev })).body.ok).toBe(true);
    const list = (await a.get(`/api/collections/${c.id}/requests`)).body;
    expect(list.map((x: any) => x.id)).toEqual(rev);
    expect((await a.post(`/api/collections/${c.id}/reorder`).send({ ids: [ids[0]] })).status).toBe(400);
  });
  it("delete collection cascades", async () => {
    const { a, c } = await setup();
    const r = (await addReq(a, c.id, "r1")).body;
    const s = (await a.post("/api/suites").send({ requestId: r.id, name: "s", assertions: [] })).body;
    expect((await a.delete(`/api/collections/${c.id}`)).body.ok).toBe(true);
    expect((await a.get(`/api/suites/${s.id}`)).status).toBe(404);
    expect((await a.get(`/api/requests/${r.id}`)).status).toBe(404);
    expect((await a.get("/api/collections")).body).toHaveLength(0);
  });
  it("user B is isolated", async () => {
    const { a, c } = await setup();
    const r = (await addReq(a, c.id, "r1")).body;
    const b = await agentFor("b@x.com");
    expect((await addReq(b, c.id, "x")).status).toBe(404);
    expect((await b.get(`/api/requests/${r.id}`)).status).toBe(404);
    expect((await b.patch(`/api/requests/${r.id}`).send({ name: "z" })).status).toBe(404);
    expect((await b.delete(`/api/requests/${r.id}`)).status).toBe(404);
    expect((await b.post(`/api/requests/${r.id}/duplicate`)).status).toBe(404);
    expect((await b.patch(`/api/collections/${c.id}`).send({ name: "z" })).status).toBe(404);
    expect((await b.delete(`/api/collections/${c.id}`)).status).toBe(404);
    expect((await b.get(`/api/collections/${c.id}/requests`)).status).toBe(404);
    expect((await b.post(`/api/collections/${c.id}/reorder`).send({ ids: [r.id] })).status).toBe(404);
    expect((await b.get("/api/collections")).body).toHaveLength(0);
  });
  it("execute stores requestId only when owned", async () => {
    const { a, c } = await setup();
    const r = (await addReq(a, c.id, "r1", spec(base))).body;
    const ok = await a.post("/api/execute").send({ spec: spec(base), requestId: r.id });
    expect(ok.body.requestId).toBe(r.id);
    const b = await agentFor("b@x.com");
    expect((await b.post("/api/execute").send({ spec: spec(base), requestId: r.id })).status).toBe(404);
  });
  it("rerun uses saved request current spec", async () => {
    const { a, c } = await setup();
    const withAuth = { ...spec(base), auth: { type: "bearer", token: "tok123" } };
    const r = (await addReq(a, c.id, "r1", withAuth)).body;
    const ex = (await a.post("/api/execute").send({ spec: withAuth, requestId: r.id })).body;
    expect(JSON.parse(ex.responseBody).auth).toBe("Bearer tok123");
    const rr = (await a.post(`/api/history/${ex.id}/rerun`)).body;
    expect(JSON.parse(rr.responseBody).auth).toBe("Bearer tok123");
    expect(rr.source).toBe("rerun");
    const h = (await a.get(`/api/history?requestId=${r.id}`)).body;
    expect(h.total).toBe(2);
    expect((await a.get(`/api/history?requestId=${c.id}`)).body.total).toBe(0);
  });
});
