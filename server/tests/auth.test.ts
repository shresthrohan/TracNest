import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, agentFor } from "./helpers.js";

describe("auth", () => {
  it("register then me, no passwordHash", async () => {
    const a = await agentFor("A@x.com");
    const r = await a.get("/api/auth/me");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id: expect.any(String), name: "Test", email: "a@x.com" });
  });
  it("duplicate email 409", async () => {
    await agentFor("a@x.com");
    const r = await request(app).post("/api/auth/register").send({ name: "T", email: "a@x.com", password: "password123" });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("EMAIL_TAKEN");
  });
  it("bad creds 401 same for unknown email", async () => {
    await agentFor("a@x.com");
    const bad = await request(app).post("/api/auth/login").send({ email: "a@x.com", password: "wrongwrong" });
    const unk = await request(app).post("/api/auth/login").send({ email: "zz@x.com", password: "wrongwrong" });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unk.body.error).toEqual(bad.body.error);
  });
  it("me without cookie 401", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });
  it("logout clears cookie", async () => {
    const a = await agentFor("a@x.com");
    await a.post("/api/auth/logout").expect(200);
    expect((await a.get("/api/auth/me")).status).toBe(401);
  });
  it("password change requires currentPassword", async () => {
    const a = await agentFor("a@x.com");
    expect((await a.patch("/api/auth/me").send({ newPassword: "newpassword1" })).status).toBe(401);
    expect((await a.patch("/api/auth/me").send({ currentPassword: "nope-nope", newPassword: "newpassword1" })).status).toBe(401);
    expect((await a.patch("/api/auth/me").send({ currentPassword: "password123", newPassword: "newpassword1" })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: "a@x.com", password: "newpassword1" })).status).toBe(200);
  });
});
