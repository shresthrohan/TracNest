import { z } from "zod";

const kv = z.object({ key: z.string().max(500), value: z.string().max(10000), enabled: z.boolean() });

export const requestSpecSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().trim().min(1).max(2048),
  query: z.array(kv).max(100).default([]),
  headers: z.array(kv).max(100).default([]),
  auth: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("none") }),
      z.object({ type: z.literal("bearer"), token: z.string().max(5000) }),
      z.object({ type: z.literal("basic"), username: z.string().max(500), password: z.string().max(500) }),
      z.object({ type: z.literal("apikey"), key: z.string().min(1).max(200), value: z.string().max(5000), in: z.enum(["header", "query"]) }),
    ])
    .default({ type: "none" }),
  body: z.object({ mode: z.enum(["none", "json", "text"]), content: z.string().max(1024 * 1024) }).default({ mode: "none", content: "" }),
});
