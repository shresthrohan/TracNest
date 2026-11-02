import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("skeleton", () => {
  it("health", async () => {
    const r = await request(createApp()).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
  it("unknown route 404", async () => {
    const r = await request(createApp()).get("/api/nope");
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("NOT_FOUND");
  });
});
