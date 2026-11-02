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
});

export const env = schema.parse(process.env);
