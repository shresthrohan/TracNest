import { it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

it("61st execute within a minute returns 429", async () => {
  const agent = request.agent(createApp({ executeMax: 60 }));
  await agent.post("/api/auth/register").send({ name: "T", email: "rl@x.io", password: "password123" }).expect(201);
  const spec = { method: "GET", url: "not a url" }; // fails fast, no network
  for (let i = 0; i < 60; i++) await agent.post("/api/execute").send({ spec }).expect(201);
  const r = await agent.post("/api/execute").send({ spec });
  expect(r.status).toBe(429);
  expect(r.body.error.code).toBe("RATE_LIMITED");
});

it("global limit applies per user, not across users", async () => {
  const app = createApp({ globalMax: 3 });
  const a = request.agent(app);
  await a.post("/api/auth/register").send({ name: "A", email: "ga@x.io", password: "password123" }).expect(201);
  for (let i = 0; i < 3; i++) await a.get("/api/auth/me").expect(200);
  await a.get("/api/auth/me").expect(429);
  // same IP, but unauthenticated requests use the IP key, not A's user key
  await request.agent(app).get("/api/health").expect(200);
});
