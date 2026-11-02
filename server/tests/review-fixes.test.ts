import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import request from "supertest";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { agentFor, app } from "./helpers.js";
import { executeRequest, type RequestSpec } from "../src/services/executor/execute.js";
import { redactSpec, redactUrl } from "../src/services/executor/redact.js";
import { buildAiContext } from "../src/services/ai.js";
import { isBlockedIp } from "../src/services/executor/guard.js";
import { diffJson } from "../src/services/diff.js";
import { getPath } from "../src/services/assertions.js";
import { authKey } from "../src/middleware/limits.js";
import { parseEnv } from "../src/config/env.js";
import { Monitor } from "../src/models/Monitor.js";
import { runDueMonitors, checkConfig } from "../src/jobs/scheduler.js";

const spec = (over: Partial<RequestSpec> = {}): RequestSpec => ({
  method: "GET", url: "http://127.0.0.1/", query: [], headers: [], auth: { type: "none" }, body: { mode: "none", content: "" }, ...over,
});
const kv = (key: string, value: string) => ({ key, value, enabled: true });
const priv = { allowPrivate: true };

let a: http.Server, b: http.Server;
let aBase: string, bBase: string;
let lastAuth: string | undefined;
beforeAll(async () => {
  // b echoes the headers it receives; a redirects to b (different origin = different port) or hangs
  b = http.createServer((req, res) => void res.end(JSON.stringify(req.headers)));
  a = http.createServer((req, res) => {
    lastAuth = req.headers.authorization;
    if (req.url === "/hang") return;
    if (req.url === "/to-b") {
      res.statusCode = 302;
      res.setHeader("location", bBase + "/");
      return void res.end();
    }
    res.end("{}");
  });
  await Promise.all([a, b].map((s) => new Promise<void>((r) => s.listen(0, "127.0.0.1", r))));
  aBase = `http://127.0.0.1:${(a.address() as AddressInfo).port}`;
  bBase = `http://127.0.0.1:${(b.address() as AddressInfo).port}`;
});
afterAll(() => {
  a.closeAllConnections();
  a.close();
  b.close();
});

describe("I1 cross-origin redirect strips secrets", () => {
  it("drops authorization, cookie, proxy-authorization, x-api-key and the configured api-key header; keeps others", async () => {
    const r = await executeRequest(
      spec({
        url: aBase + "/to-b",
        headers: [kv("Authorization", "Bearer s"), kv("Cookie", "sid=1"), kv("Proxy-Authorization", "p"), kv("X-Api-Key", "k"), kv("X-Keep", "yes")],
        auth: { type: "apikey", key: "X-Custom-Token", value: "t", in: "header" },
      }),
      priv,
    );
    const got = JSON.parse(r.body);
    for (const h of ["authorization", "cookie", "proxy-authorization", "x-api-key", "x-custom-token"]) expect(got[h]).toBeUndefined();
    expect(got["x-keep"]).toBe("yes");
  });
});

describe("I2 URL userinfo is redacted", () => {
  const url = "https://alice:s3cret@api.example.com/x?a=1";
  it("redactUrl / redactSpec", () => {
    const out = redactUrl(url, spec());
    expect(out).not.toContain("s3cret");
    expect(out).not.toContain("alice");
    expect(redactSpec(spec({ url })).url).not.toContain("s3cret");
    expect(redactUrl("https://a.com/x", spec())).toBe("https://a.com/x");
  });
  it("AI context drops userinfo", () => {
    const c = buildAiContext({ request: { method: "GET", url } });
    expect(c.url).not.toContain("s3cret");
    expect(c.url).not.toContain("alice");
    expect(buildAiContext({ request: { url: "//alice:s3cret@ho st/x?y=1" } }).url).not.toContain("s3cret");
  });
  it("stored execution has no userinfo in request.url / finalUrl", async () => {
    const ag = await agentFor("ui@x.com");
    const u = aBase.replace("http://", "http://alice:s3cret@");
    const r = await ag.post("/api/execute").send({ spec: { method: "GET", url: u } });
    expect(JSON.stringify(r.body)).not.toContain("s3cret");
  });
});

