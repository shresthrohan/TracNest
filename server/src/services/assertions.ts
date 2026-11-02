import { isDeepStrictEqual } from "node:util";
import { typeOf } from "./diff.js";

export type Assertion = { id: string; kind: "status" | "maxTime" | "exists" | "equals" | "type" | "contains"; path?: string; expected?: unknown };
export type AssertionResult = { id: string; passed: boolean; actual?: unknown; message: string };

export function getPath(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const m of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[m[1] ?? m[2]];
  }
  return cur;
}

export function evaluate(assertions: Assertion[], exec: { statusCode?: number; responseTime: number; responseBody: string }): AssertionResult[] {
  let json: { v: unknown } | null = null;
  try {
    json = { v: JSON.parse(exec.responseBody) };
  } catch {
    /* non-JSON body */
  }
  return assertions.map((a): AssertionResult => {
    const res = (passed: boolean, message: string, actual?: unknown): AssertionResult => ({ id: a.id, passed, message, ...(actual !== undefined && { actual }) });
    switch (a.kind) {
      case "status":
        return res(exec.statusCode === a.expected, exec.statusCode === a.expected ? `Status is ${a.expected}` : `Expected status ${a.expected}, got ${exec.statusCode ?? "none"}`, exec.statusCode);
      case "maxTime":
        return res(exec.responseTime <= Number(a.expected), exec.responseTime <= Number(a.expected) ? `${exec.responseTime} ms <= ${a.expected} ms` : `${exec.responseTime} ms > ${a.expected} ms`, exec.responseTime);
      case "contains": {
        const ok = exec.responseBody.includes(String(a.expected));
        return res(ok, ok ? `Body contains "${a.expected}"` : `Body does not contain "${a.expected}"`);
      }
    }
    if (!json) return res(false, "Response is not JSON");
    const actual = getPath(json.v, a.path ?? "");
    switch (a.kind) {
      case "exists":
        return res(actual !== undefined, actual !== undefined ? `${a.path} exists` : `${a.path} is missing`, actual);
      case "equals": {
        const ok = isDeepStrictEqual(actual, a.expected);
        return res(ok, ok ? `${a.path} equals expected` : `${a.path}: expected ${JSON.stringify(a.expected)}, got ${JSON.stringify(actual) ?? "undefined"}`, actual);
      }
      default: {
        const t = actual === undefined ? "undefined" : typeOf(actual);
        return res(t === a.expected, t === a.expected ? `${a.path} is ${t}` : `${a.path}: expected type ${a.expected}, got ${t}`, actual);
      }
    }
  });
}
