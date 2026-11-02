import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import { performance } from "node:perf_hooks";
import { isBlockedIp } from "./guard.js";
import { env } from "../../config/env.js";
import { SENSITIVE, apiKeyHeaderName } from "./redact.js";

export type KV = { key: string; value: string; enabled: boolean };
export type AuthConfig =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; key: string; value: string; in: "header" | "query" };
export type RequestSpec = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  query: KV[];
  headers: KV[];
  auth: AuthConfig;
  body: { mode: "none" | "json" | "text"; content: string };
};
export type ExecErrorCode = "BLOCKED" | "TIMEOUT" | "DNS" | "CONNECTION" | "TOO_LARGE" | "INVALID_URL" | "INVALID_REQUEST" | "TOO_MANY_REDIRECTS";
export type ExecResult = {
  ok: boolean;
  statusCode?: number;
  statusText?: string;
  headers: Record<string, string | string[]>;
  body: string;
  bodyTruncated: boolean;
  size: number;
  timeMs: number;
  finalUrl: string;
  redirects: string[];
  error?: { code: ExecErrorCode; message: string };
};
export type ExecOpts = {
  allowPrivate?: boolean;
  timeoutMs?: number;
  /** Test hook: hostname -> IP list. Defaults to dns.lookup(all). */
  resolver?: (host: string) => Promise<string[]>;
  /** Test hook: overrides the blocked-IP predicate (defaults to isBlockedIp). */
  isBlocked?: (ip: string) => boolean;
};

const MAX_RESPONSE = 5 * 1024 * 1024;
const MAX_STORED = 1024 * 1024;
const MAX_REDIRECTS = 5;

class ExecError extends Error {
  constructor(public code: ExecErrorCode, message: string) {
    super(message);
  }
}

const defaultResolver = async (host: string) => (await dns.lookup(host, { all: true })).map((a) => a.address);

