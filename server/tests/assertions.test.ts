import { describe, it, expect } from "vitest";
import { evaluate, getPath, type Assertion } from "../src/services/assertions.js";

const body = JSON.stringify({ user: { id: 1, email: "a@b.c" }, items: [{ name: "x" }, { name: "y" }] });
const ex = { statusCode: 200, responseTime: 620, responseBody: body };
const run = (a: Omit<Assertion, "id">, e: Parameters<typeof evaluate>[1] = ex) => evaluate([{ id: "1", ...a }], e)[0];

describe("assertions", () => {
  it("getPath", () => {
    const o = JSON.parse(body);
    expect(getPath(o, "user.id")).toBe(1);
    expect(getPath(o, "items[1].name")).toBe("y");
    expect(getPath(o, "items[5].name")).toBeUndefined();
    expect(getPath(o, "user.nope.deeper")).toBeUndefined();
  });
  it("status", () => {
    expect(run({ kind: "status", expected: 200 }).passed).toBe(true);
    expect(run({ kind: "status", expected: 201 }).passed).toBe(false);
  });
  it("maxTime", () => {
    const r = run({ kind: "maxTime", expected: 500 });
    expect(r.passed).toBe(false);
    expect(r.message).toBe("620 ms > 500 ms");
    expect(run({ kind: "maxTime", expected: 700 }).passed).toBe(true);
  });
  it("exists/type/equals", () => {
    expect(run({ kind: "exists", path: "user.id" }).passed).toBe(true);
    expect(run({ kind: "exists", path: "user.zip" }).passed).toBe(false);
    expect(run({ kind: "type", path: "user.email", expected: "string" }).passed).toBe(true);
    expect(run({ kind: "type", path: "items", expected: "array" }).passed).toBe(true);
    expect(run({ kind: "type", path: "items", expected: "object" }).passed).toBe(false);
    const eq = run({ kind: "equals", path: "items[1].name", expected: "y" });
    expect(eq.passed).toBe(true);
    expect(eq.actual).toBe("y");
    expect(run({ kind: "equals", path: "items[1].name", expected: "z" }).passed).toBe(false);
  });
  it("contains raw text", () => {
    expect(run({ kind: "contains", expected: "a@b.c" }).passed).toBe(true);
    expect(run({ kind: "contains", expected: "nope" }).passed).toBe(false);
  });
  it("non-JSON body", () => {
    const e = { statusCode: 200, responseTime: 1, responseBody: "<html>hi</html>" };
    const r = run({ kind: "exists", path: "a" }, e);
    expect(r).toMatchObject({ passed: false, message: "Response is not JSON" });
    expect(run({ kind: "status", expected: 200 }, e).passed).toBe(true);
    expect(run({ kind: "contains", expected: "hi" }, e).passed).toBe(true);
  });
  it("missing status (error)", () => {
    expect(run({ kind: "status", expected: 200 }, { responseTime: 1, responseBody: "" }).passed).toBe(false);
  });
});
