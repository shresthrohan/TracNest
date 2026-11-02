import { it, expect } from "vitest";
import { agentFor } from "./helpers.js";
import { buildAiContext } from "../src/services/ai.js";

it("context excludes secrets, query values and truncates body", () => {
  const ctx = JSON.stringify(
    buildAiContext({
      request: {
        method: "GET",
        url: "https://api.example.com/v1/x?token=SECRETQ&page=2",
        headers: [{ key: "Authorization", value: "Bearer SECRETH", enabled: true }],
      },
      statusCode: 500,
      responseTime: 12,
      responseHeaders: { "set-cookie": "sid=SECRETC", "x-api-key": "SECRETK", "content-type": "application/json" },
      responseBody: "a".repeat(20000),
      error: undefined,
    }),
  );
  for (const s of ["SECRETQ", "SECRETH", "SECRETC", "SECRETK"]) expect(ctx).not.toContain(s);
  expect(ctx).toContain("page=");
  expect(ctx).toContain("application/json");
  expect(ctx.length).toBeLessThan(10000);
});

it("status disabled and explain 503 without a key", async () => {
  const a = await agentFor("ai1@x.io");
  expect((await a.get("/api/ai/status")).body).toEqual({ enabled: false });
  const r = await a.post("/api/ai/explain").send({ executionId: "64b7f0c2a1b2c3d4e5f60718" });
  expect(r.status).toBe(503);
  expect(r.body.error.code).toBe("AI_DISABLED");
});

it("explain requires auth", async () => {
  const { default: request } = await import("supertest");
  const { app } = await import("./helpers.js");
  await request(app).post("/api/ai/explain").send({}).expect(401);
});
