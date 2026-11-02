import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { agentFor } from "./helpers.js";

let srv: http.Server;
let base: string;
let payload: object = { id: 1, name: "x", age: 22 };
beforeAll(async () => {
  srv = http.createServer((_req, res) => {
    res.end(JSON.stringify(payload));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => void srv.close());

async function setup(email = "a@x.com") {
  payload = { id: 1, name: "x", age: 22 };
  const a = await agentFor(email);
  const c = (await a.post("/api/collections").send({ name: "C" })).body;
  const r = (await a.post("/api/requests").send({ collectionId: c.id, name: "r", spec: { method: "GET", url: base } })).body;
  return { a, r };
}
const asserts = [
  { id: "s", kind: "status", expected: 200 },
  { id: "age", kind: "exists", path: "age" },
  { id: "name", kind: "type", path: "name", expected: "string" },
];

describe("suites", () => {
  it("CRUD + validation", async () => {
    const { a, r } = await setup();
    const s = (await a.post("/api/suites").send({ requestId: r.id, name: "S", assertions: asserts })).body;
    expect(s.id).toBeTruthy();
    expect((await a.get("/api/suites")).body).toHaveLength(1);
    expect((await a.get(`/api/suites?requestId=${r.id}`)).body).toHaveLength(1);
    expect((await a.patch(`/api/suites/${s.id}`).send({ name: "T" })).body.name).toBe("T");
    expect((await a.post("/api/suites").send({ requestId: r.id, name: "S", assertions: [{ id: "", kind: "status" }] })).body.error.code).toBe("VALIDATION");
    expect((await a.post("/api/suites").send({ requestId: r.id, name: "S", assertions: [{ id: "z", kind: "bogus" }] })).status).toBe(400);
    expect((await a.delete(`/api/suites/${s.id}`)).body.ok).toBe(true);
    expect((await a.get(`/api/suites/${s.id}`)).status).toBe(404);
  });
  it("run stores results", async () => {
    const { a, r } = await setup();
    const s = (await a.post("/api/suites").send({ requestId: r.id, name: "S", assertions: asserts })).body;
    const run = await a.post(`/api/suites/${s.id}/run`);
    expect(run.status).toBe(200);
    expect(run.body.lastRun).toMatchObject({ passed: 3, failed: 0 });
    expect(run.body.lastRun.regression).toBeUndefined();
    const got = (await a.get(`/api/suites/${s.id}`)).body;
    expect(got.lastRun.results).toHaveLength(3);
    const ex = (await a.get(`/api/history/${got.lastRun.executionId}`)).body;
    expect(ex.source).toBe("suite");
    expect(ex.requestId).toBe(r.id);
  });
  it("regression + only=failed", async () => {
    const { a, r } = await setup();
    const s = (await a.post("/api/suites").send({ requestId: r.id, name: "S", assertions: asserts })).body;
    await a.post(`/api/suites/${s.id}/run`);
    payload = { id: 1, name: "x" };
    const run2 = (await a.post(`/api/suites/${s.id}/run`)).body.lastRun;
    expect(run2.failed).toBe(1);
    expect(run2.regression.changes).toEqual([{ path: "age", kind: "removed", before: 22 }]);
    expect(run2.regression.newlyFailing).toEqual(["age"]);
    payload = { id: 1, name: "x", age: 5 };
    const run3 = (await a.post(`/api/suites/${s.id}/run?only=failed`)).body.lastRun;
    expect(run3.results).toHaveLength(3);
    expect(run3.results.find((x: any) => x.id === "age").passed).toBe(true);
    expect(run3.passed).toBe(3);
    expect(run3.failed).toBe(0);
  });
  it("user B cannot touch suite or build on foreign request", async () => {
    const { a, r } = await setup();
    const s = (await a.post("/api/suites").send({ requestId: r.id, name: "S", assertions: asserts })).body;
    const b = await agentFor("b@x.com");
    expect((await b.post(`/api/suites/${s.id}/run`)).status).toBe(404);
    expect((await b.get(`/api/suites/${s.id}`)).status).toBe(404);
    expect((await b.patch(`/api/suites/${s.id}`).send({ name: "z" })).status).toBe(404);
    expect((await b.delete(`/api/suites/${s.id}`)).status).toBe(404);
    expect((await b.post("/api/suites").send({ requestId: r.id, name: "S", assertions: [] })).status).toBe(404);
    expect((await b.get("/api/suites")).body).toHaveLength(0);
  });
});