describe("I3 history rerun", () => {
  it("409 NEEDS_SECRETS without a saved request when the snapshot is redacted", async () => {
    const ag = await agentFor("r1@x.com");
    const ex = await ag.post("/api/execute").send({ spec: { method: "GET", url: aBase, auth: { type: "bearer", token: "real" } } });
    const r = await ag.post(`/api/history/${ex.body.id}/rerun`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("NEEDS_SECRETS");
  });
  it("uses the owned saved request's real credentials", async () => {
    const ag = await agentFor("r2@x.com");
    const c = (await ag.post("/api/collections").send({ name: "C" })).body;
    const s = { method: "GET", url: aBase, auth: { type: "bearer", token: "real" } };
    const sr = (await ag.post("/api/requests").send({ collectionId: c.id, name: "r", spec: s })).body;
    const ex = await ag.post("/api/execute").send({ spec: s, requestId: sr.id });
    const r = await ag.post(`/api/history/${ex.body.id}/rerun`);
    expect(r.status).toBe(201);
    expect(lastAuth).toBe("Bearer real");
  });
});

describe("I4 limiters", () => {
  it("rerun, suite run and monitor check share the execute budget; AI has its own", async () => {
    const ag = request.agent(createApp({ executeMax: 3, aiMax: 2 }));
    await ag.post("/api/auth/register").send({ name: "T", email: "lim@x.io", password: "password123" }).expect(201);
    const ex = await ag.post("/api/execute").send({ spec: { method: "GET", url: aBase } }).expect(201);
    await ag.post(`/api/history/${ex.body.id}/rerun`).expect(201);
    await ag.post(`/api/history/${ex.body.id}/rerun`).expect(201);
    const fake = "0".repeat(24);
    for (const p of [`/api/history/${fake}/rerun`, `/api/suites/${fake}/run`, `/api/monitors/${fake}/check`]) expect((await ag.post(p)).status).toBe(429);
    await ag.post("/api/ai/explain").send({ executionId: fake }).expect(503);
    await ag.post("/api/ai/explain").send({ executionId: fake }).expect(503);
    expect((await ag.post("/api/ai/explain").send({ executionId: fake })).status).toBe(429);
  });
});

describe("I5 / M13 config", () => {
  it("auth limiter key is per IP + lowercased email", () => {
    const k = (ip: string, email: unknown) => authKey({ ip, body: { email } } as never);
    expect(k("1.1.1.1", "A@x.io")).toBe(k("1.1.1.1", "a@x.io"));
    expect(k("1.1.1.1", "a@x.io")).not.toBe(k("1.1.1.1", "b@x.io"));
    expect(k("1.1.1.1", "a@x.io")).not.toBe(k("2.2.2.2", "a@x.io"));
  });
  const base = { JWT_SECRET: "x".repeat(40) } as NodeJS.ProcessEnv;
  it("TRUST_PROXY parses as integer, blank is unset", () => {
    expect(parseEnv({ ...base, TRUST_PROXY: "2" }).TRUST_PROXY).toBe(2);
    expect(parseEnv({ ...base, TRUST_PROXY: "" }).TRUST_PROXY).toBeUndefined();
    expect(() => parseEnv({ ...base, TRUST_PROXY: "many" })).toThrow();
  });
  it("rejects the .env.example JWT secret in production only", () => {
    const ex = { JWT_SECRET: "change-me-to-a-random-string-of-at-least-32-chars" } as NodeJS.ProcessEnv;
    expect(() => parseEnv({ ...ex, NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...ex, NODE_ENV: "development" })).not.toThrow();
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).not.toThrow();
  });
});

