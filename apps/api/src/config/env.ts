// Runtime environment validation for the SupportAI API.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const configPaths = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
  path.resolve(process.cwd(), ".env")
];

for (const configPath of configPaths) {
  dotenv.config({ path: configPath, override: false });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("knowledge-base"),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-001"),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().refine((value) => value === 768, "The database requires 768 embedding dimensions.").default(768),
  GEMINI_GENERATION_MODEL: z.string().min(1).default("gemini-1.5-flash"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100)
});

export const env = envSchema.parse(process.env);

export const allowedOrigins = env.API_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
