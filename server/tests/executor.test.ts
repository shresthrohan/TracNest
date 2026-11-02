import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { executeRequest, type RequestSpec } from "../src/services/executor/execute.js";
import { redactSpec, redactHeaders } from "../src/services/executor/redact.js";

let srv: http.Server;
let base: string;

beforeAll(async () => {
  srv = http.createServer((req, res) => {
    const u = new URL(req.url!, "http://x");
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (u.pathname === "/json") {
        res.setHeader("content-type", "application/json");
        return void res.end(JSON.stringify({ hello: "world" }));
      }
      if (u.pathname === "/echo") {
        res.setHeader("content-type", "application/json");
        return void res.end(JSON.stringify({ method: req.method, headers: req.headers, query: u.search, body: Buffer.concat(chunks).toString() }));
      }
      if (u.pathname === "/slow") return void setTimeout(() => res.end("late"), 1000);
      if (u.pathname === "/big") return void res.end(Buffer.alloc(6 * 1024 * 1024, 97));
      if (u.pathname === "/imds") {
        res.statusCode = 302;
        res.setHeader("location", "http://169.254.169.254/latest/meta-data");
        return void res.end();
      }
      if (u.pathname.startsWith("/hop/")) {
        res.statusCode = 302;
        res.setHeader("location", `/hop/${Number(u.pathname.slice(5)) + 1}`);
        return void res.end();
      }
      if (u.pathname === "/post-redirect") {
        res.statusCode = 302;
        res.setHeader("location", "/echo");
        return void res.end();
      }
      res.statusCode = 404;
      res.end("nope");
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => void srv.close());

const spec = (over: Partial<RequestSpec> = {}): RequestSpec => ({
  method: "GET", url: `${base}/json`, query: [], headers: [], auth: { type: "none" }, body: { mode: "none", content: "" }, ...over,
});
const priv = { allowPrivate: true };

describe("executeRequest", () => {
  it("GET json", async () => {
    const r = await executeRequest(spec(), priv);
    expect(r.ok).toBe(true);
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ hello: "world" });
    expect(r.timeMs).toBeGreaterThan(0);
  });
  it("POST json body", async () => {
    const r = await executeRequest(spec({ method: "POST", url: `${base}/echo`, body: { mode: "json", content: '{"a":1}' } }), priv);
    const e = JSON.parse(r.body);
    expect(e.body).toBe('{"a":1}');
    expect(e.headers["content-type"]).toBe("application/json");
  });
  it("bearer, basic, apikey(query)", async () => {
    const get = async (auth: RequestSpec["auth"]) => JSON.parse((await executeRequest(spec({ url: `${base}/echo`, auth }), priv)).body);
    expect((await get({ type: "bearer", token: "tok" })).headers.authorization).toBe("Bearer tok");
    expect((await get({ type: "basic", username: "u", password: "p" })).headers.authorization).toBe("Basic " + Buffer.from("u:p").toString("base64"));
    expect((await get({ type: "apikey", key: "k", value: "v", in: "query" })).query).toBe("?k=v");
  });
  it("disabled kv skipped, enabled query appended", async () => {
    const r = await executeRequest(
      spec({ url: `${base}/echo`, query: [{ key: "a", value: "1", enabled: true }, { key: "b", value: "2", enabled: false }], headers: [{ key: "X-Off", value: "1", enabled: false }] }),
      priv,
    );
    const e = JSON.parse(r.body);
    expect(e.query).toBe("?a=1");
    expect(e.headers["x-off"]).toBeUndefined();
  });
  it("rejects file:// and garbage", async () => {
    expect((await executeRequest(spec({ url: "file:///etc/passwd" }), priv)).error?.code).toBe("INVALID_URL");
    expect((await executeRequest(spec({ url: "not a url" }), priv)).error?.code).toBe("INVALID_URL");
  });
  it("blocks private literal IP", async () => {
    const r = await executeRequest(spec(), { allowPrivate: false });
    expect(r.error?.code).toBe("BLOCKED");
    expect(r.ok).toBe(false);
  });
  it("blocks hostname resolving to private IP (rebinding)", async () => {
    const r = await executeRequest(spec({ url: "http://localtest.me/" }), { allowPrivate: false, resolver: async () => ["127.0.0.1"] });
    expect(r.error?.code).toBe("BLOCKED");
  });
  it("blocks a mixed public/private resolution", async () => {
    const r = await executeRequest(spec({ url: "http://x.test/" }), { allowPrivate: false, resolver: async () => ["93.184.216.34", "10.0.0.1"] });
    expect(r.error?.code).toBe("BLOCKED");
  });
  it("blocks redirect to metadata IP", async () => {
    // only the metadata range is blocked so the local first hop is reachable
    const r = await executeRequest(spec({ url: `${base}/imds` }), { allowPrivate: false, isBlocked: (ip) => ip.startsWith("169.254.") });
    expect(r.error?.code).toBe("BLOCKED");
    expect(r.redirects).toEqual(["http://169.254.169.254/latest/meta-data"]);
  });
  it("timeout", async () => {
    const r = await executeRequest(spec({ url: `${base}/slow` }), { ...priv, timeoutMs: 200 });
    expect(r.error?.code).toBe("TIMEOUT");
  });
  it("too large", async () => {
    const r = await executeRequest(spec({ url: `${base}/big` }), priv);
    expect(r.error?.code).toBe("TOO_LARGE");
  });
  it("too many redirects", async () => {
    const r = await executeRequest(spec({ url: `${base}/hop/0` }), priv);
    expect(r.error?.code).toBe("TOO_MANY_REDIRECTS");
  });
  it("POST 302 becomes GET without body", async () => {
    const r = await executeRequest(spec({ method: "POST", url: `${base}/post-redirect`, body: { mode: "text", content: "x" } }), priv);
    const e = JSON.parse(r.body);
    expect(e.method).toBe("GET");
    expect(e.body).toBe("");
    expect(r.redirects).toHaveLength(1);
  });
  it("connection refused returns error, not throw", async () => {
    const r = await executeRequest(spec({ url: "http://127.0.0.1:1/" }), priv);
    expect(r.error?.code).toBe("CONNECTION");
  });
  it("redaction", () => {
    const s = redactSpec(
      spec({
        headers: [{ key: "Authorization", value: "Bearer x", enabled: true }, { key: "X-Custom", value: "s", enabled: true }, { key: "Accept", value: "a", enabled: true }],
        auth: { type: "apikey", key: "X-Custom", value: "s", in: "header" },
      }),
    );
    expect(s.headers.map((h) => h.value)).toEqual(["[REDACTED]", "[REDACTED]", "a"]);
    expect(s.auth).toMatchObject({ value: "[REDACTED]" });
    expect(redactHeaders({ Authorization: "x", "X-Key": "y", ok: 1 }, ["x-key"])).toEqual({ Authorization: "[REDACTED]", "X-Key": "[REDACTED]", ok: 1 });
  });
});

describe("redaction details", async () => {
  const { redactHeaders, redactUrl } = await import("../src/services/executor/redact.js");
  it("keeps set-cookie names and attributes, hides values", () => {
    const h = redactHeaders({ "set-cookie": ["sid=abc123; Path=/; HttpOnly", "theme=dark"] });
    expect(h["set-cookie"]).toEqual(["sid=[REDACTED]; Path=/; HttpOnly", "theme=[REDACTED]"]);
  });
  it("hides api-key query param in URLs", () => {
    const spec = { method: "GET", url: "https://a.com", query: [], headers: [], body: { mode: "none", content: "" },
      auth: { type: "apikey", key: "api_key", value: "s3cret", in: "query" } } as any;
    expect(redactUrl("https://a.com/x?api_key=s3cret&q=1", spec)).toBe("https://a.com/x?api_key=%5BREDACTED%5D&q=1");
  });
});
