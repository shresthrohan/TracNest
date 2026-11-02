import { describe, it, expect } from "vitest";
import { isAnomaly } from "../src/services/anomaly.js";

describe("isAnomaly", () => {
  it("needs at least 20 samples", () => {
    expect(isAnomaly(Array(19).fill(100), 5000)).toBe(false);
  });
  it("flags a spike on a flat series", () => {
    expect(isAnomaly([...Array(30).fill(100)], 400)).toBe(true);
  });
  it("ignores a value within normal noise", () => {
    const noisy = Array.from({ length: 30 }, (_, i) => (i % 2 ? 80 : 120));
    expect(isAnomaly(noisy, 140)).toBe(false);
  });
  it("requires an absolute rise of 50 ms", () => {
    expect(isAnomaly(Array(30).fill(10), 40)).toBe(false);
  });
});
