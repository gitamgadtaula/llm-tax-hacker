import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DATABASE_URL: z.string(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // LLM
  LLM_PROVIDER: z.enum(["openai", "anthropic", "ollama"]).default("openai"),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4-vision-preview"),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default("1000"),
  OPENAI_TEMPERATURE: z.string().transform(Number).default("0.3"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-opus-20240229"),

  // Ollama
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llava"),

  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default("10485760"), // 10MB
  ALLOWED_FILE_TYPES: z
    .string()
    .default("image/jpeg,image/png,image/webp,image/gif"),
});

export const config = envSchema.parse(process.env);

export const getAllowedFileTypes = () => config.ALLOWED_FILE_TYPES.split(",");
