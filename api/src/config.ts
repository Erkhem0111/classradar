import { readFileSync } from "node:fs";
import { z } from "zod";

// erxes.json sits at the repository root, two levels above both src/ and dist/.
const manifestSchema = z.object({
  name: z.string(),
  title: z.string(),
  version: z.string(),
  api: z.object({
    port: z.number().int(),
    graphql: z.string(),
    health: z.string(),
  }),
});

export const manifest = manifestSchema.parse(
  JSON.parse(readFileSync(new URL("../../erxes.json", import.meta.url), "utf8")),
);

const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(manifest.api.port),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: optional,
  MONGO_URL: z.string().default("mongodb://localhost:27017/erxes"),
  UI_ENTRY_URL: optional,
  LOAD_BALANCER_ADDRESS: optional,
  RELEASE_VERSION: optional,
  // OpenAI-compatible base URL serving Gemma 4, e.g. Ollama's
  // http://localhost:11434/v1. Unset = always use the built-in explanations.
  GEMMA_URL: optional,
  GEMMA_MODEL: z.string().default("gemma4:e2b"),
  GEMMA_API_KEY: optional,
  GEMMA_TIMEOUT_MS: z.coerce.number().int().default(8000),
});

export const env = envSchema.parse(process.env);

export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
};
