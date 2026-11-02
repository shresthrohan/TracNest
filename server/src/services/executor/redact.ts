import type { RequestSpec } from "./execute.js";

const REDACTED = "[REDACTED]";
const SENSITIVE = ["authorization", "cookie", "x-api-key", "proxy-authorization"];

// set-cookie keeps cookie names and attributes; only values are hidden.
const redactCookie = (c: unknown) => String(c).replace(/^([^=;]*)=[^;]*/, `$1=${REDACTED}`);

export function redactHeaders(h: Record<string, unknown>, extra: string[] = []): Record<string, unknown> {
  const names = new Set([...SENSITIVE, ...extra.map((e) => e.toLowerCase())]);
  return Object.fromEntries(
    Object.entries(h).map(([k, v]) => {
      const lk = k.toLowerCase();
      if (lk === "set-cookie") return [k, Array.isArray(v) ? v.map(redactCookie) : redactCookie(v)];
      return [k, names.has(lk) ? REDACTED : v];
    }),
  );
}

export const apiKeyHeaderName = (spec: RequestSpec) =>
  spec.auth.type === "apikey" && spec.auth.in === "header" ? [spec.auth.key] : [];

/** Hides an api-key query param value in a URL (finalUrl / redirect hops). */
export function redactUrl(url: string, spec: RequestSpec): string {
  const a = spec.auth;
  if (a.type !== "apikey" || a.in !== "query") return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has(a.key)) u.searchParams.set(a.key, REDACTED);
    return u.toString();
  } catch {
    return url;
  }
}

export function redactSpec(spec: RequestSpec): RequestSpec {
  const names = new Set([...SENSITIVE, ...apiKeyHeaderName(spec).map((n) => n.toLowerCase())]);
  const a = spec.auth;
  const auth: RequestSpec["auth"] =
    a.type === "bearer" ? { ...a, token: REDACTED }
    : a.type === "basic" ? { ...a, password: REDACTED }
    : a.type === "apikey" ? { ...a, value: REDACTED }
    : a;
  return {
    ...spec,
    headers: spec.headers.map((h) => (names.has(h.key.toLowerCase()) ? { ...h, value: REDACTED } : h)),
    query: spec.query.map((q) => (a.type === "apikey" && a.in === "query" && q.key === a.key ? { ...q, value: REDACTED } : q)),
    auth,
  };
}
