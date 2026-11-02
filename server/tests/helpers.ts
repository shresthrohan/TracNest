import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp();

export async function agentFor(email: string) {
  const agent = request.agent(app);
  const r = await agent.post("/api/auth/register").send({ name: "Test", email, password: "password123" });
  if (r.status !== 201) throw new Error("register failed " + r.status);
  return agent;
}