describe("I6 prototype keys", () => {
  it("diffJson sees constructor / toString as ordinary keys", () => {
    expect(diffJson({}, { constructor: 1 })).toEqual([{ path: "constructor", kind: "added", after: 1 }]);
    expect(diffJson({ toString: 1 }, {})).toEqual([{ path: "toString", kind: "removed", before: 1 }]);
  });
  it("getPath does not walk the prototype", () => {
    expect(getPath({}, "constructor")).toBeUndefined();
    expect(getPath({ a: {} }, "a.toString")).toBeUndefined();
    expect(getPath({ constructor: 5 }, "constructor")).toBe(5);
  });
});

describe("I7 scheduler concurrency", () => {
  it("two slow due monitors take about one check, not two", async () => {
    const ag = await agentFor("sch@x.io");
    checkConfig.retryDelayMs = 0;
    checkConfig.timeoutMs = 400;
    for (const n of ["a", "b"]) await ag.post("/api/monitors").send({ name: n, spec: { method: "GET", url: aBase + "/hang" }, intervalSec: 60 }).expect(201);
    await Monitor.updateMany({}, { nextRunAt: new Date(Date.now() - 1000) });
    const t0 = Date.now();
    expect(await runDueMonitors()).toBe(2);
    // each check = 2 attempts x 400 ms = 800 ms; serial would be ~1600 ms
    expect(Date.now() - t0).toBeLessThan(1300);
  });
});

describe("M1 IPv6 embedding IPv4", () => {
  it.each([
    "::7f00:1", "::127.0.0.1", "::10.0.0.1", "::ffff:0:7f00:1", "64:ff9b::a9fe:a9fe", "64:ff9b::169.254.169.254", "2002:7f00:1::", "2002:a9fe:a9fe::1", "2002:c0a8:101::",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  it.each(["64:ff9b::808:808", "2002:5db8:d822::1", "::ffff:0:5db8:d822"])("allows %s (public embedded)", (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe("M2 DNS is inside the timeout", () => {
  it("a resolver that never answers times out", async () => {
    const t0 = Date.now();
    const r = await executeRequest(spec({ url: "http://slow.test/" }), { allowPrivate: false, timeoutMs: 200, resolver: () => new Promise(() => {}) });
    expect(r.error?.code).toBe("TIMEOUT");
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe("M4 invalid headers", () => {
  it.each([
    ["value with CRLF", kv("X-A", "a\r\nX-B: b")],
    ["name with space", kv("bad name", "v")],
  ])("%s -> INVALID_REQUEST", async (_n, h) => {
    const r = await executeRequest(spec({ url: aBase, headers: [h] }), priv);
    expect(r.error?.code).toBe("INVALID_REQUEST");
  });
});

describe("M6/M7 auth", () => {
  it("unknown email still pays the bcrypt cost", async () => {
    const t0 = Date.now();
    const r = await request(app).post("/api/auth/login").send({ email: "nobody@x.io", password: "whatever12" });
    expect(r.status).toBe(401);
    expect(Date.now() - t0).toBeGreaterThan(80);
  });
  it("concurrent duplicate registration yields 201 + 409, never 500", async () => {
    const send = () => request(app).post("/api/auth/register").send({ name: "T", email: "race@x.io", password: "password123" });
    const codes = (await Promise.all([send(), send()])).map((r) => r.status).sort();
    expect(codes).toEqual([201, 409]);
  });
});

describe("M14 diff depth", () => {
  it("10k-deep JSON does not throw and reports one change", () => {
    const deep = (n: number, leaf: number) => JSON.parse("[".repeat(n) + leaf + "]".repeat(n));
    const out = diffJson(deep(10000, 1), deep(10000, 2));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("changed");
  });
});

describe("M16 suites requestId", () => {
  it("malformed requestId -> 400 VALIDATION", async () => {
    const ag = await agentFor("s16@x.io");
    const r = await ag.get("/api/suites?requestId=garbage");
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION");
  });
});
