import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().default("mongodb://localhost:27017/tracenest"),
  JWT_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  ALLOW_PRIVATE_TARGETS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z.string().optional(),
  NODE_ENV: z.string().default("development"),
  // Number of proxy hops to trust for req.ip; default 1 in production, none otherwise.
  TRUST_PROXY: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).optional()),
}).refine((e) => !(e.NODE_ENV === "production" && e.JWT_SECRET.startsWith("change-me")), {
  path: ["JWT_SECRET"],
  message: "JWT_SECRET is still the .env.example placeholder; set a random secret",
});

export const parseEnv = (e: NodeJS.ProcessEnv) => schema.parse(e);
export const env = parseEnv(process.env);
