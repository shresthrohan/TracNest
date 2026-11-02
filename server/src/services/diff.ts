import { isDeepStrictEqual } from "node:util";

export type DiffChange = { path: string; kind: "added" | "removed" | "changed" | "type"; before?: unknown; after?: unknown };
export type JsonType = "null" | "array" | "object" | "string" | "number" | "boolean";

export const typeOf = (v: unknown): JsonType =>
  v === null ? "null" : Array.isArray(v) ? "array" : (typeof v as "object" | "string" | "number" | "boolean");

const MAX_DEPTH = 200;
// isDeepStrictEqual recurses too; absurdly deep input counts as changed.
const sameDeep = (a: unknown, b: unknown) => {
  try {
    return isDeepStrictEqual(a, b);
  } catch {
    return false;
  }
};

export function diffJson(a: unknown, b: unknown, path = "", depth = 0): DiffChange[] {
  const p = path || "$";
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) return [{ path: p, kind: "type", before: a, after: b }];
  if (depth > MAX_DEPTH) return sameDeep(a, b) ? [] : [{ path: p, kind: "changed", before: a, after: b }];
  if (ta === "array") {
    const x = a as unknown[], y = b as unknown[];
    const out: DiffChange[] = [];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const ip = `${path}[${i}]`;
      if (i >= y.length) out.push({ path: ip, kind: "removed", before: x[i] });
      else if (i >= x.length) out.push({ path: ip, kind: "added", after: y[i] });
      else out.push(...diffJson(x[i], y[i], ip, depth + 1));
    }
    return out;
  }
  if (ta === "object") {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    const out: DiffChange[] = [];
    const sub = (k: string) => (path ? `${path}.${k}` : k);
    for (const k of Object.keys(x)) {
      if (!Object.hasOwn(y, k)) out.push({ path: sub(k), kind: "removed", before: x[k] });
      else out.push(...diffJson(x[k], y[k], sub(k), depth + 1));
    }
    for (const k of Object.keys(y)) if (!Object.hasOwn(x, k)) out.push({ path: sub(k), kind: "added", after: y[k] });
    return out;
  }
  return a === b ? [] : [{ path: p, kind: "changed", before: a, after: b }];
}

const parse = (s: string): { v: unknown } | null => {
  try {
    return { v: JSON.parse(s) };
  } catch {
    return null;
  }
};

/** Diff two raw response bodies: structural when both are JSON, else whole-text. */
export function diffBodies(a: string, b: string): { bodyKind: "json" | "text"; changes: DiffChange[] } {
  const pa = parse(a), pb = parse(b);
  if (pa && pb) return { bodyKind: "json", changes: diffJson(pa.v, pb.v) };
  return { bodyKind: "text", changes: a === b ? [] : [{ path: "$", kind: "changed", before: a, after: b }] };
}