function buildInitial(spec: RequestSpec) {
  let url: URL;
  try {
    url = new URL(spec.url);
  } catch {
    throw new ExecError("INVALID_URL", "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ExecError("INVALID_URL", "Only http and https URLs are allowed");
  for (const q of spec.query) if (q.enabled && q.key) url.searchParams.append(q.key, q.value);
  const headers: Record<string, string> = {};
  for (const h of spec.headers) if (h.enabled && h.key) headers[h.key.toLowerCase()] = h.value;
  const a = spec.auth;
  if (a.type === "bearer") headers.authorization = `Bearer ${a.token}`;
  else if (a.type === "basic") headers.authorization = `Basic ${Buffer.from(`${a.username}:${a.password}`).toString("base64")}`;
  else if (a.type === "apikey") {
    if (a.in === "header") headers[a.key.toLowerCase()] = a.value;
    else url.searchParams.append(a.key, a.value);
  }
  let body: string | undefined;
  if (spec.body.mode !== "none" && spec.method !== "GET") {
    body = spec.body.content;
    headers["content-type"] ??= spec.body.mode === "json" ? "application/json" : "text/plain";
  }
  return { url, headers, body };
}

// DNS counts against the overall timeout: race the resolver against the abort signal.
function resolveWithin(resolver: (h: string) => Promise<string[]>, host: string, signal: AbortSignal) {
  const aborted = new Promise<never>((_, rej) => {
    if (signal.aborted) rej(signal.reason);
    else signal.addEventListener("abort", () => rej(signal.reason), { once: true });
  });
  return Promise.race([resolver(host).catch(() => { throw new ExecError("DNS", `Could not resolve ${host}`); }), aborted]);
}

async function pickAddress(host: string, o: Required<Pick<ExecOpts, "resolver" | "isBlocked">> & { allowPrivate: boolean }, signal: AbortSignal) {
  const bare = host.replace(/^\[|\]$/g, "");
  const ips = isIP(bare) ? [bare] : await resolveWithin(o.resolver, bare, signal);
  if (!ips.length) throw new ExecError("DNS", `Could not resolve ${bare}`);
  if (!o.allowPrivate && ips.some((ip) => o.isBlocked(ip))) throw new ExecError("BLOCKED", "Target address is not allowed");
  return ips[0];
}

type Hop = { statusCode: number; statusText: string; headers: http.IncomingHttpHeaders; body: Buffer; size: number; truncated: boolean };

function hop(url: URL, method: string, headers: Record<string, string>, body: string | undefined, ip: string, signal: AbortSignal): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method,
        headers: body !== undefined ? { ...headers, "content-length": String(Buffer.byteLength(body)) } : headers,
        signal,
        agent: false,
        // Happy-eyeballs adds multi-second stalls with a single pinned address; we already chose the IP.
        ...({ autoSelectFamily: false } as object), // not in @types/node RequestOptions
        // Pin the connection to the address we validated (defeats DNS rebinding).
        lookup: ((_h: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) =>
          opts?.all ? cb(null, [{ address: ip, family: isIP(ip) }]) : cb(null, ip, isIP(ip))) as never,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0, stored = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_RESPONSE) return void req.destroy(new ExecError("TOO_LARGE", "Response exceeds 5 MB"));
          if (stored < MAX_STORED) {
            const part = c.subarray(0, MAX_STORED - stored);
            chunks.push(part);
            stored += part.length;
          }
        });
        res.on("end", () =>
          resolve({ statusCode: res.statusCode ?? 0, statusText: res.statusMessage ?? "", headers: res.headers, body: Buffer.concat(chunks), size, truncated: size > MAX_STORED }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** Never throws. */
export async function executeRequest(spec: RequestSpec, opts: ExecOpts = {}): Promise<ExecResult> {
  const t0 = performance.now();
  const timeoutMs = opts.timeoutMs ?? 15000;
  const o = { allowPrivate: opts.allowPrivate ?? env.ALLOW_PRIVATE_TARGETS, resolver: opts.resolver ?? defaultResolver, isBlocked: opts.isBlocked ?? isBlockedIp };
  const redirects: string[] = [];
  let finalUrl = spec.url;
  const fail = (err: ExecError): ExecResult => ({
    ok: false, headers: {}, body: "", bodyTruncated: false, size: 0, timeMs: Math.max(performance.now() - t0, 0.001),
    finalUrl, redirects, error: { code: err.code, message: err.message },
  });
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    let { url, headers, body } = buildInitial(spec);
    let method: string = spec.method;
    for (;;) {
      finalUrl = url.toString();
      const ip = await pickAddress(url.hostname, o, signal);
      const r = await hop(url, method, headers, body, ip, signal);
      const loc = r.headers.location;
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && loc) {
        if (redirects.length >= MAX_REDIRECTS) throw new ExecError("TOO_MANY_REDIRECTS", "Too many redirects");
        let next: URL;
        try {
          next = new URL(loc, url);
        } catch {
          throw new ExecError("INVALID_URL", "Invalid redirect location");
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") throw new ExecError("INVALID_URL", "Redirect to non-http URL");
        redirects.push(next.toString());
        if (r.statusCode === 303 || ((r.statusCode === 301 || r.statusCode === 302) && method === "POST")) {
          method = "GET";
          body = undefined;
          delete headers["content-type"];
        }
        if (next.origin !== url.origin) { // don't leak credentials cross-origin
          headers = { ...headers };
          for (const n of [...SENSITIVE, ...apiKeyHeaderName(spec).map((k) => k.toLowerCase())]) delete headers[n];
        }
        url = next;
        continue;
      }
      const clean: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(r.headers)) if (v !== undefined) clean[k] = v;
      return {
        ok: r.statusCode < 400, statusCode: r.statusCode, statusText: r.statusText, headers: clean,
        body: r.body.toString("utf8"), bodyTruncated: r.truncated, size: r.size,
        timeMs: Math.max(performance.now() - t0, 0.001), finalUrl, redirects,
      };
    }
  } catch (e) {
    if (e instanceof ExecError) return fail(e);
    const err = e as NodeJS.ErrnoException & { cause?: unknown };
    if (signal.aborted || err.name === "TimeoutError" || err.name === "AbortError") return fail(new ExecError("TIMEOUT", `Request timed out after ${timeoutMs} ms`));
    if (err.cause instanceof ExecError) return fail(err.cause);
    if (err.code === "ERR_INVALID_CHAR" || err.code === "ERR_INVALID_HTTP_TOKEN") return fail(new ExecError("INVALID_REQUEST", "A header name or value contains invalid characters"));
    if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") return fail(new ExecError("DNS", "Could not resolve host"));
    return fail(new ExecError("CONNECTION", err.code ? `Connection failed (${err.code})` : "Connection failed"));
  }
}
