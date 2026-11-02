import { describe, it, expect } from "vitest";
import { diffJson, typeOf, diffBodies } from "../src/services/diff.js";

describe("diffJson", () => {
  it("added/removed", () => {
    expect(diffJson({ name: "J", age: 22 }, { name: "J", email: "john@example.com" })).toEqual([
      { path: "age", kind: "removed", before: 22 },
      { path: "email", kind: "added", after: "john@example.com" },
    ]);
  });
  it("nested change", () => {
    expect(diffJson({ user: { address: { city: "A" } } }, { user: { address: { city: "B" } } })).toEqual([
      { path: "user.address.city", kind: "changed", before: "A", after: "B" },
    ]);
  });
  it("type change", () => {
    expect(diffJson({ a: 5 }, { a: "5" })).toEqual([{ path: "a", kind: "type", before: 5, after: "5" }]);
  });
  it("arrays index-wise", () => {
    expect(diffJson({ a: [1] }, { a: [1, 2] })).toEqual([{ path: "a[1]", kind: "added", after: 2 }]);
    expect(diffJson({ a: [1, 2] }, { a: [1] })).toEqual([{ path: "a[1]", kind: "removed", before: 2 }]);
    expect(diffJson({ a: [{ c: 1 }, { c: 2 }] }, { a: [{ c: 1 }, { c: 3 }] })).toEqual([
      { path: "a[1].c", kind: "changed", before: 2, after: 3 },
    ]);
  });
  it("identical", () => expect(diffJson({ a: [1, { b: null }] }, { a: [1, { b: null }] })).toEqual([]));
  it("root differences", () => {
    expect(diffJson({ a: 1 }, [1])).toEqual([{ path: "$", kind: "type", before: { a: 1 }, after: [1] }]);
    expect(diffJson(1, 2)).toEqual([{ path: "$", kind: "changed", before: 1, after: 2 }]);
  });
  it("null vs object is type; typeOf", () => {
    expect(diffJson({ a: null }, { a: {} })[0].kind).toBe("type");
    expect(typeOf(null)).toBe("null");
    expect(typeOf([])).toBe("array");
  });
  it("diffBodies json and text", () => {
    expect(diffBodies('{"a":1}', '{"a":2}')).toEqual({ bodyKind: "json", changes: [{ path: "a", kind: "changed", before: 1, after: 2 }] });
    expect(diffBodies("hi", "yo")).toEqual({ bodyKind: "text", changes: [{ path: "$", kind: "changed", before: "hi", after: "yo" }] });
    expect(diffBodies("", "")).toEqual({ bodyKind: "text", changes: [] });
    expect(diffBodies('{"a":1}', "oops").bodyKind).toBe("text");
  });
});
